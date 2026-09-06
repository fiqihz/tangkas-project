// ============================================================================
// Keputusan role invite (fungsi murni, model Fase 2)
// ----------------------------------------------------------------------------
// Modul ini memodelkan aturan role invite pada Fase 2 sebagai fungsi murni agar
// dapat diuji lewat property-based testing tanpa menyentuh Supabase.
//
// Aturan Fase 2 (satu sumber kebenaran keputusan role di sisi aplikasi):
//   - Setiap invite yang dibuat SELALU ber-role "admin". Ini mencerminkan
//     `repo.createInvite` yang meng-hardcode `role: "admin"` saat INSERT.
//   - Basis data juga memaksa hal ini lewat `CHECK (role = 'admin')` pada
//     tabel `invite` (migration 012) dan policy RLS insert `role='admin'`
//     (migration 013). Jadi role selain "admin" (mis. "member", "owner") ditolak.
//
// Karena `repo.createInvite` memanggil DB langsung, terdapat sedikit duplikasi
// kontrak yang tak terelakkan; modul ini menjaga model tetap selaras dengan
// kontrak repo + DB tersebut.
// ============================================================================

/** Role yang dipaksa untuk semua invite di Fase 2. */
export const PHASE2_INVITE_ROLE = "admin" as const;

export type InviteRole = typeof PHASE2_INVITE_ROLE;

/**
 * Resolusi role invite Fase 2.
 *
 * Untuk sembarang role yang diminta (atau tanpa permintaan), keputusan selalu
 * "admin" — mereplikasi `repo.createInvite` yang meng-hardcode `role: "admin"`.
 *
 * @param _requested role yang diminta pemanggil; sengaja diabaikan karena Fase 2
 *   memaksa "admin". Parameter dipertahankan agar tanda tangan cocok dengan
 *   permukaan pemanggilan yang mungkin mengirim role.
 */
export function resolveInviteRole(_requested?: string): InviteRole {
  return PHASE2_INVITE_ROLE;
}

/**
 * Apakah sebuah role diizinkan tersimpan pada baris invite Fase 2.
 *
 * Memodelkan `CHECK (role = 'admin')` (migration 012) + policy RLS insert
 * `role='admin'` (migration 013): hanya "admin" yang diterima, role lain
 * (mis. "member", "owner", string acak) ditolak.
 */
export function assertInviteRoleAllowed(role: string): boolean {
  return role === PHASE2_INVITE_ROLE;
}
