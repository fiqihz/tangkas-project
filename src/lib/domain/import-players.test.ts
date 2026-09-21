import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  AUTO_LINK_SIMILARITY,
  buildExecutionPlan,
  defaultDecisions,
  levenshtein,
  nameKey,
  nameSimilarity,
  parseImportText,
  planImport,
  summarize,
  type ImportRow,
  type PlanImportInput,
  type SessionPlayerRef,
} from "./import-players";
import type { PlayerProfile } from "./types";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const profile = (
  id: string,
  name: string,
  level: PlayerProfile["level"] = null,
  gender: PlayerProfile["gender"] = null,
): PlayerProfile => ({ id, name, level, gender });

const empty: PlanImportInput = { roster: [], sessionPlayers: [] };

const byName = (rows: ImportRow[], name: string) =>
  rows.find((r) => r.typedName === name)!;

/** Word joiner (U+2060) — karakter yang ikut tersalin dari WhatsApp. */
const WJ = "\u2060";

// Daftar asli dari host (WhatsApp), lengkap dengan word joiner yang menempel
// di baris 2 ke bawah.
const WA_LIST = [
  "1. Ryan ✅",
  `2. ${WJ} nugroho ✅`,
  `3. ${WJ} Rusti ✅`,
  `4. ${WJ} Susy ✅`,
  `5. ${WJ} Fadlu ✅`,
  `6. ${WJ} Vivi ✅`,
  `7. ${WJ} Nyoman ✅`,
  `8. ${WJ} Fiqih`,
  `9. ${WJ} Ikhsan ✅`,
  `10. ${WJ} Zakki`,
  `11. ${WJ} Can ✅`,
  `12. ${WJ} Farikin ✅`,
  `13. ${WJ} Addrian`,
  `14. ${WJ} Tryan `,
  `15. ${WJ} Adit`,
  `16. ${WJ} rizky`,
  `17. ${WJ} awal ✅`,
].join("\n");

// ---------------------------------------------------------------------------
// parseImportText
// ---------------------------------------------------------------------------

describe("parseImportText — daftar asli dari WhatsApp", () => {
  const lines = parseImportText(WA_LIST);

  it("membaca 17 nama", () => {
    expect(lines).toHaveLength(17);
  });

  it("membuang penomoran & karakter tak terlihat, lalu Title Case", () => {
    expect(lines.map((l) => l.name)).toEqual([
      "Ryan",
      "Nugroho",
      "Rusti",
      "Susy",
      "Fadlu",
      "Vivi",
      "Nyoman",
      "Fiqih",
      "Ikhsan",
      "Zakki",
      "Can",
      "Farikin",
      "Addrian",
      "Tryan",
      "Adit",
      "Rizky",
      "Awal",
    ]);
  });

  it("menandai baris bercentang sebagai lunas, sisanya belum", () => {
    expect(lines.filter((l) => l.paid)).toHaveLength(11);
    expect(lines.filter((l) => !l.paid).map((l) => l.name)).toEqual([
      "Fiqih",
      "Zakki",
      "Addrian",
      "Tryan",
      "Adit",
      "Rizky",
    ]);
  });

  it("menyimpan nomor baris asli", () => {
    expect(lines[0].line).toBe(1);
    expect(lines[16].line).toBe(17);
  });
});

