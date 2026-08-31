import { MatchHistory } from "./history";
import { sortByQueuePriority } from "./queue";
import { isValidMatchupForMode, teamImbalance } from "./rules";
import {
  DEFAULT_CONFIG,
  type MatchmakingConfig,
  type MatchMode,
  type SessionPlayer,
} from "./types";

/** Hasil pembentukan sebuah match: 4 pemain terbagi jadi 2 tim. */
export interface ProposedMatch {
  teamA: [string, string];
  teamB: [string, string];
  imbalance: number;
  score: number; // total penalti (makin kecil makin baik)
}

/** Kombinasi cara membagi 4 pemain (indeks 0..3) menjadi 2 tim. */
const TEAM_SPLITS: ReadonlyArray<[[number, number], [number, number]]> = [
  [
    [0, 1],
    [2, 3],
  ],
  [
    [0, 2],
    [1, 3],
  ],
  [
    [0, 3],
    [1, 2],
  ],
];

/**
 * Hitung skor penalti sebuah pembagian tim untuk 4 pemain.
 * Mengembalikan null bila melanggar hard rule (Newbie+Newbie).
 */
function scoreSplit(
  a1: SessionPlayer,
  a2: SessionPlayer,
  b1: SessionPlayer,
  b2: SessionPlayer,
  history: MatchHistory,
  cfg: MatchmakingConfig,
  mode: MatchMode,
): number | null {
  if (!isValidMatchupForMode(a1, a2, b1, b2, mode)) return null;

  const rawImbalance = teamImbalance(a1, a2, b1, b2);
  // Toleransi: selisih bobot <= tolerance dianggap "sama-sama seimbang"
  // (efektif 0). Ini membuat mis. Advanced+Advanced vs Advanced+Beginner
  // (selisih 2) tidak dihukum, sehingga Advanced bisa lawan sesama kelas —
  // tidak selalu digendong. Selisih besar (>= 3) tetap dihindari.
  const imbalance = Math.max(0, rawImbalance - cfg.imbalanceTolerance);
  let score = imbalance * cfg.balanceWeight;

  // penalti pengulangan partner
  score += history.partners(a1.id, a2.id) * cfg.repeatPartnerWeight;
  score += history.partners(b1.id, b2.id) * cfg.repeatPartnerWeight;

  // penalti pengulangan lawan
  for (const a of [a1, a2]) {
    for (const b of [b1, b2]) {
      score += history.opponents(a.id, b.id) * cfg.repeatOpponentWeight;
    }
  }

  return score;
}

/**
 * Dari 4 pemain, cari pembagian tim terbaik (2 tim) yang tidak melanggar
 * hard rule. Mengembalikan null bila keempatnya tidak bisa membentuk match
 * yang valid (mis. semua Newbie).
 */
export function bestSplitForFour(
  four: SessionPlayer[],
  history: MatchHistory,
  cfg: MatchmakingConfig = DEFAULT_CONFIG,
  mode: MatchMode = "balanced",
): ProposedMatch | null {
  if (four.length !== 4) return null;

  let best: ProposedMatch | null = null;
  for (const [[i, j], [k, l]] of TEAM_SPLITS) {
    const s = scoreSplit(four[i], four[j], four[k], four[l], history, cfg, mode);
    if (s === null) continue;
    if (best === null || s < best.score) {
      best = {
        teamA: [four[i].id, four[j].id],
        teamB: [four[k].id, four[l].id],
        imbalance: teamImbalance(four[i], four[j], four[k], four[l]),
        score: s,
      };
    }
  }
  return best;
}

