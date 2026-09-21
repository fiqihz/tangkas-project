// ============================================================================
// IMPORT LIST PEMAIN — parser teks tempel (paste) jadi rencana import
// ============================================================================
// Host biasanya sudah punya daftar peserta mabar di grup WhatsApp / notes,
// misalnya:
//
//   1. Ryan ✅
//   2. ⁠nugroho ✅
//   3. ⁠Rusti
//
// Modul ini mengubah teks mentah seperti itu menjadi daftar baris terstruktur
// yang siap direview host sebelum dieksekusi. MURNI (tanpa I/O) agar mudah
// diuji: pemanggil (UI) yang menyediakan roster + pemain sesi, lalu
// mengeksekusi hasilnya lewat repo.
//
// Aturan yang didukung:
//  - Penomoran daftar dibuang: "1." "2)" "3 -" "- " "• " dst.
//  - Karakter tak terlihat hasil copy dari WhatsApp (word joiner / zero-width)
//    dibuang. Ini penting: tanpa ini "⁠nugroho" tidak akan cocok dengan
//    "Nugroho" di roster dan malah membuat pemain baru duplikat.
//  - Penanda lunas (✅ ✔ ✓ ☑ 💰, atau kata "lunas"/"sudah bayar") -> paid.
//    Kata negasi ("belum"/"blm") menang atas penanda apa pun.
//  - Nama dicocokkan ke roster secara persis dulu, lalu fuzzy (typo/nama
//    panggilan) bila tidak ada yang persis.
//  - Nama dobel di dalam satu tempelan digabung (status lunas di-OR).

import type { Gender, Level, PlayerProfile } from "./types";

/** Pemain yang sudah ada di sesi ini (subset dari SessionPlayer). */
export interface SessionPlayerRef {
  id: string;
  name: string;
  paid: boolean;
}

/**
 * Hasil pencocokan satu baris tempelan.
 *
 * - `exact`     nama persis sama dengan profil di roster -> tautkan.
 * - `fuzzy`     mirip dengan profil di roster (typo / nama panggilan) -> host
 *               memutuskan: tautkan atau buat pemain baru.
 * - `new`       tidak ada padanan -> buat profil roster baru (level & gender
 *               dibiarkan kosong, bisa di-set nanti).
 * - `session`   nama sudah terdaftar di mabar ini -> tidak ditambah lagi,
 *               tapi status bayarnya masih bisa disinkronkan.
 * - `duplicate` nama muncul lebih dari sekali di tempelan -> dilewati.
 */
export type ImportRowKind = "exact" | "fuzzy" | "new" | "session" | "duplicate";

export interface ImportRow {
  /** Id stabil untuk key React & state per baris. */
  id: string;
  /** Nomor baris di teks asli (1-based, hanya baris berisi). */
  line: number;
  /** Nama seperti diketik host (sudah dibersihkan + Title Case). */
  typedName: string;
  /** Nama final yang dipakai (nama roster bila tertaut, else typedName). */
  name: string;
  /** Host menandai baris ini sudah bayar. */
  paid: boolean;
  kind: ImportRowKind;
  /** Profil roster yang cocok (kind `exact` / `fuzzy`), else null. */
  profileId: string | null;
  /** Level dari profil yang cocok (null untuk pemain baru). */
  level: Level | null;
  /** Gender dari profil yang cocok (null untuk pemain baru). */
  gender: Gender | null;
  /** Baris `session`: id session_player + status bayarnya sekarang. */
  sessionPlayerId: string | null;
  sessionPaid: boolean;
  /** Skor kemiripan 0..1 untuk hasil fuzzy, else null. */
  similarity: number | null;
}

export interface ImportPlan {
  rows: ImportRow[];
  /** Jumlah baris teks yang berisi nama (setelah dibersihkan). */
  parsedLines: number;
}

// ---------------------------------------------------------------------------
// Normalisasi teks
// ---------------------------------------------------------------------------

/**
 * Karakter tak terlihat yang sering menempel saat copy dari WhatsApp/iOS:
 * soft hyphen, Mongolian vowel separator, zero-width space/joiner, penanda
 * arah teks, word joiner, dan variation selector-16 (ekor emoji).
 */
const INVISIBLE_CHARS =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF\uFE0F]/g;

