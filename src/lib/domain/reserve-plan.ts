// ============================================================================
// Reserve plan (Poin D) — pinjam pemain dari lapangan lain (opt-in)
//
// Saat pemain MENUNGGU cukup jumlahnya (>= 4) tapi mode yang dipilih tidak bisa
// terbentuk karena KOMPOSISI (mis. Ganda Putri butuh 4 cewek, tapi cewek yang
// menunggu cuma 2), host boleh "meminjam" pemain yang SEDANG MAIN di lapangan
// lain untuk match berikutnya. Pemain pinjaman tidak dicabut dari match
// berjalan — hanya di-booking; preview baru bisa dimulai setelah match asalnya
// selesai (mekanisme booking sudah ada di store & UI).
//
// Fungsi ini MURNI (dry-run): mencari kombinasi pemain pinjaman minimal yang
// membuat mode feasible, tanpa menyentuh DB. Keputusan tetap di host (UI
// menampilkan konfirmasi memakai hasil fungsi ini).
// ============================================================================

import { MatchHistory } from "./history";
import { generateMatch } from "./matchmaking";
import type { MatchMode, SessionPlayer } from "./types";

export interface ReservePlan {
  /** Pemain (sedang main) yang perlu dipinjam agar mode bisa terbentuk. */
  borrow: SessionPlayer[];
  /** Total pool bila pinjaman disetujui (menunggu + pinjaman). */
  pool: SessionPlayer[];
}

/**
 * Skor "kecocokan" seorang kandidat pinjaman terhadap kebutuhan komposisi mode.
 * Makin kecil makin diutamakan. Kandidat yang jelas menutup kekurangan
 * (mis. cewek untuk ladies) diberi skor rendah agar dicoba lebih dulu.
 */
function affinity(p: SessionPlayer, mode: MatchMode): number {
  const isFemale = p.gender === "female";
  const isMale = p.gender === "male";
  const isStrong = p.level === "intermediate" || p.level === "advanced";
  const isWeak = p.level === "newbie" || p.level === "beginner";

  switch (mode) {
    case "ladies":
      return isFemale ? 0 : 100; // hanya cewek yang berguna
    case "mixed":
      // Butuh kedua gender; beri sedikit preferensi ke yang ber-gender jelas.
      return isMale || isFemale ? 0 : 50;
    case "gendongan":
      // Butuh campuran kuat & lemah; keduanya berguna.
      return isStrong || isWeak ? 0 : 50;
    default:
      return 0; // balanced/kelas: siapa pun berpotensi menutup kekurangan
  }
}

/**
 * Coba susun rencana pinjaman minimal agar `mode` bisa terbentuk.
 *
 * @param waiting   Pemain menunggu yang sudah ber-level (kandidat utama).
 * @param candidates Pemain yang SEDANG MAIN & layak dipinjam, sudah terurut
 *                   prioritas (mis. durasi match terlama dulu). Harus ber-level.
 * @param mode      Mode yang diminta host.
 * @param round     Nomor ronde (untuk generateMatch; nilai persis tak kritis).
 * @returns ReservePlan bila ditemukan; null bila meski semua kandidat dipinjam
 *          mode tetap tak bisa terbentuk.
 *
 * Catatan: bila `waiting` saja sudah cukup untuk mode (borrow kosong),
 * mengembalikan null — caller tak perlu meminjam (pakai jalur normal).
 */
export function planCompositionReserve(
  waiting: SessionPlayer[],
  candidates: SessionPlayer[],
  mode: MatchMode,
  round: number,
): ReservePlan | null {
  const history = MatchHistory.fromMatches([]);

  // Bila pool menunggu sendiri sudah feasible, tak perlu pinjam.
  if (waiting.length >= 4 && generateMatch(waiting, history, round, undefined, mode)) {
    return null;
  }

  // Urutkan kandidat: prioritas kecocokan komposisi dulu, lalu pertahankan
  // urutan asal (durasi terlama) sebagai tie-break.
  const ordered = candidates
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const da = affinity(a.p, mode);
      const db = affinity(b.p, mode);
      if (da !== db) return da - db;
      return a.i - b.i;
    })
    .map((x) => x.p);

  // Tambahkan kandidat satu per satu hingga mode feasible atau kandidat habis.
  const borrow: SessionPlayer[] = [];
  let pool = [...waiting];

  for (const cand of ordered) {
    pool = [...pool, cand];
    borrow.push(cand);
    if (pool.length < 4) continue;
    if (generateMatch(pool, history, round, undefined, mode)) {
      return { borrow, pool };
    }
  }

  return null; // meski semua dipinjam, mode tetap tak terbentuk
}