/** Ambil `n` pemain teratas dari antrian sebagai kandidat inti. */
function pickCandidatePlayers(
  pool: SessionPlayer[],
  currentRound: number,
  cfg: MatchmakingConfig,
): SessionPlayer[] {
  // Prioritas antrian, lalu tambahkan penalti "baru selesai main" secara
  // lembut: pemain yang main di ronde tepat sebelumnya digeser sedikit ke
  // belakang, tanpa mengubah prioritas utama (jatah main).
  const sorted = sortByQueuePriority(pool);
  return sorted.slice().sort((a, b) => {
    const aJust = a.lastPlayedRound === currentRound - 1 ? cfg.justPlayedPenalty : 0;
    const bJust = b.lastPlayedRound === currentRound - 1 ? cfg.justPlayedPenalty : 0;
    // pertahankan urutan utama; penalti hanya jadi tie-breaker halus
    if (aJust !== bJust) return aJust - bJust;
    return 0;
  });
}

/**
 * Bentuk satu match dari pool pemain yang tersedia.
 *
 * Strategi:
 *  - Ambil kelompok kandidat teratas (berdasarkan prioritas antrian).
 *  - Coba banyak kombinasi 4 pemain dari kandidat tsb, skor tiap kombinasi
 *    (keseimbangan + anti-repeat), pilih yang terbaik & valid.
 *  - Bias ke arah pemain paling depan antrian lewat penalti indeks, supaya
 *    yang paling lama menunggu tetap diutamakan.
 *
 * Mengembalikan null bila tidak ada 4 pemain yang bisa membentuk match valid.
 */
export function generateMatch(
  pool: SessionPlayer[],
  history: MatchHistory,
  currentRound: number,
  cfg: MatchmakingConfig = DEFAULT_CONFIG,
  mode: MatchMode = "balanced",
): ProposedMatch | null {
  if (pool.length < 4) return null;

  const candidates = pickCandidatePlayers(pool, currentRound, cfg);
  // Batasi ruang pencarian pada kandidat teratas untuk menjaga performa.
  // Untuk mode dengan constraint komposisi (gender/gendongan/kelas), lebarkan
  // window agar lebih mungkin menemukan kombinasi valid.
  const windowSize = mode === "balanced" ? 10 : 14;
  const window = candidates.slice(0, Math.min(candidates.length, windowSize));

  let best: (ProposedMatch & { queuePenalty: number }) | null = null;
  let bestTotal = Infinity;

  const combos = combinationsOfFour(window.length);
  const tried = combos.length <= cfg.candidateSamples ? combos : sample(combos, cfg.candidateSamples);

  for (const [i, j, k, l] of tried) {
    const four = [window[i], window[j], window[k], window[l]];
    const split = bestSplitForFour(four, history, cfg, mode);
    if (!split) continue;

    // Penalti antrian: makin ke belakang indeks pemain, makin besar penalti,
    // sehingga pemain terdepan (jatah paling sedikit) diprioritaskan.
    const queuePenalty = i + j + k + l;

    // Penalti "baru selesai main": tiap pemain di kombinasi ini yang baru
    // main di ronde sebelumnya menambah penalti. Ini bikin sistem lebih
    // memilih merotasi pemain yang sudah beristirahat, selama masih ada
    // pilihan lain. Kalau memang tidak ada pemain lain, kombinasi ini tetap
    // terpakai (penalti tidak memblokir).
    const justPlayedPenalty = four.reduce(
      (sum, p) => sum + (p.lastPlayedRound === currentRound - 1 ? cfg.justPlayedPenalty : 0),
      0,
    );

    const total = split.score + queuePenalty + justPlayedPenalty;

    if (best === null || total < bestTotal) {
      best = { ...split, score: split.score, queuePenalty };
      bestTotal = total;
    }
  }

  if (!best) return null;
  const { queuePenalty: _qp, ...rest } = best;
  void _qp;
  return rest;
}

/** Semua kombinasi 4 indeks dari 0..n-1. */
function combinationsOfFour(n: number): Array<[number, number, number, number]> {
  const out: Array<[number, number, number, number]> = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      for (let k = j + 1; k < n; k++)
        for (let l = k + 1; l < n; l++) out.push([i, j, k, l]);
  return out;
}

/** Ambil sampel acak (deterministik-ish) dari array kombinasi. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const copy = [...arr];
  const out: T[] = [];
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < n && copy.length > 0; i++) {
    const idx = Math.floor(rand() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}
