import { describe, it, expect } from "vitest";
import { modeFeasibility } from "./pool-insight";
import { makePlayer } from "./test-helpers";
import type { SessionPlayer } from "./types";

/**
 * Poin 3A + D: modeFeasibility punya 3 keadaan:
 *  - "ok"          : bisa dari pemain menunggu saja
 *  - "needsBorrow" : perlu pinjam pemain yang sedang main (Poin D)
 *  - "impossible"  : tak bisa walau dipinjam
 */
describe("modeFeasibility (3-state)", () => {
  const NO_BUSY = new Set<string>();

  it("ok: Seimbang bisa dari 4 pemain menunggu ber-level", () => {
    const waiting: SessionPlayer[] = [
      makePlayer("A", "beginner", { id: "a" }),
      makePlayer("B", "intermediate", { id: "b" }),
      makePlayer("C", "beginner", { id: "c" }),
      makePlayer("D", "intermediate", { id: "d" }),
    ];
    const res = modeFeasibility(waiting, NO_BUSY, "balanced", 3);
    expect(res.state).toBe("ok");
  });

  it("needsBorrow: Ganda Putri butuh pinjam cewek yang sedang main", () => {
    // Menunggu: 2 cewek + 2 cowok (cukup jumlah utk Seimbang, tapi ladies butuh 4 cewek).
    const waiting: SessionPlayer[] = [
      makePlayer("W1", "intermediate", { id: "w1", gender: "female" }),
      makePlayer("W2", "beginner", { id: "w2", gender: "female" }),
      makePlayer("M1", "intermediate", { id: "m1", gender: "male" }),
      makePlayer("M2", "beginner", { id: "m2", gender: "male" }),
    ];
    // Sedang main (busy) tapi bisa dipinjam: 2 cewek.
    const reservable: SessionPlayer[] = [
      makePlayer("R1", "intermediate", { id: "r1", gender: "female" }),
      makePlayer("R2", "beginner", { id: "r2", gender: "female" }),
    ];
    const busy = new Set(["r1", "r2"]);
    const res = modeFeasibility(waiting, busy, "ladies", 3, reservable);
    expect(res.state).toBe("needsBorrow");
  });

  it("impossible: Ganda Putri tetap tak bisa bila cewek kurang di mana pun", () => {
    const waiting: SessionPlayer[] = [
      makePlayer("W1", "intermediate", { id: "w1", gender: "female" }),
      makePlayer("M1", "intermediate", { id: "m1", gender: "male" }),
      makePlayer("M2", "beginner", { id: "m2", gender: "male" }),
      makePlayer("M3", "beginner", { id: "m3", gender: "male" }),
    ];
    const reservable: SessionPlayer[] = [
      makePlayer("R1", "advanced", { id: "r1", gender: "male" }),
    ];
    const res = modeFeasibility(
      waiting,
      new Set(["r1"]),
      "ladies",
      3,
      reservable,
    );
    expect(res.state).toBe("impossible");
  });
});