describe("parseImportText — variasi format", () => {
  it("menerima berbagai gaya penomoran & bullet", () => {
    const lines = parseImportText(
      ["1. Ryan", "2) Budi", "3 - Citra", "- Dedi", "• Eka", "(6) Fajar", "7: Gita"].join(
        "\n",
      ),
    );
    expect(lines.map((l) => l.name)).toEqual([
      "Ryan",
      "Budi",
      "Citra",
      "Dedi",
      "Eka",
      "Fajar",
      "Gita",
    ]);
  });

  it("membuang baris kosong, baris hanya nomor, dan baris hanya emoji", () => {
    const lines = parseImportText("Ryan\n\n   \n5.\n✅\nBudi");
    expect(lines.map((l) => l.name)).toEqual(["Ryan", "Budi"]);
  });

  it("mengenali penanda lunas apa pun posisinya", () => {
    const lines = parseImportText(
      ["✅ Ryan", "Budi ✔️", "Citra ✓", "Dedi ☑️", "Eka 💰", "Fajar lunas", "Gita sudah bayar"].join(
        "\n",
      ),
    );
    expect(lines.every((l) => l.paid)).toBe(true);
    expect(lines.map((l) => l.name)).toEqual([
      "Ryan",
      "Budi",
      "Citra",
      "Dedi",
      "Eka",
      "Fajar",
      "Gita",
    ]);
  });

  it("kata negasi mengalahkan penanda lunas", () => {
    const lines = parseImportText(
      ["Ryan belum bayar", "Budi blm", "Citra belum ✅", "Dedi belum tf"].join("\n"),
    );
    expect(lines.map((l) => l.paid)).toEqual([false, false, false, false]);
    // Kata bertema pembayaran tidak boleh nyangkut jadi bagian nama.
    expect(lines.map((l) => l.name)).toEqual(["Ryan", "Budi", "Citra", "Dedi"]);
  });

  it("membuang sisa kata pembayaran dari nama", () => {
    expect(parseImportText("1. Ryan sudah transfer").map((l) => l.name)).toEqual(["Ryan"]);
    expect(parseImportText("1. Ryan cash ✅")[0]).toMatchObject({ name: "Ryan", paid: true });
  });

  it("baris yang isinya hanya kata pembayaran ikut terbuang", () => {
    expect(parseImportText("Ryan ✅\nbelum bayar:\nBudi").map((l) => l.name)).toEqual([
      "Ryan",
      "Budi",
    ]);
  });

  it("membuang anotasi dalam tanda kurung", () => {
    expect(parseImportText("1. Nyoman (bli) ✅")[0]).toMatchObject({
      name: "Nyoman",
      paid: true,
    });
  });

  it("mempertahankan nama majemuk & tanda penghubung di dalam nama", () => {
    const lines = parseImportText("1. rizky pede ✅\n2. Ade-Putra\n3. O'Brien");
    // Title Case mengikuti perilaku toTitleCase aplikasi: kapital hanya di awal
    // kata yang dipisah spasi.
    expect(lines.map((l) => l.name)).toEqual(["Rizky Pede", "Ade-putra", "O'brien"]);
  });

  it("menerima baris tanpa penomoran sama sekali", () => {
    expect(parseImportText("Ryan\nBudi").map((l) => l.name)).toEqual(["Ryan", "Budi"]);
  });
});

// ---------------------------------------------------------------------------
// Fuzzy
// ---------------------------------------------------------------------------

describe("levenshtein", () => {
  it("menghitung jarak edit dasar", () => {
    expect(levenshtein("rusti", "rusty")).toBe(1);
    expect(levenshtein("ryan", "tryan")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("sama", "sama")).toBe(0);
  });
});

describe("nameKey", () => {
  it("mengabaikan besar-kecil huruf, diakritik, dan tanda baca", () => {
    expect(nameKey("José M.")).toBe(nameKey("jose m"));
    expect(nameKey("  Ryan   Pede ")).toBe("ryan pede");
  });
});

describe("nameSimilarity", () => {
  it("memberi 1 untuk nama yang sama (beda penulisan)", () => {
    expect(nameSimilarity("nugroho", "Nugroho")).toBe(1);
  });

  it("mengenali salah ketik satu huruf", () => {
    expect(nameSimilarity("Rusti", "Rusty")).toBeGreaterThanOrEqual(0.78);
    expect(nameSimilarity("Rizki", "Rizky")).toBeGreaterThanOrEqual(0.78);
  });

  it("mengenali nama panggilan sebagai awalan nama lengkap", () => {
    expect(nameSimilarity("Awal", "Awal Prasetyo")).toBeGreaterThanOrEqual(0.9);
  });

  it("mengenali salah ketik pada token pertama nama lengkap", () => {
    expect(nameSimilarity("Rusti", "Rusty Wijaya")).toBeGreaterThan(0);
  });

  it("menolak nama pendek (terlalu mudah bertabrakan)", () => {
    expect(nameSimilarity("Can", "Cak")).toBe(0);
    expect(nameSimilarity("Adi", "Adit")).toBe(0);
  });

  it("menolak awalan yang tidak berhenti di batas kata", () => {
    // "Ryan" vs "Ryandika" adalah dua orang berbeda, bukan singkatan.
    expect(nameSimilarity("Ryan", "Ryandika")).toBe(0);
  });

  it("menolak nama yang jelas berbeda", () => {
    expect(nameSimilarity("Adit", "Addrian")).toBe(0);
    expect(nameSimilarity("Fiqih", "Farikin")).toBe(0);
    expect(nameSimilarity("Zakki", "Ikhsan")).toBe(0);
  });

  it("simetris", () => {
    expect(nameSimilarity("Rusti", "Rusty")).toBe(nameSimilarity("Rusty", "Rusti"));
  });
});

