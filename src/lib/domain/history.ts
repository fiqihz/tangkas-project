import type { Match } from "./types";

/** Kunci pasangan tak-berurut (a|b === b|a). */
function pairKey(x: string, y: string): string {
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}

/**
 * Riwayat pertemuan pemain dalam satu sesi — dipakai untuk penalti
 * "ketemu itu-itu terus". Menghitung berapa kali sepasang pemain
 * pernah setim (partner) dan berapa kali saling berlawanan (opponent).
 */
export class MatchHistory {
  private partnerCount = new Map<string, number>();
  private opponentCount = new Map<string, number>();

  /** Catat sebuah match ke riwayat. */
  record(match: Match): void {
    const [a1, a2] = match.teamA.playerIds;
    const [b1, b2] = match.teamB.playerIds;

    this.bump(this.partnerCount, a1, a2);
    this.bump(this.partnerCount, b1, b2);

    for (const a of [a1, a2]) {
      for (const b of [b1, b2]) {
        this.bump(this.opponentCount, a, b);
      }
    }
  }

  /** Berapa kali dua pemain pernah setim. */
  partners(x: string, y: string): number {
    return this.partnerCount.get(pairKey(x, y)) ?? 0;
  }

  /** Berapa kali dua pemain pernah berlawanan. */
  opponents(x: string, y: string): number {
    return this.opponentCount.get(pairKey(x, y)) ?? 0;
  }

  private bump(map: Map<string, number>, x: string, y: string): void {
    const k = pairKey(x, y);
    map.set(k, (map.get(k) ?? 0) + 1);
  }

  /** Bangun riwayat dari daftar match yang sudah selesai. */
  static fromMatches(matches: Match[]): MatchHistory {
    const h = new MatchHistory();
    for (const m of matches) {
      if (m.state === "finished") h.record(m);
    }
    return h;
  }
}
