import {
  LEVEL_WEIGHT,
  type Level,
  type MatchMode,
  type SessionPlayer,
} from "./types";

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

// ============================================================================
// Mode match (Batch G) — validitas & preferensi per mode
// ============================================================================

/** Apakah pemain tergolong "kuat" (untuk mode gendongan). */
export function isStrong(p: SessionPlayer): boolean {
  return p.level === "intermediate" || p.level === "advanced";
}

/** Apakah sebuah tim = 1 kuat + 1 lemah (gendongan). */
function isCarryTeam(a: SessionPlayer, b: SessionPlayer): boolean {
  return isStrong(a) !== isStrong(b); // tepat satu yang kuat
}

/**
 * Validitas matchup untuk mode tertentu (HARD rule per mode).
 * - balanced/kelas/gendongan/mixed: Newbie+Newbie tetap dilarang.
 * - ladies (ganda putri): semua wanita, Newbie+Newbie DI-RELAX (boleh).
 */
export function isValidMatchupForMode(
  a1: SessionPlayer,
  a2: SessionPlayer,
  b1: SessionPlayer,
  b2: SessionPlayer,
  mode: MatchMode,
): boolean {
  const four = [a1, a2, b1, b2];

  if (mode === "ladies") {
    // Ganda putri: keempat pemain harus wanita. Newbie+Newbie di-relax.
    return four.every((p) => p.gender === "female");
  }

  if (mode === "mixed") {
    // Ganda campuran: tiap tim harus 1 male + 1 female.
    const mixedTeam = (x: SessionPlayer, y: SessionPlayer) =>
      (x.gender === "male" && y.gender === "female") ||
      (x.gender === "female" && y.gender === "male");
    if (!mixedTeam(a1, a2) || !mixedTeam(b1, b2)) return false;
    return isValidMatchup(a1, a2, b1, b2); // Newbie rule tetap berlaku
  }

  if (mode === "gendongan") {
    if (!isCarryTeam(a1, a2) || !isCarryTeam(b1, b2)) return false;
    return isValidMatchup(a1, a2, b1, b2);
  }

  if (mode === "kelas") {
    // "Sesuai kelas" = level yang SAMA saling bertemu (Int vs Int, Adv vs Adv).
    // Bukan sekadar tiap tim seragam — kedua tim & keempat pemain harus level
    // yang sama. Newbie dikecualikan dari aturan ini (tidak boleh sesama
    // Newbie), jadi Newbie ditangani lewat isValidMatchup + skor preferensi.
    const nonNewbie = four.filter((p) => p.level !== "newbie");
    if (nonNewbie.length > 0) {
      // Semua pemain non-Newbie harus level identik. Bila ada campuran
      // (mis. Intermediate & Advanced), tolak.
      const lvl = nonNewbie[0].level;
      if (!nonNewbie.every((p) => p.level === lvl)) return false;
    }
    // Bila keempatnya non-Newbie & sudah lolos di atas, tiap tim otomatis
    // sama level. Tetap validasi hard rule Newbie+Newbie.
    return isValidMatchup(a1, a2, b1, b2);
  }

  // balanced (default)
  return isValidMatchup(a1, a2, b1, b2);
}