// ---------------------------------------------------------------------------
// planImport
// ---------------------------------------------------------------------------

describe("planImport — pencocokan ke roster", () => {
  it("menautkan nama yang persis sama, termasuk yang ada karakter tak terlihat", () => {
    const plan = planImport(`1. Ryan ✅\n2. ${WJ} nugroho`, {
      roster: [profile("p1", "Ryan", "intermediate", "male"), profile("p2", "Nugroho", "beginner")],
      sessionPlayers: [],
    });

    expect(plan.rows).toHaveLength(2);
    expect(plan.rows[0]).toMatchObject({
      kind: "exact",
      name: "Ryan",
      profileId: "p1",
      level: "intermediate",
      gender: "male",
      paid: true,
    });
    expect(plan.rows[1]).toMatchObject({ kind: "exact", profileId: "p2", paid: false });
  });

  it("menandai nama mirip sebagai fuzzy beserta skor kemiripannya", () => {
    const plan = planImport("1. Rusti ✅", {
      roster: [profile("p1", "Rusty", "advanced", "female")],
      sessionPlayers: [],
    });

    expect(plan.rows[0]).toMatchObject({
      kind: "fuzzy",
      typedName: "Rusti",
      name: "Rusty",
      profileId: "p1",
      level: "advanced",
      paid: true,
    });
    expect(plan.rows[0].similarity).toBeGreaterThanOrEqual(0.78);
  });

  it("membuat pemain baru tanpa level & gender bila tak ada padanan", () => {
    const plan = planImport("1. Zakki", { roster: [profile("p1", "Ryan")], sessionPlayers: [] });
    expect(plan.rows[0]).toMatchObject({
      kind: "new",
      name: "Zakki",
      profileId: null,
      level: null,
      gender: null,
    });
  });

  it("kecocokan persis diklaim lebih dulu, jadi nama mirip tidak mencurinya", () => {
    // Keduanya orang berbeda dan keduanya ada di tempelan; "Rusty" harus dapat
    // profilnya, "Rusti" tidak boleh ikut menempel ke profil yang sama.
    const plan = planImport("1. Rusti\n2. Rusty", {
      roster: [profile("p1", "Rusty")],
      sessionPlayers: [],
    });

    expect(byName(plan.rows, "Rusty")).toMatchObject({ kind: "exact", profileId: "p1" });
    expect(byName(plan.rows, "Rusti")).toMatchObject({ kind: "new", profileId: null });
  });

  it("satu profil roster tidak pernah diklaim dua baris", () => {
    const plan = planImport("1. Rusti\n2. Rustu", {
      roster: [profile("p1", "Rusty")],
      sessionPlayers: [],
    });
    const claimed = plan.rows.map((r) => r.profileId).filter((id): id is string => id !== null);
    expect(new Set(claimed).size).toBe(claimed.length);
  });

  it("baris fuzzy dengan kemiripan tertinggi memilih profil lebih dulu", () => {
    // "Rustya" (jarak 1) harus menang atas "Rustix" (jarak 2) walau ditulis
    // belakangan, jadi hasilnya tak bergantung urutan tempelan.
    const plan = planImport("1. Rustix\n2. Rustya", {
      roster: [profile("p1", "Rusty")],
      sessionPlayers: [],
    });
    expect(byName(plan.rows, "Rustya")).toMatchObject({ kind: "fuzzy", profileId: "p1" });
    expect(byName(plan.rows, "Rustix")).toMatchObject({ kind: "new", profileId: null });
  });
});

describe("planImport — nama dobel di dalam tempelan", () => {
  it("menggabungkan status lunas ke penyebutan pertama", () => {
    const plan = planImport("1. Ryan\n2. ryan ✅", empty);
    expect(plan.rows[0]).toMatchObject({ kind: "new", name: "Ryan", paid: true });
    expect(plan.rows[1]).toMatchObject({ kind: "duplicate", name: "Ryan" });
  });

  it("duplikat tidak ikut dieksekusi", () => {
    const plan = planImport("1. Ryan ✅\n2. Ryan ✅", empty);
    const decisions = defaultDecisions(plan);
    expect(buildExecutionPlan(plan, decisions).inserts).toHaveLength(1);
    expect(summarize(plan, decisions).duplicates).toBe(1);
  });
});

