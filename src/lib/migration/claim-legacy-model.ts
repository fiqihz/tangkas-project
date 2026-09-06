// Model murni klaim data lama (mirroring RPC SQL `claim_legacy_data`, migration 015).
//
// RPC SQL (BAGIAN 1 migration 015):
//   update player_profile set community_id = p_target where community_id = DEFAULT;
//   update session         set community_id = p_target where community_id = DEFAULT;
//
// Artinya: HANYA kolom `community_id` yang berubah, dan hanya untuk baris yang
// saat ini ber-`community_id = DEFAULT_COMMUNITY_ID`. Baris lain tak tersentuh.
// Idempoten karena kondisi WHERE: panggilan kedua tak menemukan baris DEFAULT.
//
// _Requirements: 10.1, 10.2, 10.3, 10.4_
// _Design: Onboarding & Migrasi Data Lama → claim_legacy_data_

/** Community warisan (DEFAULT) — samakan dengan konstanta di migrasi/types. */
export const DEFAULT_COMMUNITY_ID = "00000000-0000-0000-0000-000000000001";

/**
 * Representasi satu baris tabel yang punya `community_id`.
 * `id` adalah kunci baris; `communityId` kolom yang dimigrasi; kolom lain
 * (`otherCols`) mewakili data apa pun yang HARUS dipertahankan apa adanya.
 */
export interface LegacyRow {
  id: string;
  communityId: string;
  /** Kolom-kolom lain yang tak boleh diubah oleh klaim. */
  [otherCols: string]: unknown;
}

/**
 * Replika murni `claim_legacy_data(p_target)` untuk satu "tabel".
 *
 * Mengembalikan array BARU: setiap baris ber-`communityId === DEFAULT` diubah
 * `communityId → target`; baris lain dikembalikan tanpa perubahan. Input tidak
 * dimutasi (tiap baris disalin dangkal, hanya `communityId` yang mungkin diganti).
 */
export function claimLegacyTable<T extends LegacyRow>(
  rows: readonly T[],
  target: string,
): T[] {
  return rows.map((row) =>
    row.communityId === DEFAULT_COMMUNITY_ID
      ? { ...row, communityId: target }
      : { ...row },
  );
}

/** Dua "tabel" yang dimigrasi oleh RPC: player_profile & session. */
export interface LegacyTables {
  playerProfile: readonly LegacyRow[];
  session: readonly LegacyRow[];
}

/** Hasil klaim untuk kedua tabel (array baru, input tak dimutasi). */
export interface ClaimedTables {
  playerProfile: LegacyRow[];
  session: LegacyRow[];
}

/**
 * Replika murni `claim_legacy_data(p_target)` untuk kedua tabel sekaligus,
 * meniru dua UPDATE pada `player_profile` dan `session`.
 */
export function claimLegacyData(
  tables: LegacyTables,
  target: string,
): ClaimedTables {
  return {
    playerProfile: claimLegacyTable(tables.playerProfile, target),
    session: claimLegacyTable(tables.session, target),
  };
}
