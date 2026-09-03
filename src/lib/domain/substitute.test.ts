import { describe, expect, it } from "vitest";
import { MatchHistory } from "./history";
import { findSubstitute } from "./substitute";
import { makePlayer } from "./test-helpers";
import type { SessionPlayer } from "./types";

/**
 * Regresi untuk poin stabilisasi #5: findSubstitute TIDAK boleh crash
 * (TypeError) ketika ada pemain di match yang hilang dari roster (byId),
 * mis. pemain sudah dihapus atau `players` basi relatif terhadap `matches`.
 * Sebelumnya kode pakai non-null assertion (byId.get(...)!), sekarang harus
 * mengembalikan null dengan aman.
 */
describe("findSubstitute — ketahanan terhadap pemain hilang", () => {
  const build = (roster: SessionPlayer[]) => new Map(roster.map((p) => [p.id, p]));

  it("mengembalikan null (bukan crash) saat partner hilang dari roster", () => {
    const leaving = makePlayer("Leaving", "beginner", { id: "leave" });
    const opp1 = makePlayer("Opp1", "beginner", { id: "o1" });
    const opp2 = makePlayer("Opp2", "beginner", { id: "o2" });
    const cand = makePlayer("Cand", "beginner", { id: "c1" });
    // partner ("missing") sengaja TIDAK dimasukkan ke roster/byId.
    const byId = build([leaving, opp1, opp2, cand]);

    expect(() =>
      findSubstitute({
        match: { teamA: ["leave", "missing"], teamB: ["o1", "o2"] },
        leavingId: "leave",
        pool: [cand],
        byId,
        history: MatchHistory.fromMatches([]),
        currentRound: 2,
      }),
    ).not.toThrow();

    const res = findSubstitute({
      match: { teamA: ["leave", "missing"], teamB: ["o1", "o2"] },
      leavingId: "leave",
      pool: [cand],
      byId,
      history: MatchHistory.fromMatches([]),
      currentRound: 2,
    });
    expect(res).toBeNull();
  });

  it("mengembalikan null saat lawan hilang dari roster", () => {
    const leaving = makePlayer("Leaving", "beginner", { id: "leave" });
    const partner = makePlayer("Partner", "intermediate", { id: "pt" });
    const opp1 = makePlayer("Opp1", "beginner", { id: "o1" });
    const cand = makePlayer("Cand", "beginner", { id: "c1" });
    // opp2 ("o2") tidak ada di roster.
    const byId = build([leaving, partner, opp1, cand]);

    const res = findSubstitute({
      match: { teamA: ["leave", "pt"], teamB: ["o1", "o2"] },
      leavingId: "leave",
      pool: [cand],
      byId,
      history: MatchHistory.fromMatches([]),
      currentRound: 2,
    });
    expect(res).toBeNull();
  });

  it("tetap memilih pengganti valid saat roster lengkap", () => {
    const leaving = makePlayer("Leaving", "beginner", { id: "leave" });
    const partner = makePlayer("Partner", "intermediate", { id: "pt" });
    const opp1 = makePlayer("Opp1", "intermediate", { id: "o1" });
    const opp2 = makePlayer("Opp2", "beginner", { id: "o2" });
    const cand = makePlayer("Cand", "beginner", { id: "c1" });
    const byId = build([leaving, partner, opp1, opp2, cand]);

    const res = findSubstitute({
      match: { teamA: ["leave", "pt"], teamB: ["o1", "o2"] },
      leavingId: "leave",
      pool: [cand],
      byId,
      history: MatchHistory.fromMatches([]),
      currentRound: 2,
    });
    expect(res).toBe("c1");
  });

  it("menolak pengganti yang membentuk Newbie+Newbie dengan partner", () => {
    const leaving = makePlayer("Leaving", "newbie", { id: "leave" });
    const partner = makePlayer("Partner", "newbie", { id: "pt" });
    const opp1 = makePlayer("Opp1", "beginner", { id: "o1" });
    const opp2 = makePlayer("Opp2", "beginner", { id: "o2" });
    // satu-satunya kandidat juga newbie -> ilegal berpasangan dengan partner newbie.
    const cand = makePlayer("Cand", "newbie", { id: "c1" });
    const byId = build([leaving, partner, opp1, opp2, cand]);

    const res = findSubstitute({
      match: { teamA: ["leave", "pt"], teamB: ["o1", "o2"] },
      leavingId: "leave",
      pool: [cand],
      byId,
      history: MatchHistory.fromMatches([]),
      currentRound: 2,
    });
    expect(res).toBeNull();
  });
});
