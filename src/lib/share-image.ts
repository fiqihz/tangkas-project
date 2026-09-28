// ============================================================================
// Kontrak data gambar hasil mabar (dipakai client & route /api/share-image).
// ============================================================================
// Client menyusun payload dari leaderboard yang SAMA dengan yang tampil di
// layar (buildLeaderboard + matches), lalu mengirimnya ke server untuk
// dirender jadi PNG. Server tidak membaca database, jadi RLS tidak perlu
// dilonggarkan. Karena payload datang dari client, server wajib memvalidasi
// ulang lewat `parseShareImagePayload` (batas panjang teks, jumlah baris, dll).
// ============================================================================
import type { LeaderboardRow } from "@/lib/domain/leaderboard";
import type { Lang } from "@/lib/i18n/dict";

export type ShareImageFormat = "story" | "square";

export const SHARE_IMAGE_SIZE: Record<
  ShareImageFormat,
  { width: number; height: number }
> = {
  story: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

/** Podium (3) + peringkat 4–8. Sisanya diringkas jadi "+N pemain lain". */
export const SHARE_IMAGE_MAX_ROWS = 8;

const MAX_NAME = 40;
const MAX_SESSION_NAME = 60;
const MAX_COMMUNITY_NAME = 60;
const MAX_DATE_LABEL = 60;
const MAX_COUNT = 10_000;

export interface ShareImageRow {
  rank: number;
  name: string;
  wins: number;
  losses: number;
  winRate: number;
  /** Poin tampil (dibulatkan) — hanya dipakai untuk juara 1. */
  points: number;
}

export interface ShareImagePayload {
  format: ShareImageFormat;
  lang: Lang;
  sessionName: string;
  communityName: string;
  /** Tanggal yang sudah diformat sesuai bahasa di client (mis. "Senin, 28 September 2026"). */
  dateLabel: string;
  matchCount: number;
  /** Total pemain yang main (bisa > jumlah `rows`). */
  playerCount: number;
  rows: ShareImageRow[];
}

/** Susun payload dari leaderboard layar. `rows` sudah terurut (rank 1..n). */
export function buildShareImagePayload(input: {
  format: ShareImageFormat;
  lang: Lang;
  sessionName: string;
  communityName: string;
  dateLabel: string;
  matchCount: number;
  rows: LeaderboardRow[];
}): ShareImagePayload {
  return {
    format: input.format,
    lang: input.lang,
    sessionName: input.sessionName,
    communityName: input.communityName,
    dateLabel: input.dateLabel,
    matchCount: input.matchCount,
    playerCount: input.rows.length,
    rows: input.rows.slice(0, SHARE_IMAGE_MAX_ROWS).map((r) => ({
      rank: r.rank,
      name: r.name,
      wins: r.wins,
      losses: r.losses,
      winRate: r.winRate,
      points: r.pointsDisplay,
    })),
  };
}

/** Format tanggal mabar sesuai bahasa. Kosong bila tanggal tidak valid. */
export function formatShareDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Validasi server-side
// ---------------------------------------------------------------------------

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // Buang karakter kontrol; rapikan spasi; potong panjang.
  const s = v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return s.slice(0, max);
}

function cleanInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  if (n < min || n > max) return null;
  return n;
}

/**
 * Validasi & normalisasi payload dari client. Mengembalikan null bila bentuknya
 * salah. Teks dipotong (bukan ditolak) supaya nama panjang tetap bisa dirender.
 */
export function parseShareImagePayload(raw: unknown): ShareImagePayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const format = o.format === "story" || o.format === "square" ? o.format : null;
  const lang = o.lang === "id" || o.lang === "en" ? o.lang : null;
  const sessionName = cleanText(o.sessionName, MAX_SESSION_NAME);
  const communityName = cleanText(o.communityName ?? "", MAX_COMMUNITY_NAME);
  const dateLabel = cleanText(o.dateLabel ?? "", MAX_DATE_LABEL);
  const matchCount = cleanInt(o.matchCount, 0, MAX_COUNT);
  const playerCount = cleanInt(o.playerCount, 0, MAX_COUNT);
  if (
    !format ||
    !lang ||
    !sessionName ||
    communityName === null ||
    dateLabel === null ||
    matchCount === null ||
    playerCount === null ||
    !Array.isArray(o.rows) ||
    o.rows.length === 0 ||
    o.rows.length > SHARE_IMAGE_MAX_ROWS
  ) {
    return null;
  }

  const rows: ShareImageRow[] = [];
  for (const item of o.rows) {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const rank = cleanInt(r.rank, 1, MAX_COUNT);
    const name = cleanText(r.name, MAX_NAME);
    const wins = cleanInt(r.wins, 0, MAX_COUNT);
    const losses = cleanInt(r.losses, 0, MAX_COUNT);
    const winRate = cleanInt(r.winRate, 0, 100);
    const points = cleanInt(r.points, -1_000_000, 1_000_000);
    if (
      rank === null ||
      !name ||
      wins === null ||
      losses === null ||
      winRate === null ||
      points === null
    ) {
      return null;
    }
    rows.push({ rank, name, wins, losses, winRate, points });
  }

  return {
    format,
    lang,
    sessionName,
    communityName,
    dateLabel,
    matchCount,
    playerCount: Math.max(playerCount, rows.length),
    rows,
  };
}
