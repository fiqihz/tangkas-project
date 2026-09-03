import { buildLeaderboard } from "@/lib/domain/leaderboard";
import type { SessionPlayer } from "@/lib/domain/types";

/**
 * Susun teks ringkasan hasil mabar untuk dibagikan (mis. paste ke grup WA).
 * Menampilkan juara + ranking lengkap yang ringkas.
 */
export function buildResultText(name: string, players: SessionPlayer[]): string {
  const rows = buildLeaderboard(players);
  const medals = ["🥇", "🥈", "🥉"];
  const lines = rows.map((r, i) => {
    const prefix = i < 3 ? medals[i] : `${r.rank}.`;
    return `${prefix} ${r.name} — ${r.wins}M/${r.losses}K · ${r.winRate}% WR`;
  });

  const header = `🏸 Hasil ${name}`;
  const body =
    rows.length > 0 ? lines.join("\n") : "Belum ada pemain yang bermain.";
  const footer = "— via TangkasBoard";
  return `${header}\n\n${body}\n\n${footer}`;
}

export type ShareOutcome = "shared" | "copied" | "failed";

/**
 * Bagikan teks hasil: pakai Web Share API bila tersedia (HP), jika tidak
 * fallback menyalin ke clipboard. Mengembalikan status untuk ditampilkan ke UI.
 */
export async function shareResultText(text: string): Promise<ShareOutcome> {
  // Web Share API (umumnya di perangkat mobile).
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "shared";
    } catch (e) {
      // User membatalkan share sheet -> jangan anggap error/keras.
      if (e instanceof DOMException && e.name === "AbortError") return "failed";
      // Lanjut coba clipboard sebagai fallback.
    }
  }

  // Fallback: salin ke clipboard.
  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === "function"
    ) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // jatuh ke failed
  }
  return "failed";
}