describe("planImport — pemain yang sudah ada di sesi", () => {
  const sessionPlayers: SessionPlayerRef[] = [
    { id: "sp1", name: "Addrian", paid: false },
    { id: "sp2", name: "Vivi", paid: true },
  ];

  it("tidak menambah ulang, tapi mencatat perubahan status bayar", () => {
    const plan = planImport("1. Addrian ✅\n2. Vivi ✅", { roster: [], sessionPlayers });

    expect(plan.rows[0]).toMatchObject({
      kind: "session",
      sessionPlayerId: "sp1",
      sessionPaid: false,
      paid: true,
    });
    expect(plan.rows[1]).toMatchObject({ kind: "session", sessionPlayerId: "sp2", sessionPaid: true });

    const exec = buildExecutionPlan(plan, defaultDecisions(plan));
    expect(exec.inserts).toHaveLength(0);
    // Hanya Addrian yang berubah (Vivi sudah lunas) -> tidak ada tulisan sia-sia.
    expect(exec.paidUpdates).toEqual([{ sessionPlayerId: "sp1", paid: true }]);
  });

  it("profil roster yang sudah masuk sesi turun jadi baris session", () => {
    const plan = planImport("1. Addrian", {
      roster: [profile("p1", "Addrian", "beginner")],
      sessionPlayers,
    });
    expect(plan.rows[0]).toMatchObject({ kind: "session", sessionPlayerId: "sp1" });
    expect(buildExecutionPlan(plan, defaultDecisions(plan)).inserts).toHaveLength(0);
  });

  it("nama mirip dengan pemain sesi juga tidak ditambah dobel", () => {
    const plan = planImport("1. Adrian", { roster: [], sessionPlayers });
    expect(plan.rows[0]).toMatchObject({ kind: "session", sessionPlayerId: "sp1" });
  });
});

// ---------------------------------------------------------------------------
// Keputusan host
// ---------------------------------------------------------------------------

describe("buildExecutionPlan — keputusan host", () => {
  const plan = planImport("1. Rusti ✅\n2. Zakki\n3. Ryan ✅", {
    roster: [profile("p1", "Rusty", "advanced", "female"), profile("p2", "Ryan", "newbie", "male")],
    sessionPlayers: [],
  });

  it("default: kemiripan rendah belum ditautkan, pakai nama yang diketik host", () => {
    const exec = buildExecutionPlan(plan, defaultDecisions(plan));
    expect(exec.inserts).toEqual([
      { name: "Rusti", level: null, gender: null, profileId: null, paid: true, needsProfile: true },
      { name: "Zakki", level: null, gender: null, profileId: null, paid: false, needsProfile: true },
      { name: "Ryan", level: "newbie", gender: "male", profileId: "p2", paid: true, needsProfile: false },
    ]);
  });

  it("host menyetujui saran fuzzy -> pakai profil roster beserta level & gendernya", () => {
    const decisions = defaultDecisions(plan);
    const fuzzy = plan.rows.find((r) => r.kind === "fuzzy")!;
    decisions.set(fuzzy.id, { selected: true, linkProfile: true, paid: true });

    const exec = buildExecutionPlan(plan, decisions);
    expect(exec.inserts[0]).toEqual({
      name: "Rusty",
      level: "advanced",
      gender: "female",
      profileId: "p1",
      paid: true,
      needsProfile: false,
    });
  });

  it("kemiripan tinggi (nama panggilan) ditautkan otomatis", () => {
    const nickname = planImport("1. Awal ✅", {
      roster: [profile("p1", "Awal Prasetyo", "beginner", "male")],
      sessionPlayers: [],
    });
    expect(nickname.rows[0]).toMatchObject({ kind: "fuzzy", profileId: "p1" });
    expect(nickname.rows[0].similarity).toBeGreaterThanOrEqual(AUTO_LINK_SIMILARITY);
    expect(buildExecutionPlan(nickname, defaultDecisions(nickname)).inserts[0]).toMatchObject({
      name: "Awal Prasetyo",
      profileId: "p1",
      needsProfile: false,
    });
  });

  it("baris exact tidak terpengaruh linkProfile", () => {
    const decisions = defaultDecisions(plan);
    const exact = plan.rows.find((r) => r.kind === "exact")!;
    decisions.set(exact.id, { selected: true, linkProfile: false, paid: true });
    expect(buildExecutionPlan(plan, decisions).inserts).toContainEqual(
      expect.objectContaining({ name: "Ryan", profileId: "p2" }),
    );
  });

  it("baris yang tidak dicentang dilewati", () => {
    const decisions = defaultDecisions(plan);
    for (const [id, d] of decisions) decisions.set(id, { ...d, selected: false });
    expect(buildExecutionPlan(plan, decisions).inserts).toHaveLength(0);
  });

  it("status lunas bisa dikoreksi per baris", () => {
    const decisions = defaultDecisions(plan);
    const zakki = plan.rows.find((r) => r.typedName === "Zakki")!;
    decisions.set(zakki.id, { selected: true, linkProfile: true, paid: true });
    const exec = buildExecutionPlan(plan, decisions);
    expect(exec.inserts.find((i) => i.name === "Zakki")?.paid).toBe(true);
  });
});

