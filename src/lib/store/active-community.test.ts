import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  type HasCommunityId,
  resolveActiveCommunity,
} from "./active-community";

// Task 7.3 — property test resolusi active_community (fungsi murni Task 7.2).
// Feature: phase-2-auth-multitenant, Property 6.
// Validates: Requirements 8.1, 8.5.

const NUM_RUNS = 100;

/** Generator satu membership: cukup punya `communityId`. */
const membershipArb: fc.Arbitrary<HasCommunityId> = fc.record({
  communityId: fc.uuid(),
});

/** Daftar membership tak kosong. */
const nonEmptyMembershipsArb: fc.Arbitrary<HasCommunityId[]> = fc.array(
  membershipArb,
  { minLength: 1, maxLength: 12 },
);

describe("Feature: phase-2-auth-multitenant, Property 6: Resolusi active_community deterministik dari daftar membership", () => {
  it("daftar tak kosong: storedId di daftar → hasil === storedId; jika tidak → membership pertama", () => {
    fc.assert(
      fc.property(
        nonEmptyMembershipsArb,
        // storedId kadang diambil dari daftar (cabang cocok), kadang acak/null
        // (cabang fallback) agar kedua cabang tertutup.
        fc.oneof(
          fc.constant<string | null>(null),
          fc.uuid(),
          fc.constant("__from_list__"),
        ),
        (memberships, storedRaw) => {
          const storedId =
            storedRaw === "__from_list__"
              ? memberships[
                  memberships.length - 1 // ambil salah satu yang pasti ada
                ].communityId
              : storedRaw;

          const result = resolveActiveCommunity(memberships, storedId);
          const inList =
            storedId !== null &&
            memberships.some((m) => m.communityId === storedId);

          if (inList) {
            expect(result).toBe(storedId);
          } else {
            expect(result).toBe(memberships[0].communityId);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("daftar berukuran satu → hasil selalu communityId tunggal itu", () => {
    fc.assert(
      fc.property(
        membershipArb,
        fc.oneof(fc.constant<string | null>(null), fc.uuid()),
        (only, storedId) => {
          const result = resolveActiveCommunity([only], storedId);
          expect(result).toBe(only.communityId);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("daftar kosong → null (apa pun storedId)", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant<string | null>(null), fc.uuid()),
        (storedId) => {
          expect(resolveActiveCommunity([], storedId)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("deterministik: pemanggilan berulang dengan input sama → hasil sama", () => {
    fc.assert(
      fc.property(
        fc.array(membershipArb, { maxLength: 12 }),
        fc.oneof(fc.constant<string | null>(null), fc.uuid()),
        (memberships, storedId) => {
          const a = resolveActiveCommunity(memberships, storedId);
          const b = resolveActiveCommunity(memberships, storedId);
          const c = resolveActiveCommunity(memberships, storedId);
          expect(a).toBe(b);
          expect(b).toBe(c);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
