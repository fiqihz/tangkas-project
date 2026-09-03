// ============================================================================
// Agregasi statistik LINTAS-MABAR (per profil roster) + head-to-head.
// ============================================================================
// Berbeda dari leaderboard (yang per-sesi & berbasis session_player), modul ini
// menghitung statistik akumulatif seorang pemain di SEMUA mabar, di-key oleh
// profile_id (identitas roster yang persisten).
//
// Fungsi di sini MURNI (tanpa I/O) agar mudah diuji. Pemanggil (repo/UI)
// bertugas menyediakan data match yang sudah "diselesaikan" (finished) dengan
// tiap slot pemain sudah di-resolve ke profileId-nya.

/** Satu match yang sudah selesai, dengan tiap slot di-resolve ke profileId. */
export interface ResolvedMatch {
  sessionId: string;
  /** profileId 2 pemain tim A (null bila session_player tak tertaut roster). */
  teamA: [string | null, string | null];
  teamB: [string | null, string | null];
  scoreA: number;
  scoreB: number;
  winner: "a" | "b" | "draw";
}

/** Statistik akumulatif seorang profil di seluruh mabar. */
export interface ProfileStats {
  profileId: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  pointsScored: number;
  pointsConceded: number;
  /** Jumlah mabar (session) berbeda tempat pemain ini pernah main. */
  sessions: number;
  /** Win rate persen (menang / main * 100), 0 bila belum main. */
  winRate: number;
}

/** Ringkasan head-to-head profil ini melawan satu profil lawan. */
export interface HeadToHead {
  opponentId: string;
  /** Berapa kali saling berhadapan (sebagai lawan). */
  meetings: number;
  /** Menang saat berhadapan dengan lawan ini. */
  wins: number;
  losses: number;
  draws: number;
}

/** Ringkasan seberapa sering seorang profil berpasangan dengan profil lain. */
export interface PartnerCount {
  partnerId: string;
  count: number;
}

function emptyStats(profileId: string): ProfileStats {
  return {
    profileId,
    games: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsScored: 0,
    pointsConceded: 0,
    sessions: 0,
    winRate: 0,
  };
}

/**
 * Hitung statistik akumulatif per profil dari daftar match yang sudah selesai.
 * Slot bernilai null (tak tertaut roster) diabaikan.
 */
export function computeProfileStats(
  matches: ResolvedMatch[],
): Map<string, ProfileStats> {
  const map = new Map<string, ProfileStats>();
  // Lacak sesi unik per profil untuk menghitung "jumlah mabar".
  const sessionsByProfile = new Map<string, Set<string>>();

  const ensure = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = emptyStats(id);
      map.set(id, s);
    }
    if (!sessionsByProfile.has(id)) sessionsByProfile.set(id, new Set());
    return s;
  };

  for (const m of matches) {
    const aIds = m.teamA.filter((x): x is string => x !== null);
    const bIds = m.teamB.filter((x): x is string => x !== null);

    for (const id of aIds) {
      const s = ensure(id);
      s.games += 1;
      s.pointsScored += m.scoreA;
      s.pointsConceded += m.scoreB;
      if (m.winner === "a") s.wins += 1;
      else if (m.winner === "b") s.losses += 1;
      else s.draws += 1;
      sessionsByProfile.get(id)!.add(m.sessionId);
    }
    for (const id of bIds) {
      const s = ensure(id);
      s.games += 1;
      s.pointsScored += m.scoreB;
      s.pointsConceded += m.scoreA;
      if (m.winner === "b") s.wins += 1;
      else if (m.winner === "a") s.losses += 1;
      else s.draws += 1;
      sessionsByProfile.get(id)!.add(m.sessionId);
    }
  }

  for (const s of map.values()) {
    s.sessions = sessionsByProfile.get(s.profileId)?.size ?? 0;
    s.winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
  }

  return map;
}

/**
 * Head-to-head satu profil melawan semua lawan yang pernah dihadapi.
 * Diurutkan dari yang paling sering ketemu.
 */
export function computeHeadToHead(
  matches: ResolvedMatch[],
  profileId: string,
): HeadToHead[] {
  const byOpp = new Map<string, HeadToHead>();

  const bump = (
    oppId: string,
    result: "win" | "loss" | "draw",
  ) => {
    let h = byOpp.get(oppId);
    if (!h) {
      h = { opponentId: oppId, meetings: 0, wins: 0, losses: 0, draws: 0 };
      byOpp.set(oppId, h);
    }
    h.meetings += 1;
    if (result === "win") h.wins += 1;
    else if (result === "loss") h.losses += 1;
    else h.draws += 1;
  };

  for (const m of matches) {
    const aIds = m.teamA.filter((x): x is string => x !== null);
    const bIds = m.teamB.filter((x): x is string => x !== null);
    const inA = aIds.includes(profileId);
    const inB = bIds.includes(profileId);
    if (!inA && !inB) continue;

    // Lawan = pemain di tim seberang.
    const opponents = inA ? bIds : aIds;
    const myResult: "win" | "loss" | "draw" =
      m.winner === "draw"
        ? "draw"
        : (inA && m.winner === "a") || (inB && m.winner === "b")
          ? "win"
          : "loss";

    for (const opp of opponents) {
      if (opp === profileId) continue; // jaga-jaga data aneh
      bump(opp, myResult);
    }
  }

  return Array.from(byOpp.values()).sort(
    (x, y) => y.meetings - x.meetings || y.wins - x.wins,
  );
}

/**
 * Partner tersering satu profil (berapa kali setim dengan profil lain),
 * diurutkan dari yang paling sering.
 */
export function computePartners(
  matches: ResolvedMatch[],
  profileId: string,
): PartnerCount[] {
  const byPartner = new Map<string, number>();
  for (const m of matches) {
    for (const team of [m.teamA, m.teamB]) {
      const ids = team.filter((x): x is string => x !== null);
      if (!ids.includes(profileId)) continue;
      for (const id of ids) {
        if (id === profileId) continue;
        byPartner.set(id, (byPartner.get(id) ?? 0) + 1);
      }
    }
  }
  return Array.from(byPartner.entries())
    .map(([partnerId, count]) => ({ partnerId, count }))
    .sort((a, b) => b.count - a.count);
}
