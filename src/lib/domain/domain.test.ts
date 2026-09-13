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
      shuttlecocks: 0,
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

  it("tie-break: poin sama -> selisih poin menentukan", () => {
    const players = [
      makePlayer("A", "beginner", { wins: 2, pointsScored: 60, pointsConceded: 40 }),
      makePlayer("B", "beginner", { wins: 2, pointsScored: 60, pointsConceded: 50 }),
    ];
    const lb = buildLeaderboard(players);
    expect(lb[0].name).toBe("A"); // poin sama (60=60) -> diff +20 > +10
    expect(lb[0].rank).toBe(1);
  });

  it("ranking: poin lebih tinggi menang walau menang lebih sedikit", () => {
    const players = [
      // A: menang lebih banyak tapi poin lebih rendah
      makePlayer("A", "beginner", { wins: 3, pointsScored: 100, pointsConceded: 40 }),
      // B: menang lebih sedikit tapi poin lebih tinggi -> harus di atas
      makePlayer("B", "beginner", { wins: 2, pointsScored: 114, pointsConceded: 102 }),
    ];
    const lb = buildLeaderboard(players);
    expect(lb[0].name).toBe("B"); // poin 114 > 100, jumlah menang tidak dipakai
    expect(lb[0].rank).toBe(1);
  });

  it("normalisasi per-set: match 2-set vs 3-set setara skalanya", () => {
    // Skenario dari 2 match nyata:
    //   Match 1 (2 set): Tim A [P1,P2] 21-15, 21-5  -> total A=42, B=20
    //   Match 2 (3 set): Tim A [P5,P2] 21-13,19-21,21-6 -> total A=61, B=40
    const players = [
      makePlayer("P1", "beginner", { id: "P1", gamesPlayed: 2, wins: 1, losses: 1 }),
      makePlayer("P2", "beginner", { id: "P2", gamesPlayed: 2, wins: 2 }),
      makePlayer("P3", "beginner", { id: "P3", gamesPlayed: 2, losses: 2 }),
      makePlayer("P4", "beginner", { id: "P4", gamesPlayed: 1, losses: 1 }),
      makePlayer("P5", "beginner", { id: "P5", gamesPlayed: 1, wins: 1 }),
    ];
    const matches: Match[] = [
      {
        id: "m1",
        courtId: "c1",
        round: 1,
        teamA: { playerIds: ["P1", "P2"] },
        teamB: { playerIds: ["P3", "P4"] },
        state: "finished",
        score: { a: 42, b: 20 },
        sets: [
          { a: 21, b: 15 },
          { a: 21, b: 5 },
        ],
        winner: "a",
        shuttlecocks: 0,
      },
      {
        id: "m2",
        courtId: "c1",
        round: 2,
        teamA: { playerIds: ["P5", "P2"] },
        teamB: { playerIds: ["P1", "P3"] },
        state: "finished",
        score: { a: 61, b: 40 },
        sets: [
          { a: 21, b: 13 },
          { a: 19, b: 21 },
          { a: 21, b: 6 },
        ],
        winner: "a",
        shuttlecocks: 0,
      },
    ];

    const byId = Object.fromEntries(
      buildLeaderboard(players, matches).map((r) => [r.playerId, r]),
    );

    // Poin inti P5 (tanpa bonus) = 61/3 ≈ 20.33; TIDAK melonjak melebihi
    // skala match 2-set. Bandingkan dgn skema lama yg memberi 61 mentah.
    // (P5 main 1 match sedangkan max = 2, jadi total-nya termasuk bonus +M.)
    expect(byId.P5.pointsScored - byId.P5.bonus).toBeCloseTo(61 / 3, 5);
    // P2 juara: 42/2 + 61/3 = 21 + 20.33 = 41.33 (main 2 match, bonus 0).
    expect(byId.P2.bonus).toBe(0);
    expect(byId.P2.pointsScored).toBeCloseTo(21 + 61 / 3, 5);
    expect(byId.P2.rank).toBe(1);
    // Diff P2 ternormalisasi: (21 + 20.33) - (10 + 13.33) = +18.
    expect(byId.P2.pointDiff).toBeCloseTo(18, 5);
    // Display dibulatkan.
    expect(byId.P2.pointsDisplay).toBe(41);
  });

  it("bonus +M memakai basis rata-rata poin-per-set liga (bukan flat 25)", () => {
    // Satu match 2-set: A[P1,P2] 21-10,21-12 -> total A=42, B=22.
    // P3 tidak main (tertinggal 1 match) -> harus dapat bonus ~ rata-rata
    // poin-per-set liga = (21 + 11) / 2 = 16, bukan 25.
    const players = [
      makePlayer("P1", "beginner", { id: "P1", gamesPlayed: 1, wins: 1 }),
      makePlayer("P2", "beginner", { id: "P2", gamesPlayed: 1, wins: 1 }),
      makePlayer("P3", "beginner", { id: "P3", gamesPlayed: 1, losses: 1 }),
      makePlayer("P4", "beginner", { id: "P4", gamesPlayed: 1, losses: 1 }),
      // P5 belum kebagian main sama sekali di match manapun.
      makePlayer("P5", "beginner", { id: "P5", gamesPlayed: 0 }),
    ];
    const matches: Match[] = [
      {
        id: "m1",
        courtId: "c1",
        round: 1,
        teamA: { playerIds: ["P1", "P2"] },
        teamB: { playerIds: ["P3", "P4"] },
        state: "finished",
        score: { a: 42, b: 22 },
        sets: [
          { a: 21, b: 10 },
          { a: 21, b: 12 },
        ],
        winner: "a",
        shuttlecocks: 0,
      },
    ];

    const byId = Object.fromEntries(
      buildLeaderboard(players, matches).map((r) => [r.playerId, r]),
    );
    // avg poin/set liga = (42 + 22) / (2 set * 2 sisi) = 64/4 = 16.
    expect(byId.P5.bonus).toBeCloseTo(16, 5);
    expect(byId.P5.bonusDisplay).toBe(16);
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
