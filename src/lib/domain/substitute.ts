import { MatchHistory } from "./history";
import { sortByQueuePriority } from "./queue";
import { isValidPartnerPair, teamImbalance } from "./rules";
import {
  DEFAULT_CONFIG,
  type MatchmakingConfig,
  type SessionPlayer,
} from "./types";

/**
 * Cari pengganti terbaik untuk seorang pemain yang keluar dari sebuah match
 * yang BELUM dimulai (proposed). Dipakai saat pemain minta Rest sesaat
 * setelah di-generate.
 *
 * Match terdiri dari 4 pemain; salah satu (`leavingId`) diganti. Kita cari
 * kandidat dari pool menunggu dengan prioritas:
 *   1. prioritas antrian (jatah main tersedikit, paling lama menunggu)
 *   2. bukan yang baru selesai main di ronde sebelumnya
 *   3. tidak melanggar hard rule (Newbie+Newbie) di posisinya
 *   4. menjaga match tetap seimbang (imbalance terkecil)
 *
 * Mengembalikan id pengganti, atau null bila tidak ada kandidat valid.
 */
export function findSubstitute(params: {
  match: { teamA: [string, string]; teamB: [string, string] };
  leavingId: string;
  pool: SessionPlayer[]; // pemain active yang sedang menunggu (tidak sedang main)
  byId: Map<string, SessionPlayer>;
  history: MatchHistory;
  currentRound: number;
  cfg?: MatchmakingConfig;
}): string | null {
  const cfg = params.cfg ?? DEFAULT_CONFIG;
  const { match, leavingId, pool, byId, history, currentRound } = params;

  // Tentukan partner & lawan dari pemain yang keluar.
  const all = [...match.teamA, ...match.teamB];
  const leavingTeam = match.teamA.includes(leavingId) ? match.teamA : match.teamB;
  const otherTeam = match.teamA.includes(leavingId) ? match.teamB : match.teamA;
  const partnerId = leavingTeam.find((id) => id !== leavingId);
  const remaining = all.filter((id) => id !== leavingId);

  // Pengaman: bila ada pemain di match yang tidak ada di roster (mis. sudah
  // dihapus, atau data players basi relatif terhadap matches), jangan crash —
  // anggap tidak ada pengganti valid. Sebelumnya ini pakai non-null assertion
  // (`byId.get(...)!`) yang bisa melempar TypeError saat diakses .level/.id.
  const partner = partnerId ? byId.get(partnerId) : undefined;
  const opp1 = byId.get(otherTeam[0]);
  const opp2 = byId.get(otherTeam[1]);
  if (!partner || !opp1 || !opp2) return null;

  const ranked = sortByQueuePriority(pool);

  let best: { id: string; cost: number } | null = null;

  ranked.forEach((cand, index) => {
    if (remaining.includes(cand.id)) return;

    // Hard rule: pengganti tidak boleh membentuk Newbie+Newbie dengan partner.
    if (!isValidPartnerPair(partner, cand)) return;

    // Hitung keseimbangan match setelah penggantian.
    const imbalance = teamImbalance(partner, cand, opp1, opp2);

    let cost = index; // prioritas antrian (indeks kecil = lebih baik)
    cost += imbalance * cfg.balanceWeight;
    if (cand.lastPlayedRound === currentRound - 1) cost += cfg.justPlayedPenalty;
    cost += history.partners(partner.id, cand.id) * cfg.repeatPartnerWeight;
    cost += history.opponents(opp1.id, cand.id) * cfg.repeatOpponentWeight;
    cost += history.opponents(opp2.id, cand.id) * cfg.repeatOpponentWeight;

    if (best === null || cost < best.cost) {
      best = { id: cand.id, cost };
    }
  });

  return best ? (best as { id: string }).id : null;
}
