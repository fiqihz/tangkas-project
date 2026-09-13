import type { Match, SessionPlayer } from "./types";

/**
 * Basis poin per match yang tertinggal, dipakai bila belum ada data match
 * (fallback). Nilainya ~ rata-rata poin ideal per set (skor kemenangan 21).
 * Bila ada match selesai, basis bonus DIHITUNG dari rata-rata poin-per-set liga.
 */
export const MISSED_MATCH_FALLBACK_BONUS = 21;

/** Statistik ternormalisasi per pemain (basis: rata-rata poin per set). */
interface PerSetStat {
  scored: number;
  conceded: number;
  played: number;
}

/**
 * Hasil agregasi per-set untuk seluruh sesi:
 *   - perPlayer: map playerId -> stat ternormalisasi (poin per set)
 *   - avgPointsPerSet: rata-rata poin-per-set liga (basis bonus +M)
 */
interface PerSetAggregate {
  perPlayer: Map<string, PerSetStat>;
  avgPointsPerSet: number;
}

/** Baris leaderboard untuk satu pemain. */
export interface LeaderboardRow {
  playerId: string;
  name: string;
  wins: number;
  losses: number;
  draws: number;
  played: number;
  /** Total poin ternormalisasi (rata-rata per set) + bonus — nilai desimal penuh untuk sort. */
  pointsScored: number;
  pointsConceded: number;
  /** Selisih poin ternormalisasi (scored - conceded) — nilai desimal penuh untuk sort. */
  pointDiff: number;
  /** Bonus poin karena jatah main tertinggal (desimal penuh). */
  bonus: number;
  /** Poin dibulatkan untuk ditampilkan. */
  pointsDisplay: number;
  /** Selisih poin dibulatkan untuk ditampilkan. */
  pointDiffDisplay: number;
  /** Bonus dibulatkan untuk ditampilkan. */
  bonusDisplay: number;
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
 * Hitung statistik ternormalisasi per-set dari daftar match yang SELESAI.
 *
 * Kenapa per-set: match Best-of-3 yang berakhir 1-1 lalu lanjut ke set ke-3
 * mengumpulkan ~50% poin lebih banyak dibanding match yang selesai 2 set,
 * padahal itu murni efek format, bukan performa. Membagi total tim dengan
 * jumlah set membuat match 2-set dan 3-set setara skalanya (Opsi A + C).
 *
 * avgPointsPerSet dipakai sebagai basis bonus +M agar satuannya nyambung
 * dengan poin ternormalisasi (sama-sama "poin per set").
 */
export function perSetPlayerStats(matches: Match[]): PerSetAggregate {
  const perPlayer = new Map<string, PerSetStat>();
  let leagueSetPointsTotal = 0; // jumlah (poin per tim per set) untuk rata-rata liga
  let leagueSetSamples = 0; // jumlah "sisi tim per set" yang tercatat

  const add = (
    playerId: string,
    scored: number,
    conceded: number,
  ) => {
    const cur = perPlayer.get(playerId) ?? { scored: 0, conceded: 0, played: 0 };
    cur.scored += scored;
    cur.conceded += conceded;
    cur.played += 1;
    perPlayer.set(playerId, cur);
  };

  for (const m of matches) {
    if (m.state !== "finished" || !m.score) continue;

    // Jumlah set: pakai panjang `sets` bila ada, jika tidak anggap 1 set
    // (match lama Best-of-1 / pre multi-set). Minimal 1 agar tidak bagi nol.
    const setCount = m.sets && m.sets.length > 0 ? m.sets.length : 1;

    // Total tim dari agregat, dibagi jumlah set = rata-rata poin per set.
    const perSetA = m.score.a / setCount;
    const perSetB = m.score.b / setCount;

    for (const pid of m.teamA.playerIds) add(pid, perSetA, perSetB);
    for (const pid of m.teamB.playerIds) add(pid, perSetB, perSetA);

    // Akumulasi untuk rata-rata liga: dua sisi tim per match.
    leagueSetPointsTotal += perSetA + perSetB;
    leagueSetSamples += 2;
  }

  const avgPointsPerSet =
    leagueSetSamples > 0
      ? leagueSetPointsTotal / leagueSetSamples
      : MISSED_MATCH_FALLBACK_BONUS;

  return { perPlayer, avgPointsPerSet };
}

/**
 * Bangun leaderboard terurut.
 *
 * Bila `matches` diberikan, poin & selisih dinormalisasi ke basis rata-rata
 * per set (Opsi A + C) dan bonus +M memakai rata-rata poin-per-set liga.
 * Bila `matches` tidak diberikan, fallback ke skema lama (total mentah dari
 * kolom pemain) demi kompatibilitas pemanggil yang belum mengirim match.
 *
 * Urutan (tie-break), memakai nilai desimal penuh:
 *   1. total Poin (poin ternormalisasi + bonus) desc
 *   2. selisih poin ternormalisasi desc
 *   3. nama asc (stabil)
 * Jumlah menang TIDAK dipakai sebagai penentu urutan.
 */
export function buildLeaderboard(
  players: SessionPlayer[],
  matches?: Match[],
): LeaderboardRow[] {
  const agg = matches ? perSetPlayerStats(matches) : null;

  // Jatah main terbanyak di antara semua pemain (untuk hitung bonus tertinggal).
  const maxPlayed = players.reduce(
    (m, p) => Math.max(m, p.wins + p.losses + p.draws),
    0,
  );

  // Basis bonus per match tertinggal: rata-rata poin-per-set liga bila ada
  // data match, atau fallback konstan bila tidak.
  const bonusBase = agg ? agg.avgPointsPerSet : MISSED_MATCH_FALLBACK_BONUS;

  const rows: Omit<
    LeaderboardRow,
    "rank" | "pointsDisplay" | "pointDiffDisplay" | "bonusDisplay"
  >[] = players.map((p) => {
    const played = p.wins + p.losses + p.draws;

    // Poin ternormalisasi (per set) bila ada match; jika tidak, total mentah.
    const stat = agg?.perPlayer.get(p.id);
    const scored = stat ? stat.scored : p.pointsScored;
    const conceded = stat ? stat.conceded : p.pointsConceded;

    // Bonus: basis (rata-rata poin/set liga) x jumlah match yang tertinggal.
    const bonus = Math.max(0, maxPlayed - played) * bonusBase;
    const winRate = played > 0 ? Math.round((p.wins / played) * 100) : 0;

    return {
      playerId: p.id,
      name: p.name,
      wins: p.wins,
      losses: p.losses,
      draws: p.draws,
      played,
      // Poin = skor ternormalisasi + bonus jatah main tertinggal.
      pointsScored: scored + bonus,
      pointsConceded: conceded,
      // Selisih poin murni (tanpa bonus).
      pointDiff: scored - conceded,
      bonus,
      winRate,
    };
  });

  rows.sort((x, y) => {
    // Sort pakai nilai desimal penuh agar beda tipis tidak jadi seri.
    if (y.pointsScored !== x.pointsScored) return y.pointsScored - x.pointsScored;
    if (y.pointDiff !== x.pointDiff) return y.pointDiff - x.pointDiff;
    return x.name.localeCompare(y.name);
  });

  return rows.map((r, i) => ({
    ...r,
    rank: i + 1,
    // Display dibulatkan; sort tetap pakai nilai desimal di atas.
    pointsDisplay: Math.round(r.pointsScored),
    pointDiffDisplay: Math.round(r.pointDiff),
    bonusDisplay: Math.round(r.bonus),
  }));
}
