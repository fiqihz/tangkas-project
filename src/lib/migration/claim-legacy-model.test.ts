import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  claimLegacyData,
  DEFAULT_COMMUNITY_ID,
  type LegacyRow,
  type LegacyTables,
} from "./claim-legacy-model";

// Task 14.3 — property test klaim data lama idempoten (model murni claim_legacy_data).
// Feature: phase-2-auth-multitenant, Property 4: Klaim data lama idempoten.
// Validates: Requirements 10.2, 10.3.

const NUM_RUNS = 100;

/**
 * Generator satu baris: `communityId` campuran DEFAULT & non-DEFAULT, plus
 * kolom lain acak (`name`, `score`) untuk memastikan preservasi kolom.
 */
const rowArb: fc.Arbitrary<LegacyRow> = fc.record({
  id: fc.uuid(),
  communityId: fc.oneof(
    // Bias ke DEFAULT agar banyak baris yang benar-benar dimigrasi.
    fc.constant(DEFAULT_COMMUNITY_ID),
    fc.uuid(),
  ),
  name: fc.string(),
  score: fc.integer(),
});

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

/** True bila tak ada baris ber-communityId === DEFAULT di kedua tabel. */
function noDefaultRemains(tables: {
  playerProfile: LegacyRow[];
  session: LegacyRow[];
}): boolean {
  return [...tables.playerProfile, ...tables.session].every(
    (r) => r.communityId !== DEFAULT_COMMUNITY_ID,
  );
}

describe("Feature: phase-2-auth-multitenant, Property 4: Klaim data lama idempoten", () => {
  it("claim(claim(rows)) === claim(rows) untuk sembarang tabel & target (Req 10.2, 10.3)", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const once = claimLegacyData(tables, target);
        const twice = claimLegacyData(once, target);
        // State identik antara sekali & dua kali klaim.
        expect(twice).toEqual(once);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("panggilan kedua tidak mengubah baris apa pun (tak ada lagi baris DEFAULT)", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const once = claimLegacyData(tables, target);
        const twice = claimLegacyData(once, target);
        // Idempoten pada level referensi nilai: hasil kedua sama persis.
        expect(twice.playerProfile).toEqual(once.playerProfile);
        expect(twice.session).toEqual(once.session);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("setelah claim, tidak ada baris ber-communityId === DEFAULT (semua termigrasi ke target)", () => {
    fc.assert(
      fc.property(tablesArb, targetArb, (tables, target) => {
        const once = claimLegacyData(tables, target);
        expect(noDefaultRemains(once)).toBe(true);
        // Setiap baris yang tadinya DEFAULT kini bernilai target.
        const migratedProfiles = once.playerProfile.every(
          (r, i) =>
            tables.playerProfile[i].communityId === DEFAULT_COMMUNITY_ID
              ? r.communityId === target
              : r.communityId === tables.playerProfile[i].communityId,
        );
        const migratedSessions = once.session.every((r, i) =>
          tables.session[i].communityId === DEFAULT_COMMUNITY_ID
            ? r.communityId === target
            : r.communityId === tables.session[i].communityId,
        );
        expect(migratedProfiles && migratedSessions).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("tidak memutasi input (tabel asli tetap punya baris DEFAULT bila ada)", () => {
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
