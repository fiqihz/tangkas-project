import { buildLeaderboard } from "@/lib/domain/leaderboard";
import type { Match, SessionPlayer } from "@/lib/domain/types";

/**
 * Susun teks ringkasan hasil mabar untuk dibagikan (mis. paste ke grup WA).
 * Menampilkan juara + ranking lengkap yang ringkas.
 *
 * `matches` wajib dikirim agar ranking memakai poin ternormalisasi per set —
 * sama persis dengan urutan di layar Skor / Hasil Akhir (§21).
 */
export function buildResultText(
  name: string,
  players: SessionPlayer[],
  matches: Match[],
): string {
  const rows = buildLeaderboard(players, matches);
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

/** Apakah browser bisa membagikan file gambar lewat share sheet (HP). */
export function canShareImageFile(file: File): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  );
}

export type ImageShareOutcome = "shared" | "cancelled" | "failed";

/**
 * Bagikan file gambar lewat Web Share API. Harus dipanggil langsung dari tap
 * user (tanpa await panjang sebelumnya) — Safari iOS menolak share bila
 * "user gesture"-nya sudah kedaluwarsa. Karena itu gambar dibuat duluan di
 * layar preview, baru tombol ini memanggil share.
 */
export async function shareImageFile(file: File): Promise<ImageShareOutcome> {
  try {
    await navigator.share({ files: [file] });
    return "shared";
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    return "failed";
  }
}

/** Fallback desktop / browser tanpa share file: unduh gambar. */
export function downloadImageFile(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Beri jeda agar unduhan sempat mulai sebelum URL dicabut.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
