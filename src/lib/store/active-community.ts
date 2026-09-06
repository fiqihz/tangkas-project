/**
 * Resolusi konteks `active_community` — fungsi murni (tanpa I/O).
 *
 * Modul ini sengaja dibuat terpisah dari `auth-store.ts`:
 * - Tanpa direktif `"use client"`.
 * - Tanpa import zustand/supabase.
 *
 * Dengan demikian fungsi di bawah bisa diimpor & diuji (mis. property test
 * Task 7.3) tanpa memicu efek samping berat dari store klien.
 *
 * Kontrak murni: fungsi TIDAK menyentuh localStorage. Ia hanya menerima
 * `storedId` (nilai yang sudah dibaca pemanggil) dan mengembalikan pilihan.
 */

/**
 * Bentuk minimal yang dibutuhkan resolusi active_community.
 *
 * Sengaja hanya bergantung pada `communityId` agar fungsi tetap murni dan
 * mudah diuji. Tipe `Membership` di `repo.ts` merupakan superset dari bentuk
 * ini sehingga bisa langsung dilewatkan.
 */
export interface HasCommunityId {
  communityId: string;
}

/**
 * Tentukan community aktif secara deterministik dari daftar membership.
 *
 * Aturan (design "Correctness Properties → Property 6", Req 8.1 & 8.5):
 * - Daftar kosong → `null`.
 * - `storedId` masih ada di daftar → pilih `storedId`.
 * - Selain itu → pilih membership pertama.
 * - Konsekuensinya, untuk daftar berukuran satu hasilnya selalu community
 *   tunggal itu (kecuali `storedId` kebetulan sama, hasilnya tetap sama).
 *
 * @param memberships daftar membership (cukup punya `communityId`).
 * @param storedId    id community tersimpan terakhir, atau `null`.
 * @returns id community aktif, atau `null` bila daftar kosong.
 */
export function resolveActiveCommunity(
  memberships: readonly HasCommunityId[],
  storedId: string | null,
): string | null {
  if (memberships.length === 0) return null;
  if (storedId && memberships.some((m) => m.communityId === storedId)) {
    return storedId;
  }
  return memberships[0].communityId;
}
