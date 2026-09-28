import { describe, expect, it } from "vitest";
import { buildLeaderboard } from "@/lib/domain/leaderboard";
import { makePlayer } from "@/lib/domain/test-helpers";
import type { Match } from "@/lib/domain/types";
import { buildResultText } from "@/lib/share-result";
import {
  buildShareImagePayload,
  parseShareImagePayload,
  SHARE_IMAGE_MAX_ROWS,
} from "@/lib/share-image";

// Skenario di mana ranking total-mentah BERBEDA dari ranking per-set:
//   M1 (1 set) : X1,X2 menang 21-19          -> per set 21,   mentah 21
//   M2 (3 set) : Z1,Z2 menang 21-19,19-21,21-19 -> per set 20.3, mentah 61
// Skema lama menaruh Z di atas (61 > 21); skema per-set (§21) menaruh X di atas.
function scenario() {
  const players = [
    makePlayer("Xa", "beginner", { id: "X1", gamesPlayed: 1, wins: 1, pointsScored: 21, pointsConceded: 19 }),
    makePlayer("Xb", "beginner", { id: "X2", gamesPlayed: 1, wins: 1, pointsScored: 21, pointsConceded: 19 }),
    makePlayer("Ya", "beginner", { id: "Y1", gamesPlayed: 1, losses: 1, pointsScored: 19, pointsConceded: 21 }),
    makePlayer("Yb", "beginner", { id: "Y2", gamesPlayed: 1, losses: 1, pointsScored: 19, pointsConceded: 21 }),
    makePlayer("Za", "beginner", { id: "Z1", gamesPlayed: 1, wins: 1, pointsScored: 61, pointsConceded: 59 }),
    makePlayer("Zb", "beginner", { id: "Z2", gamesPlayed: 1, wins: 1, pointsScored: 61, pointsConceded: 59 }),
    makePlayer("Wa", "beginner", { id: "W1", gamesPlayed: 1, losses: 1, pointsScored: 59, pointsConceded: 61 }),
    makePlayer("Wb", "beginner", { id: "W2", gamesPlayed: 1, losses: 1, pointsScored: 59, pointsConceded: 61 }),
  ];
  const matches: Match[] = [
    {
      id: "m1",
      courtId: "c1",
      round: 1,
      teamA: { playerIds: ["X1", "X2"] },
      teamB: { playerIds: ["Y1", "Y2"] },
      state: "finished",
      score: { a: 21, b: 19 },
      sets: [{ a: 21, b: 19 }],
      winner: "a",
      shuttlecocks: 0,
    },
    {
      id: "m2",
      courtId: "c2",
      round: 1,
      teamA: { playerIds: ["Z1", "Z2"] },
      teamB: { playerIds: ["W1", "W2"] },
      state: "finished",
      score: { a: 61, b: 59 },
      sets: [
        { a: 21, b: 19 },
        { a: 19, b: 21 },
        { a: 21, b: 19 },
      ],
      winner: "a",
      shuttlecocks: 0,
    },
  ];
  return { players, matches };
}

describe("buildResultText", () => {
  it("memakai ranking per-set yang sama dengan layar", () => {
    const { players, matches } = scenario();
    const screen = buildLeaderboard(players, matches).map((r) => r.name);
    expect(screen[0]).toBe("Xa");

    const lines = buildResultText("Mabar", players, matches)
      .split("\n")
      .filter((l) => l.includes("M/"));
    const textOrder = lines.map((l) => l.replace(/^\S+\s/, "").split(" — ")[0]);
    expect(textOrder).toEqual(screen);
  });
});

describe("share image payload", () => {
  const base = () => {
    const { players, matches } = scenario();
    return buildShareImagePayload({
      format: "story",
      lang: "id",
      sessionName: "Mabar Senin",
      communityName: "PB Tangkas",
      dateLabel: "Senin, 28 September 2026",
      matchCount: 2,
      rows: buildLeaderboard(players, matches),
    });
  };

  it("membatasi baris ke podium + 5 (maks 8) dan mencatat total pemain", () => {
    const { players, matches } = scenario();
    const many = [
      ...players,
      makePlayer("Extra1", "beginner", { id: "E1" }),
      makePlayer("Extra2", "beginner", { id: "E2" }),
    ];
    const p = buildShareImagePayload({
      format: "square",
      lang: "en",
      sessionName: "S",
      communityName: "",
      dateLabel: "",
      matchCount: 2,
      rows: buildLeaderboard(many, matches),
    });
    expect(p.rows).toHaveLength(SHARE_IMAGE_MAX_ROWS);
    expect(p.playerCount).toBe(10);
    expect(p.rows[0].rank).toBe(1);
  });

  it("payload valid lolos parse tanpa berubah", () => {
    const p = base();
    expect(parseShareImagePayload(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });

  it("menolak bentuk yang salah", () => {
    const p = base();
    expect(parseShareImagePayload(null)).toBeNull();
    expect(parseShareImagePayload({ ...p, format: "banner" })).toBeNull();
    expect(parseShareImagePayload({ ...p, lang: "fr" })).toBeNull();
    expect(parseShareImagePayload({ ...p, rows: [] })).toBeNull();
    expect(
      parseShareImagePayload({ ...p, rows: Array(SHARE_IMAGE_MAX_ROWS + 1).fill(p.rows[0]) }),
    ).toBeNull();
    expect(
      parseShareImagePayload({ ...p, rows: [{ ...p.rows[0], winRate: 150 }] }),
    ).toBeNull();
    expect(
      parseShareImagePayload({ ...p, rows: [{ ...p.rows[0], name: "   " }] }),
    ).toBeNull();
  });

  it("memotong teks panjang & membuang karakter kontrol", () => {
    const p = base();
    const parsed = parseShareImagePayload({
      ...p,
      sessionName: `Mabar\n\t${"x".repeat(200)}`,
      rows: [{ ...p.rows[0], name: "A".repeat(100) }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.sessionName.startsWith("Mabar x")).toBe(true);
    expect(parsed!.sessionName.length).toBeLessThanOrEqual(60);
    expect(parsed!.rows[0].name.length).toBeLessThanOrEqual(40);
  });
});
