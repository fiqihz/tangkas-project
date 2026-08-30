import { describe, expect, it } from "vitest";
import { MatchHistory } from "./history";
import { applyMatchResult, buildLeaderboard } from "./leaderboard";
import { bestSplitForFour, generateMatch } from "./matchmaking";
import { sortByQueuePriority } from "./queue";
import {
  isValidMatchup,
  isValidPartnerPair,
  teamImbalance,
} from "./rules";
import { findSubstitute } from "./substitute";
import { makePlayer } from "./test-helpers";
import type { Match, SessionPlayer } from "./types";

describe("hard rule: Newbie pairing", () => {
  it("melarang Newbie setim dengan Newbie", () => {
    const n1 = makePlayer("N1", "newbie");
    const n2 = makePlayer("N2", "newbie");
    expect(isValidPartnerPair(n1, n2)).toBe(false);
  });

  it("mengizinkan Newbie dengan Beginner/Intermediate/Advanced", () => {
    const n = makePlayer("N", "newbie");
    expect(isValidPartnerPair(n, makePlayer("B", "beginner"))).toBe(true);
    expect(isValidPartnerPair(n, makePlayer("I", "intermediate"))).toBe(true);
    expect(isValidPartnerPair(n, makePlayer("A", "advanced"))).toBe(true);
  });

  it("melarang matchup Newbie/Newbie vs Newbie/Newbie", () => {
    const a1 = makePlayer("N1", "newbie");
    const a2 = makePlayer("N2", "newbie");
    const b1 = makePlayer("N3", "newbie");
    const b2 = makePlayer("N4", "newbie");
    expect(isValidMatchup(a1, a2, b1, b2)).toBe(false);
  });
});

describe("team balance", () => {
  it("menghitung selisih bobot antar tim", () => {
    // beginner(2)+intermediate(3)=5  vs  advanced(4)+newbie(1)=5 -> 0
    const a1 = makePlayer("a1", "beginner");
    const a2 = makePlayer("a2", "intermediate");
    const b1 = makePlayer("b1", "advanced");
    const b2 = makePlayer("b2", "newbie");
    expect(teamImbalance(a1, a2, b1, b2)).toBe(0);
  });
});

describe("bestSplitForFour", () => {
  it("memilih pembagian paling seimbang & mematuhi hard rule", () => {
    // 2 newbie + 2 intermediate: split terbaik = newbie+inter vs newbie+inter
    const players = [
      makePlayer("N1", "newbie"),
      makePlayer("N2", "newbie"),
      makePlayer("I1", "intermediate"),
      makePlayer("I2", "intermediate"),
    ];
    const split = bestSplitForFour(players, new MatchHistory());
    expect(split).not.toBeNull();
    // tidak boleh ada tim berisi 2 newbie
    const teamHasTwoNewbie = (ids: [string, string]) =>
      ids.every((id) => players.find((p) => p.id === id)?.level === "newbie");
    expect(teamHasTwoNewbie(split!.teamA)).toBe(false);
    expect(teamHasTwoNewbie(split!.teamB)).toBe(false);
    expect(split!.imbalance).toBe(0);
  });

  it("mengembalikan null bila keempat pemain Newbie (tidak ada match valid)", () => {
    const players = [
      makePlayer("N1", "newbie"),
      makePlayer("N2", "newbie"),
      makePlayer("N3", "newbie"),
      makePlayer("N4", "newbie"),
    ];
    expect(bestSplitForFour(players, new MatchHistory())).toBeNull();
  });
});

describe("queue priority", () => {
  it("mendahulukan pemain dengan gamesPlayed terkecil", () => {
    const a = makePlayer("A", "beginner", { gamesPlayed: 3 });
    const b = makePlayer("B", "beginner", { gamesPlayed: 1 });
    const c = makePlayer("C", "beginner", { gamesPlayed: 2 });
    const sorted = sortByQueuePriority([a, b, c]);
    expect(sorted.map((p) => p.name)).toEqual(["B", "C", "A"]);
  });

  it("tie-break: yang paling lama tidak main didahulukan", () => {
    const a = makePlayer("A", "beginner", { gamesPlayed: 1, lastPlayedRound: 5 });
    const b = makePlayer("B", "beginner", { gamesPlayed: 1, lastPlayedRound: 2 });
    const sorted = sortByQueuePriority([a, b]);
    expect(sorted.map((p) => p.name)).toEqual(["B", "A"]);
  });
});

