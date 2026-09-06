import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  claimLegacyData,
  DEFAULT_COMMUNITY_ID,
  type LegacyRow,
  type LegacyTables,
} from "./claim-legacy-model";

// Task 14.4 — property test klaim data lama mempertahankan kolom.
// Feature: phase-2-auth-multitenant, Property 5: Klaim data lama mempertahankan
// semua kolom selain community_id.
// Validates: Requirements 10.1, 10.4.
//
// RPC `claim_legacy_data` hanya menyentuh kolom `community_id`. Property 5
// membuktikan bahwa untuk sembarang himpunan baris (campuran DEFAULT &
// non-DEFAULT dengan kolom tambahan bertipe beragam), setelah klaim:
//   - jumlah baris sama & urutan dipertahankan,
//   - semua kolom SELAIN communityId identik dengan sebelumnya,
//   - communityId: baris DEFAULT → target; baris non-DEFAULT tak berubah.

const NUM_RUNS = 100;

/** Nilai kolom tambahan bertipe beragam untuk membuktikan preservasi apa pun. */
const extraValueArb: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(null),
);

/**
 * Generator satu baris: `communityId` campuran DEFAULT & non-DEFAULT, plus
 * beberapa kolom tambahan (nama & nilai acak, tipe beragam). Nama kolom
 * dijaga agar tidak bentrok dengan `id`/`communityId`.
 */
const rowArb: fc.Arbitrary<LegacyRow> = fc
  .record({
    id: fc.uuid(),
    communityId: fc.oneof(
      // Bias ke DEFAULT agar banyak baris yang benar-benar dimigrasi.
      fc.constant(DEFAULT_COMMUNITY_ID),
      fc.uuid(),
    ),
    extras: fc.dictionary(
      fc
        .string({ minLength: 1, maxLength: 8 })
        .filter((k) => k !== "id" && k !== "communityId"),
      extraValueArb,
      { maxKeys: 5 },
    ),
  })
  .map(({ id, communityId, extras }) => ({ id, communityId, ...extras }));

/** Daftar baris (termasuk kosong) untuk satu tabel. */
const tableArb: fc.Arbitrary<LegacyRow[]> = fc.array(rowArb, {
  minLength: 0,
  maxLength: 12,
});

/** Kedua "tabel" yang dimigrasi RPC. */
const tablesArb: fc.Arbitrary<LegacyTables> = fc.record({
  playerProfile: tableArb,
  session: tableArb,
});

/** Target UUID acak yang dijamin BUKAN DEFAULT. */
const targetArb: fc.Arbitrary<string> = fc
  .uuid()
  .filter((id) => id !== DEFAULT_COMMUNITY_ID);

/** Semua nama kolom sebuah baris kecuali `communityId`. */
function otherColumnKeys(row: LegacyRow): string[] {
  return Object.keys(row).filter((k) => k !== "communityId");
}

/**
 * Verifikasi satu tabel: jumlah & urutan baris dipertahankan, kolom selain
 * communityId identik, dan communityId dimigrasi sesuai aturan.
 */
function assertPreserved(
  before: readonly LegacyRow[],
  after: readonly LegacyRow[],
  target: string,
): void {
  // Jumlah baris sama.
  expect(after.length).toBe(before.length);

  after.forEach((row, i) => {
    const original = before[i];

    // Himpunan kolom tak berubah (tidak ada kolom hilang/bertambah).
    expect(new Set(Object.keys(row))).toEqual(new Set(Object.keys(original)));

    // Semua kolom SELAIN communityId identik apa adanya.
    for (const key of otherColumnKeys(original)) {
      expect(row[key]).toBe(original[key]);
    }

    // Aturan communityId.
    if (original.communityId === DEFAULT_COMMUNITY_ID) {
      expect(row.communityId).toBe(target);
    } else {
      expect(row.communityId).toBe(original.communityId);
    }
  });
}

describe("Feature: phase-2-auth-multitenant, Property 5: Klaim data lama mempertahankan semua kolom selain community_id", () => {
  it("jumlah & urutan baris dipertahankan, kolom lain identik, communityId dimigrasi sesuai aturan (Req 10.1, 10.4)", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const claimed = claimLegacyData(tables, target);
        assertPreserved(tables.playerProfile, claimed.playerProfile, target);
        assertPreserved(tables.session, claimed.session, target);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("hanya kolom communityId yang boleh berbeda antara input dan output", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const claimed = claimLegacyData(tables, target);
        const checkTable = (
          before: readonly LegacyRow[],
          after: readonly LegacyRow[],
        ) => {
          after.forEach((row, i) => {
            const original = before[i];
            const changedKeys = Object.keys(row).filter(
              (k) => row[k] !== original[k],
            );
            // Satu-satunya kolom yang mungkin berubah adalah communityId.
            expect(changedKeys.every((k) => k === "communityId")).toBe(true);
          });
        };
        checkTable(tables.playerProfile, claimed.playerProfile);
        checkTable(tables.session, claimed.session);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("tidak memutasi input (baris & kolom asli tetap utuh)", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const snapshot = JSON.stringify(tables);
        claimLegacyData(tables, target);
        expect(JSON.stringify(tables)).toBe(snapshot);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
