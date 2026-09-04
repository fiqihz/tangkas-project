import { describe, it, expect } from "vitest";
import { generateMatch } from "./matchmaking";
import { MatchHistory } from "./history";
import { makePlayer } from "./test-helpers";

/**
 * Poin 5: saat pemain menunggu < 4, pemain yang sedang main di-reserve untuk
 * mengisi sisa slot. Pemain menunggu WAJIB masuk (mustInclude) — tidak boleh
 * kalah oleh pemain reserve, sesuai laporan bug di mana next player malah
 * pemain yang sedang main padahal masih ada yang menunggu.
 */
describe("generateMatch mustInclude (reserve behavior)", () => {
  it("selalu menyertakan pemain menunggu ketika di-set sebagai mustInclude", () => {
    // 2 menunggu (baru datang, gamesPlayed 0) + 4 reserve (sudah main, high games)
    const w1 = makePlayer("wait1", "intermediate", { id: "w1", gamesPlayed: 0 });
    const w2 = makePlayer("wait2", "intermediate", { id: "w2", gamesPlayed: 0 });
    const r1 = makePlayer("res1", "advanced", { id: "r1", gamesPlayed: 3, lastPlayedRound: 5 });
    const r2 = makePlayer("res2", "advanced", { id: "r2", gamesPlayed: 3, lastPlayedRound: 5 });
    const r3 = makePlayer("res3", "advanced", { id: "r3", gamesPlayed: 3, lastPlayedRound: 5 });
    const r4 = makePlayer("res4", "advanced", { id: "r4", gamesPlayed: 3, lastPlayedRound: 5 });

    const pool = [w1, w2, r1, r2, r3, r4];
    const history = MatchHistory.fromMatches([]);
    const mustInclude = new Set(["w1", "w2"]);

    const prop = generateMatch(pool, history, 6, undefined, "balanced", {
      mustInclude,
    });

    expect(prop).not.toBeNull();
    const ids = [...prop!.teamA, ...prop!.teamB];
    expect(ids).toContain("w1");
    expect(ids).toContain("w2");
    // 2 sisanya diisi dari pemain reserve.
    expect(ids).toHaveLength(4);
  });

  it("tanpa mustInclude, matchmaking bebas memilih (kontrol)", () => {
    const players = [
      makePlayer("a", "beginner", { id: "a" }),
      makePlayer("b", "beginner", { id: "b" }),
      makePlayer("c", "beginner", { id: "c" }),
      makePlayer("d", "beginner", { id: "d" }),
    ];
    const prop = generateMatch(players, MatchHistory.fromMatches([]), 1);
    expect(prop).not.toBeNull();
    expect([...prop!.teamA, ...prop!.teamB]).toHaveLength(4);
  });
});