describe("generateMatch", () => {
  it("membentuk match valid dari pool campuran", () => {
    const pool: SessionPlayer[] = [
      makePlayer("N1", "newbie"),
      makePlayer("B1", "beginner"),
      makePlayer("B2", "beginner"),
      makePlayer("I1", "intermediate"),
      makePlayer("I2", "intermediate"),
      makePlayer("A1", "advanced"),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2);
    expect(m).not.toBeNull();
    const ids = [...m!.teamA, ...m!.teamB];
    expect(new Set(ids).size).toBe(4); // 4 pemain unik
  });

  it("null bila pemain kurang dari 4", () => {
    const pool = [makePlayer("A", "beginner"), makePlayer("B", "beginner")];
    expect(generateMatch(pool, new MatchHistory(), 1)).toBeNull();
  });
});

describe("scoring & leaderboard", () => {
  it("kemenangan berlaku untuk 2 pemain di tim menang", () => {
    let players = [
      makePlayer("A", "beginner", { id: "A" }),
      makePlayer("B", "beginner", { id: "B" }),
      makePlayer("C", "beginner", { id: "C" }),
      makePlayer("D", "beginner", { id: "D" }),
    ];
    const match: Match = {
      id: "m1",
      courtId: "c1",
      round: 1,
      teamA: { playerIds: ["A", "B"] },
      teamB: { playerIds: ["C", "D"] },
      state: "finished",
      score: { a: 30, b: 26 },
      winner: "a",
    };
    players = applyMatchResult(players, match);
    const byId = Object.fromEntries(players.map((p) => [p.id, p]));
    expect(byId.A.wins).toBe(1);
    expect(byId.B.wins).toBe(1);
    expect(byId.C.losses).toBe(1);
    expect(byId.D.losses).toBe(1);
    expect(byId.A.pointsScored).toBe(30);
    expect(byId.A.pointsConceded).toBe(26);
  });

  it("tie-break: menang sama -> selisih poin menentukan", () => {
    const players = [
      makePlayer("A", "beginner", { wins: 2, pointsScored: 60, pointsConceded: 40 }),
      makePlayer("B", "beginner", { wins: 2, pointsScored: 60, pointsConceded: 50 }),
    ];
    const lb = buildLeaderboard(players);
    expect(lb[0].name).toBe("A"); // diff +20 > +10
    expect(lb[0].rank).toBe(1);
  });
});

describe("substitute", () => {
  it("cari pengganti tanpa melanggar hard rule & jaga keseimbangan", () => {
    const partner = makePlayer("Partner", "newbie", { id: "P" });
    const leaving = makePlayer("Leaving", "beginner", { id: "L" });
    const opp1 = makePlayer("Opp1", "beginner", { id: "O1" });
    const opp2 = makePlayer("Opp2", "beginner", { id: "O2" });
    // kandidat: newbie (dilarang, karena partner newbie) & beginner (boleh)
    const candNewbie = makePlayer("CandN", "newbie", { id: "CN", gamesPlayed: 0 });
    const candBeginner = makePlayer("CandB", "beginner", { id: "CB", gamesPlayed: 0 });

    const byId = new Map(
      [partner, leaving, opp1, opp2, candNewbie, candBeginner].map((p) => [p.id, p]),
    );

    const sub = findSubstitute({
      match: { teamA: ["P", "L"], teamB: ["O1", "O2"] },
      leavingId: "L",
      pool: [candNewbie, candBeginner],
      byId,
      history: new MatchHistory(),
      currentRound: 3,
    });
    // harus pilih beginner, bukan newbie (karena partner newbie -> newbie+newbie dilarang)
    expect(sub).toBe("CB");
  });
});
