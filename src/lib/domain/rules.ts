import { LEVEL_WEIGHT, type Level, type SessionPlayer } from "./types";

/** Bobot numerik dari sebuah level (null dianggap 0 — belum di-set). */
export function levelWeight(level: Level | null): number {
  return level ? LEVEL_WEIGHT[level] : 0;
}

/** Total bobot sebuah tim (2 pemain). */
export function teamWeight(a: SessionPlayer, b: SessionPlayer): number {
  return levelWeight(a.level) + levelWeight(b.level);
}

/** Selisih bobot absolut antara dua tim — makin kecil makin imbang. */
export function teamImbalance(
  a1: SessionPlayer,
  a2: SessionPlayer,
  b1: SessionPlayer,
  b2: SessionPlayer,
): number {
  return Math.abs(teamWeight(a1, a2) - teamWeight(b1, b2));
}

/**
 * HARD RULE: Newbie tidak boleh setim dengan Newbie.
 * Mengembalikan false bila pasangan melanggar aturan.
 */
export function isValidPartnerPair(a: SessionPlayer, b: SessionPlayer): boolean {
  if (a.level === "newbie" && b.level === "newbie") return false;
  return true;
}

/**
 * HARD RULE match penuh: kedua tim harus valid sebagai partner,
 * DAN tidak boleh terjadi format Newbie/Newbie vs Newbie/Newbie.
 * Karena partner-pair Newbie+Newbie sudah dilarang di atas, cukup
 * validasi masing-masing tim.
 */
export function isValidMatchup(
  a1: SessionPlayer,
  a2: SessionPlayer,
  b1: SessionPlayer,
  b2: SessionPlayer,
): boolean {
  return isValidPartnerPair(a1, a2) && isValidPartnerPair(b1, b2);
}

/** Apakah pemain memenuhi syarat masuk auto-generate: Active + sudah ber-level. */
export function isEligibleForAuto(p: SessionPlayer): boolean {
  return p.status === "active" && p.level !== null;
}