/** Penanda "sudah bayar" berbentuk simbol/emoji. */
const PAID_SYMBOLS =
  /[\u2705\u2714\u2713\u2611\u{1F5F8}\u{1F4B0}\u{1F4B5}\u{1F4B8}]/u;

/** Penanda "sudah bayar" berbentuk kata. */
const PAID_WORDS =
  /\b(?:lunas|paid|settled|(?:sudah|sdh|udah|udh|dah)\s+(?:bayar|tf|transfer))\b/gi;

/** Penanda "belum bayar" — selalu menang atas penanda lunas apa pun. */
const UNPAID_WORDS = /\b(?:belum|blm|not\s*yet|unpaid)\b/gi;

/**
 * Kata bertema pembayaran yang harus dibuang dari nama. Lebih luas dari dua
 * pola di atas karena penanda sering ditulis terpisah ("Ryan belum bayar" ->
 * "belum" dikenali sebagai negasi, tapi "bayar" masih menempel di nama).
 */
const PAYMENT_NOISE =
  /\b(?:lunas|paid|unpaid|settled|bayar|byr|transfer|tf|cash|belum|blm|sudah|sdh|udah|udh|dah|not\s*yet)\b/gi;

/** Penomoran / bullet di awal baris: "1." "02)" "3 -" "- " "• " dst. */
const LIST_PREFIX = /^\s*(?:\(?\d{1,3}\)?\s*[.)\-:\]]?|[-*•·‣▪–—>])\s*/;

/** Anotasi dalam tanda kurung, mis. "Ryan (bli)" -> dibuang dari nama. */
const PARENTHETICAL = /[([{][^)\]}]*[)\]}]/g;

/**
 * Sisa karakter yang bukan bagian nama orang. Huruf (termasuk beraksen),
 * angka, spasi, dan beberapa tanda penghubung yang wajar dipertahankan.
 */
