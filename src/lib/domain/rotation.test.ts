import { describe, expect, it } from "vitest";
import { MatchHistory } from "./history";
import { generateMatch } from "./matchmaking";
import { makePlayer } from "./test-helpers";

describe("rotasi: hindari pemain yang baru selesai main", () => {
  it("memilih pemain fresh ketika ada, bukan yang baru main", () => {
    // 4 pemain baru main di ronde 1 (lastPlayedRound=1, gamesPlayed=1)
    const justPlayed = [
      makePlayer("JP1", "beginner", { id: "JP1", gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("JP2", "beginner", { id: "JP2", gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("JP3", "beginner", { id: "JP3", gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("JP4", "beginner", { id: "JP4", gamesPlayed: 1, lastPlayedRound: 1 }),
    ];
    // 4 pemain fresh yang juga sudah main 1x tapi di ronde lebih lama (rehat)
    const fresh = [
      makePlayer("FR1", "beginner", { id: "FR1", gamesPlayed: 1, lastPlayedRound: null }),
      makePlayer("FR2", "beginner", { id: "FR2", gamesPlayed: 1, lastPlayedRound: null }),
      makePlayer("FR3", "beginner", { id: "FR3", gamesPlayed: 1, lastPlayedRound: null }),
      makePlayer("FR4", "beginner", { id: "FR4", gamesPlayed: 1, lastPlayedRound: null }),
    ];

    // generate untuk ronde 2 (currentRound=2 -> "baru main" = ronde 1)
    const m = generateMatch([...justPlayed, ...fresh], new MatchHistory(), 2);
    expect(m).not.toBeNull();
    const chosen = new Set([...m!.teamA, ...m!.teamB]);
    // semua yang dipilih harus dari kelompok fresh
    for (const id of chosen) {
      expect(id.startsWith("FR")).toBe(true);
    }
  });

  it("tetap memakai pemain yang baru main bila tidak ada pilihan lain", () => {
    // hanya 4 pemain, semua baru main -> terpaksa dipakai (tidak boleh null)
    const only = [
      makePlayer("A", "beginner", { gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("B", "beginner", { gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("C", "beginner", { gamesPlayed: 1, lastPlayedRound: 1 }),
      makePlayer("D", "beginner", { gamesPlayed: 1, lastPlayedRound: 1 }),
    ];
    const m = generateMatch(only, new MatchHistory(), 2);
    expect(m).not.toBeNull();
  });
});
