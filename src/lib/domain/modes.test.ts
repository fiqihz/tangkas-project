import { describe, expect, it } from "vitest";
import { MatchHistory } from "./history";
import { generateMatch } from "./matchmaking";
import { isValidMatchupForMode } from "./rules";
import { makePlayer } from "./test-helpers";
import type { Gender, Level } from "./types";

function p(
  name: string,
  level: Level,
  gender: Gender | null,
  id?: string,
) {
  return makePlayer(name, level, { gender, id: id ?? name });
}

describe("mode: mixed (ganda campuran)", () => {
  it("tiap tim harus 1 cowok + 1 cewek", () => {
    const pool = [
      p("M1", "beginner", "male"),
      p("F1", "beginner", "female"),
      p("M2", "intermediate", "male"),
      p("F2", "intermediate", "female"),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "mixed");
    expect(m).not.toBeNull();
    // validasi: tiap tim campuran
    const byId = new Map(pool.map((x) => [x.id, x]));
    const ok = isValidMatchupForMode(
      byId.get(m!.teamA[0])!,
      byId.get(m!.teamA[1])!,
      byId.get(m!.teamB[0])!,
      byId.get(m!.teamB[1])!,
      "mixed",
    );
    expect(ok).toBe(true);
  });

  it("gagal bila tidak cukup salah satu gender", () => {
    const pool = [
      p("M1", "beginner", "male"),
      p("M2", "beginner", "male"),
      p("M3", "intermediate", "male"),
      p("F1", "intermediate", "female"),
    ];
    // cuma 1 cewek -> tidak bisa 2 tim campuran
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "mixed");
    expect(m).toBeNull();
  });
});

describe("mode: ladies (ganda putri)", () => {
  it("semua wanita & Newbie+Newbie DI-RELAX (boleh)", () => {
    const pool = [
      p("F1", "newbie", "female"),
      p("F2", "newbie", "female"),
      p("F3", "newbie", "female"),
      p("F4", "beginner", "female"),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "ladies");
    expect(m).not.toBeNull(); // walau ada Newbie+Newbie, tetap terbentuk
  });

  it("tolak bila ada pemain non-wanita", () => {
    const pool = [
      p("F1", "beginner", "female"),
      p("F2", "beginner", "female"),
      p("F3", "beginner", "female"),
      p("M1", "beginner", "male"),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "ladies");
    expect(m).toBeNull();
  });
});

describe("mode: gendongan", () => {
  it("tiap tim = 1 kuat + 1 lemah", () => {
    const pool = [
      p("Adv1", "advanced", null),
      p("New1", "newbie", null),
      p("Int1", "intermediate", null),
      p("Beg1", "beginner", null),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "gendongan");
    expect(m).not.toBeNull();
    const byId = new Map(pool.map((x) => [x.id, x]));
    const strong = (id: string) => {
      const lv = byId.get(id)!.level;
      return lv === "intermediate" || lv === "advanced";
    };
    // tiap tim tepat 1 kuat
    expect(strong(m!.teamA[0]) !== strong(m!.teamA[1])).toBe(true);
    expect(strong(m!.teamB[0]) !== strong(m!.teamB[1])).toBe(true);
  });

  it("gagal bila komposisi tidak memungkinkan (4 kuat)", () => {
    const pool = [
      p("A1", "advanced", null),
      p("A2", "advanced", null),
      p("I1", "intermediate", null),
      p("I2", "intermediate", null),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "gendongan");
    expect(m).toBeNull(); // tidak ada yang lemah
  });
});

describe("mode: kelas", () => {
  it("memasangkan sesama level", () => {
    const pool = [
      p("B1", "beginner", null),
      p("B2", "beginner", null),
      p("B3", "beginner", null),
      p("B4", "beginner", null),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "kelas");
    expect(m).not.toBeNull();
  });

  it("hard rule Newbie+Newbie tetap berlaku di mode kelas", () => {
    const n1 = p("N1", "newbie", null);
    const n2 = p("N2", "newbie", null);
    const n3 = p("N3", "newbie", null);
    const n4 = p("N4", "newbie", null);
    expect(isValidMatchupForMode(n1, n2, n3, n4, "kelas")).toBe(false);
  });

  it("tolak Intermediate/Intermediate vs Advanced/Advanced (kelas beda)", () => {
    const i1 = p("I1", "intermediate", null);
    const i2 = p("I2", "intermediate", null);
    const a1 = p("A1", "advanced", null);
    const a2 = p("A2", "advanced", null);
    // Tim seragam masing-masing, tapi antar tim beda kelas -> tidak valid.
    expect(isValidMatchupForMode(i1, i2, a1, a2, "kelas")).toBe(false);
  });

  it("terima Intermediate vs Intermediate (kelas sama)", () => {
    const i1 = p("I1", "intermediate", null);
    const i2 = p("I2", "intermediate", null);
    const i3 = p("I3", "intermediate", null);
    const i4 = p("I4", "intermediate", null);
    expect(isValidMatchupForMode(i1, i2, i3, i4, "kelas")).toBe(true);
  });

  it("generateMatch kelas gagal bila hanya ada 2 Int + 2 Adv", () => {
    const pool = [
      p("I1", "intermediate", null),
      p("I2", "intermediate", null),
      p("A1", "advanced", null),
      p("A2", "advanced", null),
    ];
    const m = generateMatch(pool, new MatchHistory(), 2, undefined, "kelas");
    expect(m).toBeNull(); // tidak ada 4 pemain sekelas
  });
});
