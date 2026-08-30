import type { Match, SessionPlayer } from "./types";

/** Bonus poin per match yang tertinggal dibanding pemain yang paling banyak main. */
export const MISSED_MATCH_BONUS = 25;

/** Baris leaderboard untuk satu pemain. */
export interface LeaderboardRow {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  pointsScored: number;
  pointsConceded: number;
  /** Selisih poin (scored - conceded) — tie-break ke-2. */
  pointDiff: number;
  /** Bonus poin karena jatah main tertinggal (25 x match tertinggal). */
  bonus: number;
  /** Win rate persen (menang / main * 100), 0 bila belum main. */
  winRate: number;
  rank: number;
}

/**
 * Terapkan hasil sebuah match yang selesai ke statistik pemain.
 * Menghasilkan salinan pemain yang sudah di-update (immutable).
 * Kemenangan berlaku untuk 2 pemain di tim menang (ganda).
 */
export function applyMatchResult(
  players: SessionPlayer[],
  match: Match,
): SessionPlayer[] {
  if (match.state !== "finished" || !match.score || !match.winner) {
    return players;
  }
  const { a, b } = match.score;
  const teamA = new Set(match.teamA.playerIds);
  const teamB = new Set(match.teamB.playerIds);

  return players.map((p) => {
    const inA = teamA.has(p.id);
    const inB = teamB.has(p.id);
    if (!inA && !inB) return p;

    const scored = inA ? a : b;
    const conceded = inA ? b : a;
    const won =
      (inA && match.winner === "a") || (inB && match.winner === "b");
    const lost =
      (inA && match.winner === "b") || (inB && match.winner === "a");
    const drew = match.winner === "draw";

    return {
      ...p,
      wins: p.wins + (won ? 1 : 0),
      losses: p.losses + (lost ? 1 : 0),
      draws: p.draws + (drew ? 1 : 0),
      pointsScored: p.pointsScored + scored,
      pointsConceded: p.pointsConceded + conceded,
    };
  });
}

/**
 * Bangun leaderboard terurut dengan tie-break:
 *   1. jumlah menang (desc)
 *   2. selisih poin scored-conceded (desc)
 *   3. total poin scored (desc)
 *   4. nama (asc, stabil)
 */
export function buildLeaderboard(players: SessionPlayer[]): LeaderboardRow[] {
  // Jatah main terbanyak di antara semua pemain (untuk hitung bonus tertinggal).
  const maxPlayed = players.reduce(
    (m, p) => Math.max(m, p.wins + p.losses + p.draws),
    0,
  );

  const rows: Omit<LeaderboardRow, "rank">[] = players.map((p) => {
    const played = p.wins + p.losses + p.draws;
    // Bonus: 25 poin untuk setiap match yang tertinggal dari yang terbanyak main.
    const bonus = Math.max(0, maxPlayed - played) * MISSED_MATCH_BONUS;
    const winRate = played > 0 ? Math.round((p.wins / played) * 100) : 0;
    return {
      playerId: p.id,
      name: p.name,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      played,
      pointsScored: p.pointsScored,
      pointsConceded: p.pointsConceded,
      // Selisih poin sudah termasuk bonus (bonus menambah kekuatan poin pemain).
      pointDiff: p.pointsScored - p.pointsConceded + bonus,
      bonus,
      winRate,
    };
  });

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff;
    if (y.pointsScored !== x.pointsScored) return y.pointsScored - x.pointsScored;
    return x.name.localeCompare(y.name);
  });

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}
