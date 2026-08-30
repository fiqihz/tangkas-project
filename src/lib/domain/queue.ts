import type { SessionPlayer } from "./types";

/**
 * Urutkan pemain berdasarkan prioritas antrian main:
 *   1. gamesPlayed terendah (jatah main paling sedikit) didahulukan
 *   2. lastPlayedRound terlama (yang paling lama tidak main) didahulukan
 *      - pemain yang belum pernah main (null) paling didahulukan
 *   3. availableSinceRound terkecil (paling lama menunggu) didahulukan
 *   4. nama (stabil, deterministik)
 *
 * Catatan: penalti "baru selesai main" tidak dipakai untuk memblok pemain,
 * tetapi tercermin lewat lastPlayedRound (baru main = round besar = belakang).
 */
export function sortByQueuePriority(players: SessionPlayer[]): SessionPlayer[] {
  return [...players].sort((a, b) => {
    if (a.gamesPlayed !== b.gamesPlayed) return a.gamesPlayed - b.gamesPlayed;

    const al = a.lastPlayedRound ?? -1;
    const bl = b.lastPlayedRound ?? -1;
    if (al !== bl) return al - bl; // lebih kecil (lebih lama tidak main) dulu

    if (a.availableSinceRound !== b.availableSinceRound) {
      return a.availableSinceRound - b.availableSinceRound;
    }
    return a.name.localeCompare(b.name);
  });
}

/**
 * Ambil pool pemain yang tersedia untuk dimainkan pada ronde tertentu:
 * hanya status "active", dan (untuk auto) sudah punya level.
 * Pemain yang sedang bermain di match lain harus di-exclude oleh pemanggil
 * (lewat `excludeIds`).
 */
export function availablePool(
  players: SessionPlayer[],
  opts: { requireLevel: boolean; excludeIds?: Set<string> } = {
    requireLevel: true,
  },
): SessionPlayer[] {
  const exclude = opts.excludeIds ?? new Set<string>();
  return players.filter((p) => {
    if (exclude.has(p.id)) return false;
    if (p.status !== "active") return false;
    if (opts.requireLevel && p.level === null) return false;
    return true;
  });
}
