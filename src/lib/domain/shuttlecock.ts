// ============================================================================
// Statistik kok (shuttlecock) — Poin 5
//
// Dua angka yang SENGAJA dihitung berbeda dari data match yang sama:
//   - perPlayer : untuk tiap pemain, jumlah kok di SEMUA match yang dia ikut,
//                 memakai angka PENUH per match (bukan dibagi 4). Dipakai host
//                 untuk menagih (mis. 5 kok × harga).
//   - sessionTotal : total kok yang benar-benar dipakai se-mabar = jumlah
//                    match.shuttlecocks sekali per match. Dipakai untuk tahu
//                    berapa kok yang keluar (biaya keseluruhan).
//
// Contoh: 1 match pakai 1 kok utk 4 pemain →
//   perPlayer tiap pemain += 1  (total per-pemain kalau dijumlah = 4)
//   sessionTotal += 1           (yang benar dipakai cuma 1)
// Perbedaan ini disengaja; keduanya menjawab pertanyaan berbeda.
//
// Hanya match 'finished' yang dihitung (match berjalan/preview belum final).
// ============================================================================

import type { Match } from "./types";

export interface ShuttlecockStats {
  /** playerId -> total kok (angka penuh) dari match yang dia ikut. */
  perPlayer: Map<string, number>;
  /** Total kok se-mabar (jumlah match.shuttlecocks, sekali per match). */
  sessionTotal: number;
}

export function shuttlecockStats(matches: Match[]): ShuttlecockStats {
  const perPlayer = new Map<string, number>();
  let sessionTotal = 0;

  for (const m of matches) {
    if (m.state !== "finished") continue;
    const n = m.shuttlecocks ?? 0;
    if (n <= 0) continue;

    sessionTotal += n;

    const ids = [...m.teamA.playerIds, ...m.teamB.playerIds];
    for (const id of ids) {
      perPlayer.set(id, (perPlayer.get(id) ?? 0) + n);
    }
  }

  return { perPlayer, sessionTotal };
}
