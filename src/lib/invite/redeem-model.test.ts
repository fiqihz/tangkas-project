import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  MembershipStore,
  redeemInvite,
  type InviteStatus,
} from "./redeem-model";

// Task 14.1 & 14.2 — property test model murni `redeem_invite` (migration 015).
// _Requirements: 6.5, 6.6, 6.7, 6.8_ — Design: Invite Flow → redeem.

const RUNS = 200; // min. 100 iterasi; dinaikkan untuk cakupan lebih baik.

// UUID-like agar pasangan (user, community) unik & realistis untuk kunci store.
const uuidArb = fc.uuid();

describe("Feature: phase-2-auth-multitenant, Property 1: Penukaran invite kedaluwarsa tidak pernah membuat membership", () => {
  it("Req 6.7 — invite kedaluwarsa (expiresAt < now) → ok:false reason 'expired' dan membership (user,community) tidak bertambah", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_102_444_800_000 }), // now (epoch ms)
        fc.integer({ min: 1, max: 1_000_000_000 }), // selisih kadaluwarsa (>0)
        uuidArb,
        uuidArb,
        (now, delta, userId, communityId) => {
          // Pastikan expired: expiresAt < now.
          const expiresAt = now - delta;
          const members = new MembershipStore();
          const before = members.count(userId, communityId);

          const state = { status: "pending" as InviteStatus, expiresAt };
          const result = redeemInvite(state, now, userId, communityId, members);

          // Ditolak dengan alasan 'expired'.
          expect(result.ok).toBe(false);
          if (!result.ok) expect(result.reason).toBe("expired");
          // Status invite ditandai 'expired' (cermin update RPC).
          expect(state.status).toBe("expired");
          // Membership TIDAK bertambah.
          expect(members.count(userId, communityId)).toBe(before);
          expect(members.size()).toBe(0);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Feature: phase-2-auth-multitenant, Property 2: Penukaran invite idempoten (tidak bisa dipakai dua kali)", () => {
  it("Req 6.5, 6.6, 6.8 — redeem pertama membuat 1 membership 'admin' + 'accepted'; redeem kedua → ok:false reason 'used' dan membership tetap 1", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 4_102_444_800_000 }), // now (epoch ms)
        fc.integer({ min: 0, max: 1_000_000_000 }), // margin masa depan (>=0)
        uuidArb,
        uuidArb,
        (now, margin, userId, communityId) => {
          // Valid: pending & belum kedaluwarsa (expiresAt >= now).
          const expiresAt = now + margin;
          const members = new MembershipStore();

          const state = { status: "pending" as InviteStatus, expiresAt };

          // Redeem PERTAMA → sukses, tepat satu membership admin, invite accepted.
          const first = redeemInvite(state, now, userId, communityId, members);
          expect(first.ok).toBe(true);
          if (first.ok) expect(first.communityId).toBe(communityId);
          expect(state.status).toBe("accepted");
          expect(members.count(userId, communityId)).toBe(1);
          expect(members.size()).toBe(1);

          // Redeem KEDUA dengan state/token yang sama → ditolak 'used'.
          const second = redeemInvite(state, now, userId, communityId, members);
          expect(second.ok).toBe(false);
          if (!second.ok) expect(second.reason).toBe("used");
          // Idempoten: jumlah membership tetap 1.
          expect(members.count(userId, communityId)).toBe(1);
          expect(members.size()).toBe(1);
          // Status tetap 'accepted' (tidak berubah pada penukaran kedua).
          expect(state.status).toBe("accepted");
        },
      ),
      { numRuns: RUNS },
    );
  });
});
