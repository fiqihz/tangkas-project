/**
 * Simulasi DINAMIS untuk memvalidasi penanganan status pemain:
 *   - Registered lalu no-show (tidak pernah check-in)
 *   - Datang telat (check-in di tengah mabar) -> harus dikejar jatah mainnya
 *   - Rest sementara di tengah (lalu balik Active)
 *   - Pulang duluan (Left) di tengah mabar
 *
 * Jalankan: `npx tsx src/lib/domain/simulate-dynamic.ts`
 */
import { MatchHistory } from "./history";
import { applyMatchResult, buildLeaderboard } from "./leaderboard";
import { generateMatch } from "./matchmaking";
import { availablePool } from "./queue";
import { findSubstitute } from "./substitute";
import {
  LEVEL_LABEL,
  type Level,
  type Match,
  type PlayerStatus,
  type SessionPlayer,
} from "./types";

let idc = 0;
function mk(name: string, level: Level, status: PlayerStatus = "registered"): SessionPlayer {
  idc += 1;
  return {
    id: `p${idc}`,
    name,
    level,
    status,
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

function setStatus(players: SessionPlayer[], id: string, status: PlayerStatus, round: number): SessionPlayer[] {
  return players.map((p) =>
    p.id === id
      ? {
          ...p,
          status,
          // saat jadi active (check-in / balik dari rest), catat kapan mulai menunggu
          availableSinceRound: status === "active" ? round : p.availableSinceRound,
        }
      : p,
  );
}

function main() {
  const COURTS = 3;
  const ROUNDS = 8;
  let players = buildRoster();
  const history = new MatchHistory();
  const finished: Match[] = [];
  let globalRound = 0;
  let hardRuleViolations = 0;

  const log: string[] = [];

  // --- SKENARIO KEHADIRAN ---
  // Awal: 20 orang check-in (Active). 2 no-show, 2 datang telat.
  const noShow = new Set(["p7", "p8"]); // Newbie-7, Newbie-8 tidak datang
  const lateArrivals: Record<string, number> = { p23: 5, p24: 6 }; // Inter-5 dtg R5, Inter-6 dtg R6
  const restEvents: Record<number, string[]> = { 3: ["p9"] }; // Beginner-1 rest mulai R3
  const backFromRest: Record<number, string[]> = { 6: ["p9"] }; // balik R6
  const leaveEvents: Record<number, string[]> = { 5: ["p1"] }; // Newbie-1 pulang R5

  // check-in awal: semua kecuali no-show & late arrivals
  players = players.map((p) => {
    if (noShow.has(p.id)) return p; // tetap registered
    if (p.id in lateArrivals) return p; // belum datang
    return { ...p, status: "active" as PlayerStatus, availableSinceRound: 0 };
  });
  log.push(`R0 check-in: ${players.filter((p) => p.status === "active").length} active, ` +
    `${noShow.size} no-show (registered), ${Object.keys(lateArrivals).length} belum datang (telat)`);

  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? id;

  for (let r = 0; r < ROUNDS; r++) {
    globalRound += 1;

    // proses event kehadiran di awal ronde
    for (const [id, rr] of Object.entries(lateArrivals)) {
      if (rr === globalRound) {
        players = setStatus(players, id, "active", globalRound);
        log.push(`R${globalRound}: ${nameOf(id)} DATANG TELAT (check-in, gamesPlayed=${players.find((p) => p.id === id)!.gamesPlayed})`);
      }
    }
    for (const id of restEvents[globalRound] ?? []) {
      players = setStatus(players, id, "resting", globalRound);
      log.push(`R${globalRound}: ${nameOf(id)} REST`);
    }
    for (const id of backFromRest[globalRound] ?? []) {
      players = setStatus(players, id, "active", globalRound);
      log.push(`R${globalRound}: ${nameOf(id)} BALIK dari rest`);
    }
    for (const id of leaveEvents[globalRound] ?? []) {
      players = setStatus(players, id, "left", globalRound);
      log.push(`R${globalRound}: ${nameOf(id)} PULANG (left)`);
    }

    const busy = new Set<string>();
    const roundMatches: Match[] = [];

    for (let c = 0; c < COURTS; c++) {
      const pool = availablePool(players, { requireLevel: true, excludeIds: busy });
      const prop = generateMatch(pool, history, globalRound);
      if (!prop) continue;

      // Demonstrasi substitute: di R4 court1, anggap 1 pemain proposed mau rest,
      // cari pengganti tanpa melanggar rule.
      let teamA = prop.teamA;
      let teamB = prop.teamB;
      if (globalRound === 4 && c === 0) {
        const leaving = teamA[0];
        const byId = new Map(players.map((p) => [p.id, p]));
        const restPool = availablePool(players, {
          requireLevel: true,
          excludeIds: new Set([...busy, ...teamA, ...teamB]),
        });
        const sub = findSubstitute({
          match: { teamA, teamB },
          leavingId: leaving,
          pool: restPool,
          byId,
          history,
          currentRound: globalRound,
        });
        if (sub) {
          log.push(`R${globalRound} court1: ${nameOf(leaving)} minta REST (belum mulai) -> diganti ${nameOf(sub)}`);
          teamA = [sub, teamA[1]];
        }
      }

      [...teamA, ...teamB].forEach((id) => busy.add(id));

      const lv = (id: string) => players.find((p) => p.id === id)!.level;
      const twoNewbie = (t: [string, string]) => t.every((id) => lv(id) === "newbie");
      if (twoNewbie(teamA) || twoNewbie(teamB)) hardRuleViolations++;

      const aWins = Math.random() < 0.5;
      roundMatches.push({
        id: `r${globalRound}c${c}`,
        courtId: `court${c + 1}`,
        round: globalRound,
        teamA: { playerIds: teamA },
        teamB: { playerIds: teamB },
        state: "finished",
        score: aWins ? { a: 30, b: 20 + Math.floor(Math.random() * 9) } : { a: 20 + Math.floor(Math.random() * 9), b: 30 },
        winner: aWins ? "a" : "b",
      });
    }

    for (const m of roundMatches) {
      players = applyMatchResult(players, m);
      history.record(m);
      finished.push(m);
      for (const id of [...m.teamA.playerIds, ...m.teamB.playerIds]) {
        players = players.map((p) =>
          p.id === id ? { ...p, gamesPlayed: p.gamesPlayed + 1, lastPlayedRound: globalRound } : p,
        );
      }
    }
  }

  // ---- LAPORAN ----
  console.log("=".repeat(64));
  console.log("SIMULASI DINAMIS: status Registered / Active / Resting / Left");
  console.log("=".repeat(64));

  console.log("\n[EVENT LOG]");
  log.forEach((l) => console.log("    " + l));

  console.log("\n[1] NO-SHOW (harus 0 main, tetap registered)");
  for (const id of noShow) {
    const p = players.find((x) => x.id === id)!;
    console.log(`    ${p.name}: status=${p.status}, gamesPlayed=${p.gamesPlayed}`);
  }

  console.log("\n[2] DATANG TELAT (harus diprioritaskan agar jatah menyusul)");
  for (const id of Object.keys(lateArrivals)) {
    const p = players.find((x) => x.id === id)!;
    console.log(`    ${p.name}: datang R${lateArrivals[id]}, gamesPlayed=${p.gamesPlayed}, status=${p.status}`);
  }

  console.log("\n[3] REST & BALIK (Beginner-1)");
  {
    const p = players.find((x) => x.id === "p9")!;
    console.log(`    ${p.name}: status=${p.status}, gamesPlayed=${p.gamesPlayed}`);
  }

  console.log("\n[4] PULANG DULUAN (Newbie-1, left R5)");
  {
    const p = players.find((x) => x.id === "p1")!;
    console.log(`    ${p.name}: status=${p.status}, gamesPlayed=${p.gamesPlayed} (skor tetap tercatat)`);
  }

  console.log("\n[5] KEPATUHAN HARD RULE");
  console.log(`    pelanggaran Newbie+Newbie: ${hardRuleViolations} (harus 0)`);

  console.log("\n[6] PEMERATAAN JATAH MAIN (hanya yang sempat main)");
  const active = players.filter((p) => p.gamesPlayed > 0);
  const gp = active.map((p) => p.gamesPlayed);
  console.log(`    min=${Math.min(...gp)} max=${Math.max(...gp)} avg=${(gp.reduce((a, b) => a + b, 0) / gp.length).toFixed(2)}`);

  console.log("\n[7] LEADERBOARD (top 6)");
  buildLeaderboard(players.filter((p) => p.gamesPlayed > 0))
    .slice(0, 6)
    .forEach((row) =>
      console.log(
        `    #${row.rank} ${row.name.padEnd(12)} W:${row.wins} L:${row.losses}  diff:${row.pointDiff >= 0 ? "+" : ""}${row.pointDiff}  pts:${row.pointsScored}`,
      ),
    );

  console.log("\n" + "=".repeat(64));
  void LEVEL_LABEL;
}

main();
