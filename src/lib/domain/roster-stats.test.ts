import { describe, expect, it } from "vitest";
import {
  computeHeadToHead,
  computePartners,
  computeProfileStats,
  type ResolvedMatch,
} from "./roster-stats";

// Skenario: 2 mabar.
// Mabar S1: (A,B) 21-15 (C,D)  -> A,B menang; C,D kalah
// Mabar S1: (A,C) 18-21 (B,D)  -> B,D menang; A,C kalah
// Mabar S2: (A,B) 21-10 (C,D)  -> A,B menang; C,D kalah
const matches: ResolvedMatch[] = [
  { sessionId: "S1", teamA: ["A", "B"], teamB: ["C", "D"], scoreA: 21, scoreB: 15, winner: "a" },
  { sessionId: "S1", teamA: ["A", "C"], teamB: ["B", "D"], scoreA: 18, scoreB: 21, winner: "b" },
  { sessionId: "S2", teamA: ["A", "B"], teamB: ["C", "D"], scoreA: 21, scoreB: 10, winner: "a" },
];

describe("computeProfileStats — akumulasi lintas mabar", () => {
  const stats = computeProfileStats(matches);

  it("menghitung games, wins, losses per profil", () => {
    const a = stats.get("A")!;
    expect(a.games).toBe(3);
    expect(a.wins).toBe(2); // menang match 1 & 3, kalah match 2
    expect(a.losses).toBe(1);
    expect(a.draws).toBe(0);
  });

  it("menghitung poin scored/conceded", () => {
    const a = stats.get("A")!;
    // match1: +21/-15, match2: +18/-21, match3: +21/-10
    expect(a.pointsScored).toBe(21 + 18 + 21);
    expect(a.pointsConceded).toBe(15 + 21 + 10);
  });

  it("menghitung jumlah mabar (session) unik", () => {
    expect(stats.get("A")!.sessions).toBe(2); // S1 & S2
    expect(stats.get("D")!.sessions).toBe(2);
  });

  it("menghitung win rate persen", () => {
    // B menang match1,2,3 -> 3/3 = 100
    expect(stats.get("B")!.winRate).toBe(100);
    // C kalah semua -> 0
    expect(stats.get("C")!.winRate).toBe(0);
  });

  it("mengabaikan slot null (tak tertaut roster)", () => {
    const withNull: ResolvedMatch[] = [
      { sessionId: "X", teamA: ["A", null], teamB: ["C", "D"], scoreA: 21, scoreB: 5, winner: "a" },
    ];
    const s = computeProfileStats(withNull);
    expect(s.get("A")!.games).toBe(1);
    expect(s.has("null")).toBe(false);
    // total profil terhitung hanya A, C, D
    expect(s.size).toBe(3);
  });
});

describe("computeHeadToHead", () => {
  it("menghitung pertemuan A vs lawannya", () => {
    const h2h = computeHeadToHead(matches, "A");
    // A ketemu C & D di match1 (menang), match3 (menang); match2 A vs B,D (kalah)
    const vsD = h2h.find((h) => h.opponentId === "D")!;
    // match1: A(tim a) vs D(tim b) -> A menang
    // match2: A(tim a) vs D(tim b) -> A kalah
    // match3: A(tim a) vs D(tim b) -> A menang
    expect(vsD.meetings).toBe(3);
    expect(vsD.wins).toBe(2);
    expect(vsD.losses).toBe(1);

    const vsB = h2h.find((h) => h.opponentId === "B");
    // A & B selalu setim di match1,3; match2 mereka BERLAWANAN (A tim a, B tim b)
    expect(vsB?.meetings).toBe(1);
    expect(vsB?.losses).toBe(1);
  });

  it("tidak menghitung diri sendiri sebagai lawan", () => {
    const h2h = computeHeadToHead(matches, "A");
    expect(h2h.find((h) => h.opponentId === "A")).toBeUndefined();
  });
});

describe("computePartners", () => {
  it("menghitung partner tersering", () => {
    const partners = computePartners(matches, "A");
    // A setim dengan B di match1 & match3 -> 2; dengan C di match2 -> 1
    const withB = partners.find((p) => p.partnerId === "B")!;
    const withC = partners.find((p) => p.partnerId === "C")!;
    expect(withB.count).toBe(2);
    expect(withC.count).toBe(1);
    // urut terbanyak dulu
    expect(partners[0].partnerId).toBe("B");
  });
});
