// ============================================================================
// Pool insight (Poin 3 — A & C)
//
// Kumpulan fungsi MURNI untuk:
//  - meringkas komposisi pemain yang MENUNGGU (total + breakdown gender/level),
//  - mengecek apakah sebuah mode match FEASIBLE dari pool saat ini (dry-run,
//    tanpa menyentuh DB / tanpa nge-persist apa pun).
//
// Dipakai oleh CourtsScreen: panel ringkasan antrian (C) dan mode picker yang
// "sadar ketersediaan" (A). Sengaja tidak bergantung ke store agar mudah diuji.
// ============================================================================

import { MatchHistory } from "./history";
import { generateMatch } from "./matchmaking";
import { availablePool } from "./queue";
import type { Level, MatchMode, SessionPlayer } from "./types";

/** Ringkasan komposisi pemain yang menunggu (siap dipertimbangkan). */
export interface WaitingSummary {
  /** Pemain active yang tidak sedang main (menunggu), termasuk yang belum ber-level. */
  waitingTotal: number;
  /** Menunggu DAN sudah ber-level (bisa ikut auto-matchmaking). */
  readyLeveled: number;
  /** Menunggu tapi belum di-set level (belum bisa ikut auto). */
  noLevel: number;
  /** Breakdown gender pemain menunggu (semua status level). */
  byGender: { male: number; female: number; unknown: number };
  /** Breakdown level pemain menunggu (unknown = level null). */
  byLevel: Record<Level, number> & { unknown: number };
}

/**
 * Kelayakan sebuah mode:
 *  - "ok"          : bisa langsung dari pemain menunggu (tanpa pinjam).
 *  - "needsBorrow" : tak bisa dari menunggu saja, TAPI bisa bila meminjam
 *                    pemain yang sedang main (Poin D — akan minta konfirmasi).
 *  - "impossible"  : tak bisa walau semua kandidat pinjam ikut.
 */
export type FeasibilityState = "ok" | "needsBorrow" | "impossible";

export interface ModeFeasibility {
  state: FeasibilityState;
  /** Alasan singkat (untuk subtext di picker). null bila "ok". */
  hint: string | null;
}

/**
 * Pemain yang MENUNGGU = active & tidak ada di set `busyIds`
 * (busyIds berisi pemain yang sedang di match proposed/playing).
 */
export function waitingPlayers(
  players: SessionPlayer[],
  busyIds: Set<string>,
): SessionPlayer[] {
  return players.filter((p) => p.status === "active" && !busyIds.has(p.id));
}

/** Hitung ringkasan komposisi pemain menunggu. */
export function summarizeWaiting(
  players: SessionPlayer[],
  busyIds: Set<string>,
): WaitingSummary {
  const waiting = waitingPlayers(players, busyIds);
  const byGender = { male: 0, female: 0, unknown: 0 };
  const byLevel: WaitingSummary["byLevel"] = {
    newbie: 0,
    beginner: 0,
    intermediate: 0,
    advanced: 0,
    unknown: 0,
  };

  let readyLeveled = 0;
  let noLevel = 0;

  for (const p of waiting) {
    if (p.gender === "male") byGender.male += 1;
    else if (p.gender === "female") byGender.female += 1;
    else byGender.unknown += 1;

    if (p.level === null) {
      byLevel.unknown += 1;
      noLevel += 1;
    } else {
      byLevel[p.level] += 1;
      readyLeveled += 1;
    }
  }

  return {
    waitingTotal: waiting.length,
    readyLeveled,
    noLevel,
    byGender,
    byLevel,
  };
}

/**
 * Cek apakah sebuah mode feasible dari pool pemain menunggu (ber-level).
 * Dry-run: memanggil generateMatch sekali. Tidak menyentuh DB.
 *
 * `round` dipakai apa adanya untuk penalti antrian — nilai persis tidak
 * mengubah hasil feasible/tidak, jadi caller boleh pakai ronde berjalan + 1.
 */
export function modeFeasibility(
  players: SessionPlayer[],
  busyIds: Set<string>,
  mode: MatchMode,
  round: number,
  /**
   * Kandidat pemain SEDANG MAIN yang boleh dipinjam (Poin D). Bila diberikan,
   * feasibility ikut mempertimbangkan skenario pinjam sebelum menyerah —
   * supaya badge konsisten dengan autofill yang memang bisa meminjam.
   */
  reservable: SessionPlayer[] = [],
): ModeFeasibility {
  const history = MatchHistory.fromMatches([]); // riwayat tak relevan untuk feasibility
  const waiting = availablePool(players, {
    requireLevel: true,
    excludeIds: busyIds,
  });

  // 1. Bisa dari pemain menunggu saja?
  if (
    waiting.length >= 4 &&
    generateMatch(waiting, history, round, undefined, mode)
  ) {
    return { state: "ok", hint: null };
  }

  // 2. Bisa bila meminjam pemain yang sedang main? (Poin D)
  // reservable berisi pemain yang sedang main (busy) tapi layak dipinjam.
  const withBorrow = [...waiting, ...reservable.filter((p) => p.level !== null)];
  if (
    withBorrow.length >= 4 &&
    generateMatch(withBorrow, history, round, undefined, mode)
  ) {
    return { state: "needsBorrow", hint: hintForMode(waiting, mode) };
  }

  // 3. Tak bisa walau dipinjam.
  return { state: "impossible", hint: hintForMode(waiting, mode) };
}

/** Hitung feasibility untuk semua mode sekaligus. */
export function feasibilityForModes(
  players: SessionPlayer[],
  busyIds: Set<string>,
  modes: readonly MatchMode[],
  round: number,
  reservable: SessionPlayer[] = [],
): Record<MatchMode, ModeFeasibility> {
  const out = {} as Record<MatchMode, ModeFeasibility>;
  for (const m of modes)
    out[m] = modeFeasibility(players, busyIds, m, round, reservable);
  return out;
}

/** Alasan singkat kenapa mode tak bisa terbentuk, dari komposisi pool. */
function hintForMode(pool: SessionPlayer[], mode: MatchMode): string {
  const female = pool.filter((p) => p.gender === "female").length;
  const male = pool.filter((p) => p.gender === "male").length;
  const strong = pool.filter(
    (p) => p.level === "intermediate" || p.level === "advanced",
  ).length;
  const weak = pool.filter(
    (p) => p.level === "newbie" || p.level === "beginner",
  ).length;

  switch (mode) {
    case "ladies":
      return `cewek siap ${female}/4`;
    case "mixed":
      return `cowok ${male} · cewek ${female} (tiap tim butuh 1+1)`;
    case "gendongan":
      return `kuat ${strong} · lemah ${weak} (tiap tim 1+1)`;
    case "kelas":
      return "level pemain siap belum cocok satu kelas";
    default:
      return "kombinasi valid tak ditemukan";
  }
}
