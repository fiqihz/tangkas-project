/**
 * Simulasi mabar untuk MEMVALIDASI keadilan algoritma (dijalankan via tsx/node).
 * Bukan bagian dari app runtime. Jalankan: `npx tsx src/lib/domain/simulate.ts`
 */
import { MatchHistory } from "./history";
import { applyMatchResult, buildLeaderboard } from "./leaderboard";
import { generateMatch } from "./matchmaking";
import { availablePool } from "./queue";
import { LEVEL_LABEL, type Level, type Match, type SessionPlayer } from "./types";

let idc = 0;
function mk(name: string, level: Level): SessionPlayer {
  idc += 1;
  return {
    id: `p${idc}`,
    name,
    level,
    status: "active",
    gamesPlayed: 0,
    lastPlayedRound: null,
    availableSinceRound: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsScored: 0,
    pointsConceded: 0,
  };
}

function buildRoster(): SessionPlayer[] {
  const players: SessionPlayer[] = [];
  for (let i = 1; i <= 8; i++) players.push(mk(`Newbie-${i}`, "newbie"));
  for (let i = 1; i <= 10; i++) players.push(mk(`Beginner-${i}`, "beginner"));
  for (let i = 1; i <= 6; i++) players.push(mk(`Inter-${i}`, "intermediate"));
  return players;
}

function main() {
  const COURTS = 3;
  const ROUNDS = 8; // ~ setara durasi mabar
  let players = buildRoster();
  const byId = () => new Map(players.map((p) => [p.id, p]));
  const history = new MatchHistory();
  const finished: Match[] = [];

  let globalRound = 0;

  // Statistik keragaman
  const partnerPairs = new Set<string>();
  let hardRuleViolations = 0;

  for (let r = 0; r < ROUNDS; r++) {
    globalRound += 1;
    const busy = new Set<string>();
    const roundMatches: Match[] = [];

    for (let c = 0; c < COURTS; c++) {
      const pool = availablePool(players, {
        requireLevel: true,
        excludeIds: busy,
      });
      const prop = generateMatch(pool, history, globalRound);
      if (!prop) continue;

      // tandai sibuk
      [...prop.teamA, ...prop.teamB].forEach((id) => busy.add(id));

      // cek hard rule
      const lv = (id: string) => byId().get(id)!.level;
      const twoNewbie = (t: [string, string]) =>
        t.every((id) => lv(id) === "newbie");
      if (twoNewbie(prop.teamA) || twoNewbie(prop.teamB)) hardRuleViolations++;

      // catat pasangan
      const pk = (x: string, y: string) => (x < y ? `${x}|${y}` : `${y}|${x}`);
      partnerPairs.add(pk(prop.teamA[0], prop.teamA[1]));
      partnerPairs.add(pk(prop.teamB[0], prop.teamB[1]));

      // skor acak realistis (30 poin, ada pemenang)
      const aWins = Math.random() < 0.5;
      const match: Match = {
        id: `r${globalRound}c${c}`,
        courtId: `court${c + 1}`,
        round: globalRound,
        teamA: { playerIds: prop.teamA },
        teamB: { playerIds: prop.teamB },
        state: "finished",
        score: aWins ? { a: 30, b: 20 + Math.floor(Math.random() * 9) } : { a: 20 + Math.floor(Math.random() * 9), b: 30 },
        winner: aWins ? "a" : "b",
      };
      roundMatches.push(match);
    }

    // terapkan hasil ronde
    for (const m of roundMatches) {
      players = applyMatchResult(players, m);
      history.record(m);
      finished.push(m);
      for (const id of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
        players = players.map((p) =>
          p.id === id
            ? { ...p, gamesPlayed: p.gamesPlayed + 1, lastPlayedRound: globalRound }
            : p,
        );
      }
    }
  }

  // ---- LAPORAN ----
  console.log("=".repeat(64));
  console.log(`SIMULASI: ${players.length} pemain, ${COURTS} lapangan, ${ROUNDS} ronde`);
  console.log("=".repeat(64));

  console.log("\n[1] PEMERATAAN JATAH MAIN (gamesPlayed per pemain)");
  const gp = players.map((p) => p.gamesPlayed);
  const min = Math.min(...gp);
  const max = Math.max(...gp);
  const avg = (gp.reduce((a, b) => a + b, 0) / gp.length).toFixed(2);
  console.log(`    min=${min}  max=${max}  avg=${avg}  selisih(max-min)=${max - min}`);
  const dist: Record<number, number> = {};
  gp.forEach((g) => (dist[g] = (dist[g] ?? 0) + 1));
  console.log(
    "    distribusi:",
    Object.entries(dist)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => `${k}x:${v} org`)
      .join("  "),
  );

  console.log("\n[2] KEPATUHAN HARD RULE (Newbie+Newbie)");
  console.log(`    pelanggaran Newbie+Newbie: ${hardRuleViolations} (harus 0)`);

  console.log("\n[3] KERAGAMAN PASANGAN");
  const totalMatches = finished.length;
  console.log(`    total match: ${totalMatches}  pasangan unik terbentuk: ${partnerPairs.size}`);

  console.log("\n[4] KESEIMBANGAN LEVEL PER MATCH (contoh 6 match pertama)");
  finished.slice(0, 6).forEach((m) => {
    const nm = (id: string) => {
      const p = players.find((x) => x.id === id)!;
      return `${p.name}(${LEVEL_LABEL[p.level as Level][0]})`;
    };
    console.log(
      `    ${m.courtId} R${m.round}: [${m.teamA.playerIds.map(nm).join(" + ")}] vs [${m.teamB.playerIds.map(nm).join(" + ")}]  skor ${m.score!.a}-${m.score!.b}`,
    );
  });

  console.log("\n[5] LEADERBOARD (top 8, tie-break: menang > selisih poin > total poin)");
  const lb = buildLeaderboard(players);
  lb.slice(0, 8).forEach((row) => {
    console.log(
      `    #${row.rank} ${row.name.padEnd(12)} W:${row.wins} L:${row.losses} D:${row.draws}  diff:${row.pointDiff >= 0 ? "+" : ""}${row.pointDiff}  pts:${row.pointsScored}`,
    );
  });

  console.log("\n" + "=".repeat(64));
}

main();
