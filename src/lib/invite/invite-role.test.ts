import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  PHASE2_INVITE_ROLE,
  assertInviteRoleAllowed,
  resolveInviteRole,
} from "./invite-role";

// Task 8.3 — Property test create invite selalu role admin.
// Feature: phase-2-auth-multitenant, Property 3: Invite selalu ber-role admin di Fase 2
// Model murni logika createInvite: repo meng-hardcode role "admin"
// (repo.createInvite) + DB memaksa CHECK (role='admin') (migration 012) & RLS
// insert role='admin' (migration 013).
// **Validates: Requirements 6.10**

const NUM_RUNS = 100;

describe("Property 3: Invite selalu ber-role admin di Fase 2", () => {
  it("resolveInviteRole selalu mengembalikan 'admin' untuk sembarang requested role", () => {
    fc.assert(
      fc.property(fc.string(), (requested) => {
        expect(resolveInviteRole(requested)).toBe("admin");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("resolveInviteRole tetap 'admin' untuk role yang eksplisit mencoba menyimpang", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("admin", "member", "owner", "", "ADMIN", "administrator"),
        (requested) => {
          expect(resolveInviteRole(requested)).toBe(PHASE2_INVITE_ROLE);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("resolveInviteRole tanpa argumen tetap 'admin'", () => {
    expect(resolveInviteRole()).toBe("admin");
  });

  it("assertInviteRoleAllowed menolak 'member' dan menerima 'admin'", () => {
    expect(assertInviteRoleAllowed("member")).toBe(false);
    expect(assertInviteRoleAllowed("admin")).toBe(true);
  });

  it("assertInviteRoleAllowed hanya true untuk 'admin', false untuk role lain apa pun", () => {
    fc.assert(
      fc.property(fc.string(), (role) => {
        const expected = role === "admin";
        expect(assertInviteRoleAllowed(role)).toBe(expected);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("assertInviteRoleAllowed selalu false untuk role != 'admin' (termasuk kandidat enum lain)", () => {
    fc.assert(
      fc.property(
        // string acak yang dijamin bukan "admin"
        fc.string().filter((s) => s !== "admin"),
        (role) => {
          expect(assertInviteRoleAllowed(role)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("role hasil resolveInviteRole selalu lolos assertInviteRoleAllowed (model selaras dengan CHECK DB)", () => {
    fc.assert(
      fc.property(fc.string(), (requested) => {
        const resolved = resolveInviteRole(requested);
        expect(assertInviteRoleAllowed(resolved)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
