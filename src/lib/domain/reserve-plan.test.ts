import { describe, it, expect } from "vitest";
import { planCompositionReserve } from "./reserve-plan";
import { makePlayer } from "./test-helpers";
import type { SessionPlayer } from "./types";

/**
 * Poin D: planCompositionReserve mencari pemain (sedang main) minimal yang perlu
 * dipinjam agar sebuah mode bisa terbentuk, ketika pemain menunggu saja tidak
 * cukup secara KOMPOSISI. Fungsi ini murni (dry-run), keputusan tetap di host.
 */
describe("planCompositionReserve", () => {
  it("Ganda Putri: meminjam pemain cewek dari yang sedang main", () => {
    // Menunggu: 2 cewek + 2 cowok (cukup jumlah, tapi ladies butuh 4 cewek).
    const waiting: SessionPlayer[] = [
      makePlayer("W1", "intermediate", { id: "w1", gender: "female" }),
      makePlayer("W2", "beginner", { id: "w2", gender: "female" }),
      makePlayer("M1", "intermediate", { id: "m1", gender: "male" }),
      makePlayer("M2", "beginner", { id: "m2", gender: "male" }),
    ];
    // Sedang main: 2 cewek (kandidat pinjam) + 1 cowok (tidak berguna untuk ladies).
    const candidates: SessionPlayer[] = [
      makePlayer("P-male", "advanced", { id: "cm", gender: "male" }),
      makePlayer("P-fem1", "intermediate", { id: "cf1", gender: "female" }),
      makePlayer("P-fem2", "beginner", { id: "cf2", gender: "female" }),
    ];

    const plan = planCompositionReserve(waiting, candidates, "ladies", 3);
    expect(plan).not.toBeNull();
    // Harus meminjam tepat 2 cewek (cf1, cf2), bukan cowok.
    const borrowIds = plan!.borrow.map((p) => p.id).sort();
    expect(borrowIds).toEqual(["cf1", "cf2"]);
    // Pool hasil harus punya 4 cewek.
    const females = plan!.pool.filter((p) => p.gender === "female").length;
    expect(females).toBeGreaterThanOrEqual(4);
  });

  it("mengembalikan null bila pemain menunggu sudah cukup (tak perlu pinjam)", () => {
    const waiting: SessionPlayer[] = [
      makePlayer("A", "beginner", { id: "a", gender: "female" }),
      makePlayer("B", "intermediate", { id: "b", gender: "female" }),
      makePlayer("C", "beginner", { id: "c", gender: "female" }),
      makePlayer("D", "intermediate", { id: "d", gender: "female" }),
    ];
    const plan = planCompositionReserve(waiting, [], "ladies", 3);
    expect(plan).toBeNull();
  });

  it("mengembalikan null bila meski semua kandidat dipinjam mode tetap gagal", () => {
    // Ladies tapi tak ada cukup cewek di mana pun.
    const waiting: SessionPlayer[] = [
      makePlayer("W1", "intermediate", { id: "w1", gender: "female" }),
      makePlayer("M1", "intermediate", { id: "m1", gender: "male" }),
      makePlayer("M2", "beginner", { id: "m2", gender: "male" }),
      makePlayer("M3", "beginner", { id: "m3", gender: "male" }),
    ];
    const candidates: SessionPlayer[] = [
      makePlayer("CM1", "advanced", { id: "cm1", gender: "male" }),
      makePlayer("CM2", "advanced", { id: "cm2", gender: "male" }),
    ];
    const plan = planCompositionReserve(waiting, candidates, "ladies", 3);
    expect(plan).toBeNull();
  });

  it("Gendongan: meminjam pemain lemah saat yang menunggu semua kuat", () => {
    // Menunggu: 4 pemain kuat (Int/Adv) → gendongan butuh tiap tim 1 kuat + 1 lemah.
    const waiting: SessionPlayer[] = [
      makePlayer("S1", "advanced", { id: "s1", gender: "male" }),
      makePlayer("S2", "advanced", { id: "s2", gender: "female" }),
      makePlayer("S3", "intermediate", { id: "s3", gender: "male" }),
      makePlayer("S4", "intermediate", { id: "s4", gender: "female" }),
    ];
    // Sedang main: pemain lemah (beginner) yang bisa melengkapi gendongan.
    const candidates: SessionPlayer[] = [
      makePlayer("Wk1", "beginner", { id: "wk1", gender: "male" }),
      makePlayer("Wk2", "beginner", { id: "wk2", gender: "female" }),
    ];

    const plan = planCompositionReserve(waiting, candidates, "gendongan", 3);
    expect(plan).not.toBeNull();
    // Minimal 1 pemain lemah dipinjam.
    expect(plan!.borrow.length).toBeGreaterThanOrEqual(1);
    expect(
      plan!.borrow.every((p) => p.level === "beginner" || p.level === "newbie"),
    ).toBe(true);
  });
});
