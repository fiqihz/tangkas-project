// Model murni (tanpa DB) yang mereplikasi keputusan RPC `redeem_invite`
// (migration 015, BAGIAN 3) untuk keperluan property-based test.
//
// Sumber kebenaran: supabase/migrations/015_rpc_onboarding_invite.sql →
// fungsi public.redeem_invite(p_token text). Model ini HANYA memodelkan cabang
// keputusan berbasis state invite + membership store; ia tidak menyentuh
// jaringan/DB agar dapat diuji secara deterministik.
//
// Referensi desain: design.md → "Invite Flow → redeem" dan
// _Requirements: 6.5, 6.6, 6.7, 6.8_.

/** Status invite sebagaimana kolom `invite.status` pada skema. */
export type InviteStatus = "pending" | "accepted" | "expired" | "revoked";

/** State satu baris invite yang relevan untuk keputusan redeem. */
export interface InviteState {
  status: InviteStatus;
  /** `expires_at` sebagai epoch milidetik (setara `expires_at < now()`). */
  expiresAt: number;
}

/**
 * Store membership sederhana untuk mengecek idempotensi unik `(userId,
 * communityId)`. Merepresentasikan constraint `unique (user_id, community_id)`
 * plus `on conflict do nothing` pada insert membership RPC.
 */
export class MembershipStore {
  private readonly keys = new Set<string>();

  private static key(userId: string, communityId: string): string {
    // Pemisah yang tidak mungkin muncul di UUID agar tidak ada tabrakan kunci.
    return `${userId}\u0000${communityId}`;
  }

  /** Jumlah baris membership untuk pasangan `(userId, communityId)` (0 atau 1). */
  count(userId: string, communityId: string): number {
    return this.keys.has(MembershipStore.key(userId, communityId)) ? 1 : 0;
  }

  /** Total baris membership pada store. */
  size(): number {
    return this.keys.size;
  }

  /**
   * Sisipkan membership secara idempoten. Meniru `insert ... on conflict
   * (user_id, community_id) do nothing`: hanya menambah bila belum ada.
   */
  insertIgnoreConflict(userId: string, communityId: string): void {
    this.keys.add(MembershipStore.key(userId, communityId));
  }
}

/** Alasan penolakan redeem, sepadan dengan `reason` pada jsonb balikan RPC. */
export type RedeemReason =
  | "not_authenticated"
  | "not_found"
  | "used"
  | "expired";

/** Hasil redeem — cermin `{ ok, reason?, communityId? }` dari RPC. */
export type RedeemResult =
  | { ok: true; communityId: string }
  | { ok: false; reason: RedeemReason };

/**
 * Replika murni dari cabang keputusan `redeem_invite`.
 *
 * Efek samping deterministik pada argumen (meniru transaksi RPC):
 * - Cabang `expired`: menandai `state.status = 'expired'`, TIDAK menyentuh
 *   membership store. (Req 6.7)
 * - Cabang sukses: sisipkan membership `admin` idempoten (`on conflict do
 *   nothing`) lalu tandai `state.status = 'accepted'`. (Req 6.5, 6.6)
 * - Cabang `used` (status ≠ 'pending'): tolak tanpa mengubah membership. (Req 6.8)
 *
 * @param state       state invite (dimutasi sesuai transisi RPC)
 * @param now         waktu sekarang (epoch ms), setara `now()`
 * @param userId      `auth.uid()` pemanggil (kosong → not_authenticated)
 * @param communityId `invite.community_id` tujuan membership
 * @param members     store membership bersama untuk cek unik/idempotensi
 */
export function redeemInvite(
  state: InviteState,
  now: number,
  userId: string,
  communityId: string,
  members: MembershipStore,
): RedeemResult {
  // 0. Harus terautentikasi (RPC: `if v_uid is null`).
  if (userId === "") {
    return { ok: false, reason: "not_authenticated" };
  }

  // (Cabang `not_found` ada di RPC saat token tak ada; pada model murni state
  // selalu diberikan, jadi tidak dimodelkan di sini — lihat catatan modul.)

  // 3. Sudah dipakai/dicabut/kedaluwarsa tercatat → tolak. (Req 6.8)
  if (state.status !== "pending") {
    return { ok: false, reason: "used" };
  }

  // 4. Kedaluwarsa → tandai 'expired', tolak, TIDAK buat membership. (Req 6.7)
  if (state.expiresAt < now) {
    state.status = "expired";
    return { ok: false, reason: "expired" };
  }

  // 5. Valid → membership 'admin' idempoten + tandai 'accepted'. (Req 6.5, 6.6)
  members.insertIgnoreConflict(userId, communityId);
  state.status = "accepted";
  return { ok: true, communityId };
}