const NON_NAME_CHARS = /[^\p{L}\p{M}\p{N}\s'’\-.]/gu;

/** Tanda baca menggantung di ujung nama, mis. "Ryan -" atau "Ryan.". */
const EDGE_PUNCT = /^[\s'’\-.]+|[\s'’\-.]+$/g;

/**
 * Kunci pembanding nama: lowercase, tanpa diakritik, tanpa tanda baca, spasi
 * dirapatkan. "José M." dan "jose m" menghasilkan kunci yang sama.
 */
export function nameKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Title Case + rapikan spasi. Sengaja disalin tipis dari `@/lib/utils` agar
 * lapisan domain tetap bebas dependensi.
 */
function titleCase(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Satu baris tempelan setelah dibersihkan. */
export interface ParsedLine {
  line: number;
  name: string;
  paid: boolean;
}

/**
 * Pecah teks tempelan jadi baris-baris bernama + status bayar.
 * Baris kosong (atau yang hanya berisi penomoran/emoji) dibuang.
 */
export function parseImportText(text: string): ParsedLine[] {
  const out: ParsedLine[] = [];
  const rawLines = text.replace(INVISIBLE_CHARS, "").split(/\r?\n/);

  rawLines.forEach((rawLine, idx) => {
    // Status bayar diperiksa pada baris utuh (sebelum simbol dibuang), karena
    // penanda bisa berada di mana saja: "✅ Ryan" maupun "Ryan ✅".
    const unpaid = reset(UNPAID_WORDS).test(rawLine);
    const paid =
      !unpaid &&
      (PAID_SYMBOLS.test(rawLine) || reset(PAID_WORDS).test(rawLine));

    const name = titleCase(
      rawLine
        .replace(LIST_PREFIX, "")
        .replace(PARENTHETICAL, " ")
        .replace(reset(PAYMENT_NOISE), " ")
        .replace(NON_NAME_CHARS, " ")
        .replace(/\s+/g, " ")
        .replace(EDGE_PUNCT, ""),
    );

    // Butuh minimal satu huruf agar dianggap nama (menyaring baris "1." atau
    // baris yang isinya cuma emoji).
    if (!/\p{L}/u.test(name)) return;

    out.push({ line: idx + 1, name, paid });
  });

  return out;
}

/**
 * Regex ber-flag /g menyimpan `lastIndex` antar pemakaian; modul ini memakai
 * pola yang sama untuk `test` dan `replace`, jadi indeksnya dinolkan dulu.
 */
function reset(re: RegExp): RegExp {
  re.lastIndex = 0;
  return re;
}

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

/** Jarak edit Levenshtein (nama pendek, jadi DP penuh sudah cukup murah). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/** Panjang nama minimum agar boleh dicocokkan secara fuzzy. */
const MIN_FUZZY_LENGTH = 4;
/** Ambang kemiripan agar sebuah kandidat ditawarkan ke host. */
const MIN_SIMILARITY = 0.78;
/** Jarak edit maksimum yang masih dianggap salah tulis, bukan orang lain. */
const MAX_FUZZY_DISTANCE = 2;
/** Skor untuk nama panggilan yang jadi awalan utuh nama lengkap. */
const PREFIX_SIMILARITY = 0.9;
/** Diskon untuk kecocokan yang hanya mengandalkan token pertama. */
const TOKEN_MATCH_DISCOUNT = 0.95;

/**
 * Kemiripan dua nama, 0..1 (1 = identik, 0 = tidak layak disarankan).
 * Menggabungkan tiga heuristik yang berbeda watak:
 *
 *  1. Jarak edit ternormalisasi — menangkap salah ketik: "Rusti" ~ "Rusty".
 *  2. Awalan pada batas kata — menangkap nama panggilan vs nama lengkap:
 *     "Awal" ~ "Awal Prasetyo".
 *  3. Token pertama — kombinasi keduanya: "Rusti" ~ "Rusty Wijaya".
 *
 * Tiap heuristik lolos ambangnya masing-masing; skor akhir = yang tertinggi.
 * Nama sangat pendek ("Can", "Adi") hanya diterima bila persis sama, karena
 * terlalu mudah bertabrakan dengan orang lain.
 */
export function nameSimilarity(a: string, b: string): number {
  const x = nameKey(a);
  const y = nameKey(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (Math.min(x.length, y.length) < MIN_FUZZY_LENGTH) return 0;

  let best = 0;

  // 1. Jarak edit pada nama utuh.
  const dist = levenshtein(x, y);
  if (dist <= MAX_FUZZY_DISTANCE) {
    const sim = 1 - dist / Math.max(x.length, y.length);
    if (sim >= MIN_SIMILARITY) best = Math.max(best, sim);
  }

  const [shortName, longName] = x.length <= y.length ? [x, y] : [y, x];
  const hasToken = longName.includes(" ");

  // 2. Awalan harus berhenti tepat di batas kata, supaya "Ryan" tidak
  //    dianggap awalan "Ryandika" (orang yang berbeda).
  if (longName.startsWith(shortName) && longName[shortName.length] === " ") {
    best = Math.max(best, PREFIX_SIMILARITY);
  }

  // 3. Token pertama nama panjang vs nama pendek.
  if (hasToken) {
    const firstToken = longName.slice(0, longName.indexOf(" "));
    if (firstToken.length >= MIN_FUZZY_LENGTH && firstToken !== shortName) {
      const tokenDist = levenshtein(shortName, firstToken);
      if (tokenDist <= MAX_FUZZY_DISTANCE) {
        const tokenSim =
          1 - tokenDist / Math.max(shortName.length, firstToken.length);
        // Ambang diuji pada skor mentah; diskon hanya menurunkan prioritas
        // dibanding kecocokan nama utuh, bukan menggugurkan kandidatnya.
        if (tokenSim >= MIN_SIMILARITY) {
          best = Math.max(best, tokenSim * TOKEN_MATCH_DISCOUNT);
        }
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Penyusunan rencana import
// ---------------------------------------------------------------------------

export interface PlanImportInput {
  /** Roster community (profil tersimpan). */
  roster: PlayerProfile[];
  /** Pemain yang sudah terdaftar di mabar ini. */
  sessionPlayers: SessionPlayerRef[];
}

/**
 * Susun rencana import dari teks tempelan.
 *
 * Urutan penyelesaian tiap baris dibuat dari yang paling pasti ke paling
 * spekulatif, agar tidak pernah menebak saat ada jawaban yang jelas:
 *   1. nama dobel di dalam tempelan      -> duplicate (digabung ke yang pertama)
 *   2. persis sama dengan pemain di sesi  -> session
 *   3. persis sama dengan profil roster   -> exact (turun ke session bila
 *                                            profil itu sudah masuk sesi)
 *   4. mirip dengan profil roster         -> fuzzy
 *   5. mirip dengan pemain di sesi        -> session (via fuzzy)
 *   6. tidak ada padanan                 -> new
 *
 * Satu profil roster hanya boleh diklaim satu baris. Semua kecocokan persis
 * diklaim lebih dulu sebelum fuzzy dijalankan, supaya tempelan yang memuat
 * "Rusty" dan "Rusti" sekaligus tidak membuat "Rusti" mencuri profil "Rusty".
 * Di antara baris fuzzy sendiri, yang kemiripannya tertinggi memilih lebih
 * dulu (bukan urutan baris), agar hasilnya tidak bergantung pada urutan
 * tempelan.
 */
export function planImport(text: string, input: PlanImportInput): ImportPlan {
  const { roster, sessionPlayers } = input;
  const parsed = parseImportText(text);

  const profileByKey = new Map<string, PlayerProfile>();
  for (const p of roster) {
    const key = nameKey(p.name);
    // Roster bisa memuat nama kembar (tak ada unique constraint di DB);
    // ambil yang pertama agar deterministik.
    if (!profileByKey.has(key)) profileByKey.set(key, p);
  }

  const sessionByKey = new Map<string, SessionPlayerRef>();
  for (const sp of sessionPlayers) {
    const key = nameKey(sp.name);
    if (!sessionByKey.has(key)) sessionByKey.set(key, sp);
  }

  /** key nama -> index baris pertama yang memakainya. */
  const seenKeys = new Map<string, number>();
  /** Profil roster yang sudah diklaim baris lain. */
  const claimed = new Set<string>();
  /** Index baris yang belum ketemu padanan persis. */
  const pending: number[] = [];

  const rows: ImportRow[] = [];

  // --- Lintasan 1: dedup + kecocokan persis (sesi lalu roster) --------------
  for (const p of parsed) {
    const key = nameKey(p.name);

    const firstIdx = seenKeys.get(key);
    if (firstIdx !== undefined) {
      // Nama dobel: gabungkan status bayar ke baris pertama (tanda ✅ bisa
      // menempel di salah satu penyebutan saja), lalu catat sebagai duplikat.
      if (p.paid) rows[firstIdx].paid = true;
      rows.push(blankRow(p, key, "duplicate"));
      continue;
    }
    seenKeys.set(key, rows.length);

    const sessionHit = sessionByKey.get(key);
    if (sessionHit) {
      rows.push(sessionRow(blankRow(p, key, "session"), sessionHit, null));
      continue;
    }

    const profileHit = profileByKey.get(key);
    if (profileHit) {
      claimed.add(profileHit.id);
      rows.push(
        profileRow(blankRow(p, key, "exact"), profileHit, null, sessionByKey),
      );
      continue;
    }

    pending.push(rows.length);
    rows.push(blankRow(p, key, "new"));
  }

  // --- Lintasan 2: fuzzy ke roster -----------------------------------------
  // Kandidat dihitung sekali per baris (O(baris × roster)), lalu dibagikan
  // secara greedy dari kemiripan tertinggi.
  const candidates = new Map<number, { profile: PlayerProfile; sim: number }[]>();
  for (const idx of pending) {
    const typed = rows[idx].typedName;
    const list = roster
      .map((profile) => ({ profile, sim: nameSimilarity(typed, profile.name) }))
      .filter((c) => c.sim > 0)
      // Urutan nama dipakai sebagai pemecah seri agar hasil deterministik
      // (listProfiles mengurutkan roster berdasarkan nama).
      .sort((a, b) => b.sim - a.sim);
    if (list.length > 0) candidates.set(idx, list);
  }

  const unassigned = new Set(candidates.keys());
  while (unassigned.size > 0) {
    let pick: { idx: number; profile: PlayerProfile; sim: number } | null = null;

    for (const idx of unassigned) {
      const list = candidates.get(idx)!;
      // Buang kandidat yang sudah diklaim baris lain.
      while (list.length > 0 && claimed.has(list[0].profile.id)) list.shift();
      if (list.length === 0) continue;
      const top = list[0];
      if (!pick || top.sim > pick.sim) {
        pick = { idx, profile: top.profile, sim: top.sim };
      }
    }

    if (!pick) break; // sisa baris kehabisan kandidat
    claimed.add(pick.profile.id);
    unassigned.delete(pick.idx);
    rows[pick.idx] = profileRow(
      { ...rows[pick.idx], kind: "fuzzy" },
      pick.profile,
      pick.sim,
      sessionByKey,
    );
  }

  // --- Lintasan 3: fuzzy ke pemain sesi ------------------------------------
  // Untuk baris yang tetap tak punya padanan roster: mungkin sudah didaftarkan
  // manual di sesi ini dengan ejaan sedikit berbeda.
  for (const idx of pending) {
    const row = rows[idx];
    if (row.kind !== "new") continue;

    let best: { sp: SessionPlayerRef; sim: number } | null = null;
    for (const sp of sessionPlayers) {
      const sim = nameSimilarity(row.typedName, sp.name);
      if (sim > 0 && (!best || sim > best.sim)) best = { sp, sim };
    }
    if (best) {
      rows[idx] = sessionRow({ ...row, kind: "session" }, best.sp, best.sim);
    }
  }

  return { rows, parsedLines: parsed.length };
}

function blankRow(p: ParsedLine, key: string, kind: ImportRowKind): ImportRow {
  return {
    id: `${p.line}-${key}`,
    line: p.line,
    typedName: p.name,
    name: p.name,
    paid: p.paid,
    kind,
    profileId: null,
    level: null,
    gender: null,
    sessionPlayerId: null,
    sessionPaid: false,
    similarity: null,
  };
}

/** Lengkapi baris yang merujuk pemain yang sudah ada di sesi. */
function sessionRow(
  base: ImportRow,
  sp: SessionPlayerRef,
  similarity: number | null,
): ImportRow {
  return {
    ...base,
    kind: "session",
    name: sp.name,
    sessionPlayerId: sp.id,
    sessionPaid: sp.paid,
    similarity,
  };
}

/**
 * Lengkapi baris yang tertaut ke profil roster. Bila profil itu ternyata sudah
 * masuk sesi ini (mis. ditambahkan dari tab Roster sebelum import), baris turun
 * jadi `session` supaya pemainnya tidak dobel.
 */
function profileRow(
  base: ImportRow,
  profile: PlayerProfile,
  similarity: number | null,
  sessionByKey: Map<string, SessionPlayerRef>,
): ImportRow {
  const inSession = sessionByKey.get(nameKey(profile.name));
  if (inSession) return sessionRow(base, inSession, similarity);
  return {
    ...base,
    name: profile.name,
    profileId: profile.id,
    level: profile.level,
    gender: profile.gender,
    similarity,
  };
}

// ---------------------------------------------------------------------------
// Keputusan host + ringkasan untuk UI
// ---------------------------------------------------------------------------

/** Keputusan host atas satu baris (bisa diubah di layar preview). */
export interface RowDecision {
  /** false = baris dilewati. */
  selected: boolean;
  /** Hanya untuk baris fuzzy: pakai profil yang disarankan? */
  linkProfile: boolean;
  paid: boolean;
}

export interface ImportSummary {
  /** Akan ditambahkan ke sesi memakai profil roster yang sudah ada. */
  linked: number;
  /** Akan ditambahkan sebagai pemain baru (profil roster dibuat). */
  created: number;
  /** Baris hasil fuzzy — perlu dilihat host. */
  needsReview: number;
  /** Sudah ada di sesi (tidak ditambah lagi). */
  alreadyInSession: number;
  /** Nama dobel di dalam tempelan. */
  duplicates: number;
  /** Total pemain yang akan ditambahkan ke sesi. */
  toAdd: number;
  /** Dari yang ditambahkan, berapa yang langsung ditandai lunas. */
  paid: number;
  /** Status bayar pemain lama yang akan diperbarui. */
  paidUpdates: number;
}

/**
 * Ambang kemiripan untuk menautkan profil roster secara otomatis.
 *
 * Di bawah ambang ini host harus mengonfirmasi sendiri. Alasannya asimetri
 * akibat: salah tautkan berarti dua orang berbeda berbagi satu profil roster
 * (statistik lintas-mabar tercampur, dan tidak ada UI untuk memisahkannya
 * lagi), sedangkan salah buat baru hanya menyisakan entri roster kembar yang
 * bisa dihapus dari tab Roster. Jadi yang mahal dihindari, yang murah
 * dibiarkan jadi default.
 */
export const AUTO_LINK_SIMILARITY = 0.9;

/**
 * Keputusan awal: semua baris dicentang.
 *
 * - Saran fuzzy hanya diterima otomatis bila kemiripannya tinggi (lihat
 *   AUTO_LINK_SIMILARITY); sisanya default "buat baru" sampai host menyetujui.
 * - Status bayar tidak pernah diturunkan: pemain yang di sesi sudah tercatat
 *   lunas tetap lunas walau tempelan tidak memuat centang untuknya (host bisa
 *   menempel ulang daftar lama untuk menambah peserta baru — itu tidak boleh
 *   membatalkan pembayaran yang sudah tercatat).
 */
export function defaultDecisions(plan: ImportPlan): Map<string, RowDecision> {
  const out = new Map<string, RowDecision>();
  for (const row of plan.rows) {
    if (row.kind === "duplicate") continue;
    out.set(row.id, {
      selected: true,
      linkProfile:
        row.kind !== "fuzzy" || (row.similarity ?? 0) >= AUTO_LINK_SIMILARITY,
      paid: row.kind === "session" ? row.sessionPaid || row.paid : row.paid,
    });
  }
  return out;
}

/** Apakah baris ini akan memakai profil roster (bukan bikin baru)? */
function willLink(row: ImportRow, d: RowDecision): boolean {
  if (row.profileId === null) return false;
  return row.kind === "exact" || d.linkProfile;
}

export function summarize(
  plan: ImportPlan,
  decisions: Map<string, RowDecision>,
): ImportSummary {
  const s: ImportSummary = {
    linked: 0,
    created: 0,
    needsReview: 0,
    alreadyInSession: 0,
    duplicates: 0,
    toAdd: 0,
    paid: 0,
    paidUpdates: 0,
  };

  for (const row of plan.rows) {
    if (row.kind === "duplicate") {
      s.duplicates++;
      continue;
    }
    if (row.kind === "fuzzy") s.needsReview++;

    const d = decisions.get(row.id);
    if (!d?.selected) continue;

    if (row.kind === "session") {
      s.alreadyInSession++;
      if (row.sessionPlayerId && d.paid !== row.sessionPaid) s.paidUpdates++;
      continue;
    }

    if (willLink(row, d)) s.linked++;
    else s.created++;
    s.toAdd++;
    if (d.paid) s.paid++;
  }

  return s;
}

/** Satu pemain yang akan di-insert ke sesi. */
export interface ImportInsert {
  name: string;
  level: Level | null;
  gender: Gender | null;
  profileId: string | null;
  paid: boolean;
  /** true bila profil roster perlu dibuat lebih dulu. */
  needsProfile: boolean;
}

/** Perubahan status bayar untuk pemain yang sudah ada di sesi. */
export interface ImportPaidUpdate {
  sessionPlayerId: string;
  paid: boolean;
}

export interface ImportExecutionPlan {
  inserts: ImportInsert[];
  paidUpdates: ImportPaidUpdate[];
}

/**
 * Ubah rencana + keputusan host menjadi daftar operasi konkret.
 * Sengaja dipisah dari eksekusi agar bisa diuji tanpa menyentuh Supabase.
 */
export function buildExecutionPlan(
  plan: ImportPlan,
  decisions: Map<string, RowDecision>,
): ImportExecutionPlan {
  const inserts: ImportInsert[] = [];
  const paidUpdates: ImportPaidUpdate[] = [];

  for (const row of plan.rows) {
    if (row.kind === "duplicate") continue;
    const d = decisions.get(row.id);
    if (!d?.selected) continue;

    if (row.kind === "session") {
      // Hanya kirim update bila memang berubah, supaya tidak ada tulisan
      // sia-sia ke DB.
      if (row.sessionPlayerId && d.paid !== row.sessionPaid) {
        paidUpdates.push({ sessionPlayerId: row.sessionPlayerId, paid: d.paid });
      }
      continue;
    }

    const link = willLink(row, d);
    inserts.push({
      // Host menolak saran fuzzy -> pakai nama yang dia tulis, bukan nama roster.
      name: link ? row.name : row.typedName,
      level: link ? row.level : null,
      gender: link ? row.gender : null,
      profileId: link ? row.profileId : null,
      paid: d.paid,
      needsProfile: !link,
    });
  }

  return { inserts, paidUpdates };
}