describe("summarize", () => {
  it("meringkas rencana sesuai kategori", () => {
    const plan = planImport(
      ["1. Ryan ✅", "2. Rusti ✅", "3. Zakki", "4. ryan", "5. Vivi ✅"].join("\n"),
      {
        roster: [profile("p1", "Ryan"), profile("p2", "Rusty")],
        sessionPlayers: [{ id: "sp1", name: "Vivi", paid: false }],
      },
    );
    const s = summarize(plan, defaultDecisions(plan));

    expect(s).toMatchObject({
      linked: 1, // Ryan (exact)
      created: 2, // Zakki + Rusti (saran fuzzy belum disetujui host)
      needsReview: 1, // Rusti
      alreadyInSession: 1, // Vivi
      duplicates: 1, // "ryan" di baris 4
      toAdd: 3,
      paid: 2, // Ryan & Rusti
      paidUpdates: 1, // Vivi belum lunas -> jadi lunas
    });
  });
});

describe("defaultDecisions — status bayar", () => {
  it("tidak pernah menurunkan pemain yang sudah lunas di sesi", () => {
    // Skenario nyata: host menempel ulang daftar LAMA (tanpa centang untuk
    // Vivi) cuma untuk menambah peserta baru. Pembayaran Vivi yang sudah
    // tercatat tidak boleh ikut dibatalkan.
    const plan = planImport("1. Vivi\n2. Zakki", {
      roster: [],
      sessionPlayers: [{ id: "sp1", name: "Vivi", paid: true }],
    });
    const decisions = defaultDecisions(plan);

    expect(decisions.get(plan.rows[0].id)?.paid).toBe(true);
    expect(buildExecutionPlan(plan, decisions).paidUpdates).toEqual([]);
  });

  it("host masih bisa membatalkan status lunas secara eksplisit", () => {
    const plan = planImport("1. Vivi", {
      roster: [],
      sessionPlayers: [{ id: "sp1", name: "Vivi", paid: true }],
    });
    const decisions = defaultDecisions(plan);
    decisions.set(plan.rows[0].id, { selected: true, linkProfile: true, paid: false });
    expect(buildExecutionPlan(plan, decisions).paidUpdates).toEqual([
      { sessionPlayerId: "sp1", paid: false },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Skenario utuh: daftar asli host
// ---------------------------------------------------------------------------

describe("skenario utuh — daftar WhatsApp host", () => {
  // Roster sudah memuat sebagian nama; "Rusty" ejaannya beda tipis dari
  // tempelan ("Rusti") dan "Awal Prasetyo" ditulis singkat ("awal").
  const roster = [
    profile("p-ryan", "Ryan", "intermediate", "male"),
    profile("p-nugroho", "Nugroho", "beginner", "male"),
    profile("p-rusty", "Rusty", "advanced", "female"),
    profile("p-fiqih", "Fiqih", "newbie", "male"),
    profile("p-awal", "Awal Prasetyo", "beginner", "male"),
    profile("p-addrian", "Addrian", "beginner", "male"),
  ];

  const plan = planImport(WA_LIST, { roster, sessionPlayers: [] });

  it("memproses semua 17 baris", () => {
    expect(plan.rows).toHaveLength(17);
    expect(plan.parsedLines).toBe(17);
  });

  it("menautkan yang persis ada di roster", () => {
    for (const name of ["Ryan", "Nugroho", "Fiqih", "Addrian"]) {
      expect(byName(plan.rows, name).kind).toBe("exact");
    }
  });

  it("menyarankan padanan untuk typo & nama singkat", () => {
    expect(byName(plan.rows, "Rusti")).toMatchObject({ kind: "fuzzy", profileId: "p-rusty" });
    expect(byName(plan.rows, "Awal")).toMatchObject({
      kind: "fuzzy",
      profileId: "p-awal",
      name: "Awal Prasetyo",
    });
  });

  it("sisanya jadi pemain baru dengan level & gender kosong", () => {
    const created = plan.rows.filter((r) => r.kind === "new");
    expect(created.map((r) => r.name).sort()).toEqual(
      ["Adit", "Can", "Farikin", "Ikhsan", "Nyoman", "Rizky", "Susy", "Tryan", "Vivi", "Zakki", "Fadlu"].sort(),
    );
    expect(created.every((r) => r.level === null && r.gender === null)).toBe(true);
  });

  it("Tryan tidak tertukar dengan Ryan karena Ryan sudah diklaim", () => {
    expect(byName(plan.rows, "Tryan")).toMatchObject({ kind: "new", profileId: null });
  });

  it("status lunas terbawa ke rencana eksekusi", () => {
    const exec = buildExecutionPlan(plan, defaultDecisions(plan));
    expect(exec.inserts).toHaveLength(17);
    expect(exec.inserts.filter((i) => i.paid)).toHaveLength(11);
    // Tertaut tanpa campur tangan host: 4 nama persis + "awal" (kemiripan
    // tinggi ke "Awal Prasetyo"). "Rusti" -> "Rusty" masih menunggu
    // persetujuan, jadi ikut hitungan pemain baru.
    expect(exec.inserts.filter((i) => i.needsProfile)).toHaveLength(12);
  });
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

/**
 * Nama yang masuk akal: huruf & spasi saja, dan **lolos parser tanpa berubah**.
 *
 * Dua batasan itu disengaja. Nama roster/sesi datang dari DB (sudah bersih),
 * sementara teks tempelan justru dibersihkan dulu — kalau generator bebas
 * menghasilkan nama seperti "a tf" (mengandung kata penanda pembayaran), yang
 * teruji cuma artefak generator, bukan perilaku pencocokan nama yang jadi pokok
 * properti di bawah.
 */
const nameArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz ".split("")), {
    minLength: 1,
    maxLength: 10,
  })
  .map((chars) => chars.join("").trim())
  .filter((s) => {
    if (!/\p{L}/u.test(s)) return false;
    const parsed = parseImportText(s);
    return parsed.length === 1 && nameKey(parsed[0].name) === nameKey(s);
  });

describe("planImport — properti", () => {
  it("tidak pernah memberi profil roster yang sama ke dua baris", () => {
    fc.assert(
      fc.property(
        fc.array(nameArb, { maxLength: 12 }),
        fc.array(nameArb, { maxLength: 6 }),
        (typed, rosterNames) => {
          const roster = rosterNames.map((n, i) => profile(`p${i}`, n));
          const plan = planImport(typed.join("\n"), { roster, sessionPlayers: [] });
          const claimed = plan.rows
            .map((r) => r.profileId)
            .filter((id): id is string => id !== null);
          expect(new Set(claimed).size).toBe(claimed.length);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("setiap baris hasil selalu punya nama berisi huruf", () => {
    fc.assert(
      fc.property(fc.array(fc.string({ maxLength: 20 }), { maxLength: 15 }), (lines) => {
        for (const row of planImport(lines.join("\n"), empty).rows) {
          expect(row.name.trim().length).toBeGreaterThan(0);
          expect(/\p{L}/u.test(row.name)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("jumlah insert + duplikat + sudah-di-sesi = jumlah baris terbaca", () => {
    fc.assert(
      fc.property(fc.array(nameArb, { maxLength: 12 }), (typed) => {
        const plan = planImport(typed.join("\n"), empty);
        const decisions = defaultDecisions(plan);
        const s = summarize(plan, decisions);
        const exec = buildExecutionPlan(plan, decisions);
        expect(exec.inserts.length).toBe(s.toAdd);
        expect(s.toAdd + s.duplicates + s.alreadyInSession).toBe(plan.rows.length);
      }),
      { numRuns: 200 },
    );
  });

  it("nama yang sudah ada di sesi tidak pernah di-insert ulang", () => {
    fc.assert(
      fc.property(fc.array(nameArb, { minLength: 1, maxLength: 10 }), (names) => {
        const sessionPlayers = names.map((n, i) => ({
          id: `sp${i}`,
          name: n,
          paid: false,
        }));
        const plan = planImport(names.join("\n"), { roster: [], sessionPlayers });
        const exec = buildExecutionPlan(plan, defaultDecisions(plan));
        expect(exec.inserts).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });
});
