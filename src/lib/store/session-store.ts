"use client";

import { create } from "zustand";
import { MatchHistory } from "@/lib/domain/history";
import { generateMatch } from "@/lib/domain/matchmaking";
import { availablePool } from "@/lib/domain/queue";
import { findSubstitute } from "@/lib/domain/substitute";
import type {
  Level,
  Match,
  MatchMode,
  PlayerStatus,
  SessionPlayer,
} from "@/lib/domain/types";
import * as repo from "@/lib/supabase/repo";
import { toMatch, toSessionPlayer } from "@/lib/supabase/mappers";
import type { DbCourt, DbSession } from "@/lib/supabase/types";

interface SessionState {
  loading: boolean;
  /** Daftar semua mabar (list mabar di main page). */
  sessions: DbSession[];
  /** Sesi yang sedang dibuka di board (null = di list mabar). */
  session: DbSession | null;
  courts: DbCourt[];
  players: SessionPlayer[];
  matches: Match[];
  error: string | null;
  /** Peta id session_player -> profile_id (untuk sinkron level ke roster). */
  profileIdOf: Record<string, string | null>;

  // lifecycle
  loadSessions: () => Promise<void>;
  openSession: (sessionId: string) => Promise<void>;
  backToList: () => void;
  createSession: (opts: {
    name: string;
    courts: number;
    status?: "scheduled" | "ongoing";
    scheduledAt?: string | null;
    courtLabels?: string[];
    open?: boolean;
  }) => Promise<DbSession | null>;
  startSession: (sessionId: string) => Promise<void>;
  reactivateSession: (sessionId: string) => Promise<{ ok: boolean; reason?: string }>;
  deleteSession: (sessionId: string) => Promise<void>;
  finishSession: () => Promise<void>;
  refresh: () => Promise<void>;

  // roster/players
  addPlayer: (p: {
    name: string;
    level: Level | null;
    gender?: "male" | "female" | null;
    profileId?: string | null;
    status?: PlayerStatus;
  }) => Promise<void>;
  setPlayerLevel: (playerId: string, level: Level) => Promise<void>;
  setPlayerStatus: (playerId: string, status: PlayerStatus) => Promise<void>;

  // courts
  addCourt: () => Promise<void>;
  removeCourt: (courtId: string) => Promise<void>;
  renameCourt: (courtId: string, label: string) => Promise<void>;

  // matches
  currentMatchByCourt: (courtId: string) => Match | undefined;
  courtMatchNumber: (courtId: string, matchId: string) => number;
  busyPlayerIds: () => Set<string>;
  setManualMatch: (
    courtId: string,
    teamA: [string, string],
    teamB: [string, string],
  ) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  playingMatchByCourt: (courtId: string) => Match | undefined;
  proposedMatchByCourt: (courtId: string) => Match | undefined;
  generateLockedPreview: (
    courtId: string | null,
    mode?: MatchMode,
  ) => Promise<{ ok: boolean; reason?: string }>;
  setPlayerGender: (playerId: string, gender: "male" | "female") => Promise<void>;
  editProposedPlayer: (
    matchId: string,
    outId: string,
    inId: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  restProposedPlayer: (
    matchId: string,
    playerId: string,
  ) => Promise<{ ok: boolean; reason?: string }>;
  finishMatch: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winner: "a" | "b" | "draw",
  ) => Promise<void>;
  editMatchScore: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    winner: "a" | "b" | "draw",
  ) => Promise<{ ok: boolean; reason?: string }>;
  substituteInProposed: (
    matchId: string,
    leavingId: string,
    leavingStatus?: PlayerStatus,
  ) => Promise<{ ok: boolean; reason?: string }>;
  manualSubstitute: (
    matchId: string,
    leavingId: string,
    replacementId: string,
    leavingStatus?: PlayerStatus,
  ) => Promise<{ ok: boolean; reason?: string }>;
  substituteCandidates: (
    matchId: string,
    leavingId: string,
  ) => {
    preferred: SessionPlayer[];
    others: SessionPlayer[];
    playing: SessionPlayer[];
    sameMatch: SessionPlayer[];
  };
  incrementSessionsForPlayed: () => Promise<void>;

  /** Hasil akhir sesi yang baru saja diselesaikan (untuk halaman Final Result). */
  finishedResult: { name: string; players: SessionPlayer[] } | null;
  clearFinishedResult: () => void;
}

function byIdMap(players: SessionPlayer[]) {
  return new Map(players.map((p) => [p.id, p]));
}

export const useSessionStore = create<SessionState>((set, get) => ({
  loading: true,
  sessions: [],
  session: null,
  courts: [],
  players: [],
  matches: [],
  error: null,
  profileIdOf: {},
  finishedResult: null,

  async loadSessions() {
    set({ loading: true, error: null });
    try {
      const sessions = await repo.listSessions();
      set({ sessions, loading: false });
    } catch (e) {
      set({ error: describe(e), loading: false });
    }
  },

  async openSession(sessionId) {
    set({ loading: true, error: null });
    try {
      const session = await repo.getSession(sessionId);
      if (!session) {
        set({ loading: false, error: "Sesi tidak ditemukan." });
        return;
      }
      const [courts, players, matches] = await Promise.all([
        repo.listCourts(session.id),
        repo.listSessionPlayers(session.id),
        repo.listMatches(session.id),
      ]);
      set({
        session,
        courts,
        players: players.map(toSessionPlayer),
        matches: matches.map(toMatch),
        profileIdOf: Object.fromEntries(players.map((p) => [p.id, p.profile_id])),
        loading: false,
      });
    } catch (e) {
      set({ error: describe(e), loading: false });
    }
  },

  backToList() {
    set({ session: null, courts: [], players: [], matches: [], profileIdOf: {} });
    void get().loadSessions();
  },

  async refresh() {
    const { session } = get();
    if (!session) return;
    const [courts, players, matches] = await Promise.all([
      repo.listCourts(session.id),
      repo.listSessionPlayers(session.id),
      repo.listMatches(session.id),
    ]);
    set({
      courts,
      players: players.map(toSessionPlayer),
      matches: matches.map(toMatch),
      profileIdOf: Object.fromEntries(players.map((p) => [p.id, p.profile_id])),
    });
  },

  async createSession(opts) {
    set({ error: null });
    try {
      // Batasi hanya 1 ongoing dalam satu waktu.
      if ((opts.status ?? "ongoing") === "ongoing") {
        const existing = await repo.getOngoingSession();
        if (existing) {
          set({
            error:
              "Sudah ada mabar yang sedang berjalan. Selesaikan dulu sebelum memulai yang baru.",
          });
          return null;
        }
      }
      const session = await repo.createSession({
        name: opts.name,
        courts: opts.courts,
        status: opts.status ?? "ongoing",
        scheduledAt: opts.scheduledAt ?? null,
        courtLabels: opts.courtLabels,
      });
      await get().loadSessions();
      if (opts.open) {
        await get().openSession(session.id);
      }
      return session;
    } catch (e) {
      set({ error: describe(e) });
      return null;
    }
  },

  async startSession(sessionId) {
    // scheduled -> ongoing (batasi 1 ongoing)
    const existing = await repo.getOngoingSession();
    if (existing && existing.id !== sessionId) {
      set({
        error:
          "Sudah ada mabar yang sedang berjalan. Selesaikan dulu sebelum memulai yang lain.",
      });
      return;
    }
    await repo.updateSession(sessionId, { status: "ongoing" });
    await get().openSession(sessionId);
  },

  async reactivateSession(sessionId) {
    // finished -> ongoing. Batasi 1 ongoing. Undo counter "ikut mabar" agar
    // tidak dobel saat nanti di-SELESAI-MABAR lagi.
    const existing = await repo.getOngoingSession();
    if (existing && existing.id !== sessionId) {
      return {
        ok: false,
        reason: "Ada mabar lain yang sedang berjalan. Selesaikan dulu.",
      };
    }
    // muat data sesi untuk hitung siapa yang tadi ke-increment
    const players = await repo.listSessionPlayers(sessionId);
    const profileIds = players
      .filter((p) => p.games_played > 0 && p.profile_id)
      .map((p) => p.profile_id as string);
    await repo.decrementSessionsPlayed(profileIds);
    await repo.updateSession(sessionId, { status: "ongoing" });
    await get().openSession(sessionId);
    return { ok: true };
  },

  async deleteSession(sessionId) {
    await repo.deleteSession(sessionId);
    await get().loadSessions();
  },

  async finishSession() {
    const { session, players } = get();
    if (!session) return;
    // counter "ikut mabar" +1 untuk pemain yang benar-benar main (task #4)
    await get().incrementSessionsForPlayed();
    await repo.finishSession(session.id);
    // simpan snapshot hasil akhir untuk halaman Final Result
    set({
      finishedResult: {
        name: session.name,
        players: players.filter((p) => p.gamesPlayed > 0),
      },
      // keluar dari board; setelah tutup Final Result -> kembali ke list
      session: null,
      courts: [],
      players: [],
      matches: [],
      profileIdOf: {},
    });
    await get().loadSessions();
  },

  clearFinishedResult() {
    set({ finishedResult: null });
  },

  async addPlayer(p) {
    const { session } = get();
    if (!session) return;
    await repo.addSessionPlayer(session.id, p);
    await get().refresh();
  },

  async setPlayerLevel(playerId, level) {
    const { players, profileIdOf } = get();
    const player = players.find((p) => p.id === playerId);
    await repo.updateSessionPlayer(playerId, { level });

    // Sinkron level ke roster (player_profile) agar persisten lintas mabar.
    const profileId = profileIdOf[playerId] ?? null;
    if (profileId) {
      // sudah terhubung ke profil -> update level-nya
      await repo.updateProfile(profileId, { level });
    } else if (player) {
      // belum punya profil (pemain baru diinput manual) -> buat & tautkan
      try {
        const created = await repo.createProfile(player.name, level);
        await repo.linkSessionPlayerProfile(playerId, created.id);
      } catch {
        // kalau nama sudah ada di roster, cukup abaikan pembuatan duplikat
      }
    }

    await get().refresh();
  },

  async setPlayerGender(playerId, gender) {
    const { players, profileIdOf } = get();
    const player = players.find((p) => p.id === playerId);
    await repo.updateSessionPlayer(playerId, { gender });
    // Sinkron ke roster agar persisten lintas mabar.
    const profileId = profileIdOf[playerId] ?? null;
    if (profileId) {
      await repo.updateProfile(profileId, { gender });
    } else if (player) {
      try {
        const created = await repo.createProfile(player.name, player.level, gender);
        await repo.linkSessionPlayerProfile(playerId, created.id);
      } catch {
        // abaikan bila nama sudah ada di roster
      }
    }
    await get().refresh();
  },

  async setPlayerStatus(playerId, status) {
    const { session, players } = get();
    if (!session) return;
    const player = players.find((p) => p.id === playerId);
    const patch: Record<string, unknown> = { status };
    // saat balik/aktif, catat kapan mulai menunggu
    if (status === "active") {
      patch.available_since_round = session.current_round;
      // catat waktu check-in pertama kali (untuk sort urutan kedatangan)
      if (!player?.checkedInAt) {
        patch.checked_in_at = new Date().toISOString();
      }
    }
    await repo.updateSessionPlayer(playerId, patch);
    await get().refresh();
  },

  async addCourt() {
    const { session, courts } = get();
    if (!session) return;
    await repo.addCourt(session.id, courts.length);
    await repo.updateSession(session.id, { courts: courts.length + 1 });
    await get().refresh();
    set({ session: { ...session, courts: courts.length + 1 } });
  },

  async renameCourt(courtId, label) {
    await repo.updateCourtLabel(courtId, label.trim() || "Lapangan");
    await get().refresh();
  },

  async removeCourt(courtId) {
    const { session, courts, matches } = get();
    if (!session) return;

    // Tangani match aktif di lapangan ini sebelum court dihapus:
    //  - proposed (belum mulai) -> batalkan (hapus match), pemain balik active
    //  - playing (berjalan)     -> tandai 'unfinished' (masuk history), pemain balik active
    const activeMatch = matches.find(
      (m) =>
        m.courtId === courtId &&
        (m.state === "proposed" || m.state === "playing"),
    );
    if (activeMatch) {
      const playerIds = [
        ...activeMatch.teamA.playerIds,
        ...activeMatch.teamB.playerIds,
      ];
      // kembalikan pemain ke antrian (active) agar bisa di-generate lagi
      await Promise.all(
        playerIds.map((id) =>
          repo.updateSessionPlayer(id, { status: "active" }),
        ),
      );
      if (activeMatch.state === "proposed") {
        await repo.deleteMatch(activeMatch.id);
      } else {
        await repo.updateMatchState(activeMatch.id, "unfinished");
      }
    }

    await repo.removeCourt(courtId);
    const newCount = Math.max(0, courts.length - 1);
    await repo.updateSession(session.id, { courts: newCount });
    await get().refresh();
    set({ session: { ...session, courts: newCount } });
  },

  currentMatchByCourt(courtId) {
    // Match aktif di lapangan = proposed (belum mulai) atau playing (berjalan).
    return get()
      .matches.filter(
        (m) =>
          m.courtId === courtId &&
          (m.state === "proposed" || m.state === "playing"),
      )
      .at(-1);
  },

  courtMatchNumber(courtId, matchId) {
    // Urutan match dalam SATU lapangan (berbasis kronologi pembuatan match
    // di lapangan tsb), bukan ronde global. Lapangan A game pertama = 1,
    // Lapangan B game pertama = 1 juga.
    const inCourt = get()
      .matches.filter((m) => m.courtId === courtId)
      .sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
    const idx = inCourt.findIndex((m) => m.id === matchId);
    return idx >= 0 ? idx + 1 : inCourt.length + 1;
  },

  busyPlayerIds() {
    // Pemain "sibuk" = sedang di match proposed atau playing (sudah dialokasikan
    // ke lapangan). finished & unfinished tidak menahan pemain.
    const busy = new Set<string>();
    for (const m of get().matches) {
      if (m.state === "proposed" || m.state === "playing") {
        [...m.teamA.playerIds, ...m.teamB.playerIds].forEach((id) =>
          busy.add(id),
        );
      }
    }
    return busy;
  },

  async setManualMatch(courtId, teamA, teamB) {
    const { session, courts } = get();
    if (!session) return;
    const round = session.current_round + 1;
    const courtLabel = courts.find((c) => c.id === courtId)?.label ?? null;
    // match dibuat sebagai 'proposed' (belum mulai) — host tap "Mulai Main"
    await repo.createMatch({
      sessionId: session.id,
      courtId,
      courtLabel,
      round,
      teamA,
      teamB,
      state: "proposed",
    });
    await repo.updateSession(session.id, { current_round: round });
    set({ session: { ...session, current_round: round } });
    await get().refresh();
  },

  async startMatch(matchId) {
    // Preview TIDAK di-generate otomatis di sini. Host menekan tombol
    // "Auto-fill" per lapangan untuk menyusun preview — supaya rotasi bisa
    // mencampur pemain lintas lapangan (pool menunggu lebih penuh).
    await repo.updateMatchState(matchId, "playing");
    await get().refresh();
  },

  playingMatchByCourt(courtId) {
    return get()
      .matches.filter((m) => m.courtId === courtId && m.state === "playing")
      .at(-1);
  },

  proposedMatchByCourt(courtId) {
    return get()
      .matches.filter((m) => m.courtId === courtId && m.state === "proposed")
      .at(-1);
  },

  /**
   * Buat & persist match 'proposed' (preview terkunci) di sebuah lapangan,
   * saling eksklusif dengan proposed/playing lapangan lain. Tidak menimpa bila
   * sudah ada proposed di lapangan itu.
   */
  async generateLockedPreview(courtId, mode = "balanced") {
    const { session, matches, players, courts } = get();
    if (!session || !courtId) return { ok: false };

    // sudah ada proposed di lapangan ini -> jangan buat dobel
    if (matches.some((m) => m.courtId === courtId && m.state === "proposed")) {
      return { ok: false };
    }

    const history = MatchHistory.fromMatches(matches);
    // Eksklusif: kecualikan semua pemain yang sudah di proposed/playing mana pun.
    const busy = get().busyPlayerIds();
    const pool = availablePool(players, { requireLevel: true, excludeIds: busy });
    if (pool.length < 4) {
      // Bangun penjelasan kenapa pemain kurang.
      const notCheckedIn = players.filter(
        (p) => p.status === "registered",
      ).length;
      const noLevel = players.filter(
        (p) => p.status === "active" && p.level === null && !busy.has(p.id),
      ).length;
      const parts: string[] = [`Pemain siap cuma ${pool.length} (butuh 4).`];
      if (notCheckedIn > 0)
        parts.push(`${notCheckedIn} pemain belum check-in — check-in di tab Pemain.`);
      if (noLevel > 0)
        parts.push(`${noLevel} pemain Active belum di-set level.`);
      if (notCheckedIn === 0 && noLevel === 0)
        parts.push("Semua pemain lain sedang main atau sudah di preview.");
      return { ok: false, reason: parts.join(" ") };
    }

    const round = session.current_round + 1;
    const prop = generateMatch(pool, history, round, undefined, mode);
    if (!prop) {
      const modeReason: Record<string, string> = {
        mixed: "Tidak bisa ganda campuran — komposisi cowok/cewek belum cukup.",
        ladies: "Tidak bisa ganda putri — pemain wanita tersedia kurang dari 4.",
        gendongan:
          "Tidak bisa gendongan — butuh kombinasi pemain kuat & lemah yang pas.",
        kelas: "Tidak bisa sesuai kelas — level pemain tersedia tidak cocok.",
        balanced:
          "Tidak ada kombinasi valid dari pemain tersedia (cek aturan level Newbie).",
      };
      return { ok: false, reason: modeReason[mode] ?? modeReason.balanced };
    }

    const courtLabel = courts.find((c) => c.id === courtId)?.label ?? null;
    await repo.createMatch({
      sessionId: session.id,
      courtId,
      courtLabel,
      round,
      teamA: prop.teamA,
      teamB: prop.teamB,
      state: "proposed",
    });
    await repo.updateSession(session.id, { current_round: round });
    set({ session: { ...session, current_round: round } });
    await get().refresh();
    return { ok: true };
  },

  async finishMatch(matchId, scoreA, scoreB, winner) {
    const { matches, players, session } = get();
    if (!session) return;
    const match = matches.find((m) => m.id === matchId);
    if (!match) return;

    await repo.finishMatch(matchId, scoreA, scoreB, winner);

    // update statistik + jatah main pemain
    const teamA = new Set(match.teamA.playerIds);
    const teamB = new Set(match.teamB.playerIds);
    const involved = [...match.teamA.playerIds, ...match.teamB.playerIds];
    const map = byIdMap(players);

    await Promise.all(
      involved.map((id) => {
        const p = map.get(id);
        if (!p) return Promise.resolve();
        const inA = teamA.has(id);
        const scored = inA ? scoreA : scoreB;
        const conceded = inA ? scoreB : scoreA;
        const won = (inA && winner === "a") || (teamB.has(id) && winner === "b");
        const lost = (inA && winner === "b") || (teamB.has(id) && winner === "a");
        const drew = winner === "draw";
        return repo.updateSessionPlayer(id, {
          games_played: p.gamesPlayed + 1,
          last_played_round: match.round,
          wins: p.wins + (won ? 1 : 0),
          losses: p.losses + (lost ? 1 : 0),
          draws: p.draws + (drew ? 1 : 0),
          points_scored: p.pointsScored + scored,
          points_conceded: p.pointsConceded + conceded,
        });
      }),
    );

    // Preview yang sudah di-lock (proposed) di lapangan ini otomatis "naik"
    // jadi match berikutnya. Preview baru TIDAK di-generate otomatis — host
    // menekan tombol "Auto-fill" per lapangan untuk menyusunnya.
    await get().refresh();
  },

  async restProposedPlayer(matchId, playerId) {
    // Pemain di preview (proposed) mau istirahat: keluar -> resting, slot diisi
    // pengganti otomatis dari pool menunggu (patuh hard rule).
    const { matches, players } = get();
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.state !== "proposed") {
      return { ok: false, reason: "Hanya berlaku untuk preview." };
    }

    const history = MatchHistory.fromMatches(matches);
    const busy = get().busyPlayerIds();
    const pool = availablePool(players, {
      requireLevel: true,
      excludeIds: new Set([
        ...busy,
        ...match.teamA.playerIds,
        ...match.teamB.playerIds,
      ]),
    });

    const sub = findSubstitute({
      match: { teamA: match.teamA.playerIds, teamB: match.teamB.playerIds },
      leavingId: playerId,
      pool,
      byId: byIdMap(players),
      history,
      currentRound: match.round,
    });

    // pemain preview -> resting
    await repo.updateSessionPlayer(playerId, { status: "resting" });

    if (!sub) {
      // tidak ada pengganti: keluarkan saja (slot jadi kosong tidak didukung
      // pada 2v2). Kembalikan info agar UI bisa menampilkan pesan.
      await get().refresh();
      return {
        ok: false,
        reason:
          "Tidak ada pengganti tersedia. Pemain diistirahatkan; ganti manual.",
      };
    }

    const sw = (t: [string, string]): [string, string] =>
      t.map((id) => (id === playerId ? sub : id)) as [string, string];
    const newA = match.teamA.playerIds.includes(playerId)
      ? sw(match.teamA.playerIds)
      : match.teamA.playerIds;
    const newB = match.teamB.playerIds.includes(playerId)
      ? sw(match.teamB.playerIds)
      : match.teamB.playerIds;
    await repo.updateMatchTeams(matchId, newA, newB);
    await get().refresh();
    return { ok: true };
  },

  async editProposedPlayer(matchId, outId, inId) {
    const { matches, players } = get();
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.state !== "proposed") {
      return { ok: false, reason: "Hanya match preview yang bisa diedit." };
    }
    const byId = byIdMap(players);
    const replacement = byId.get(inId);
    if (!replacement) return { ok: false, reason: "Pemain tidak ditemukan." };

    const inThisMatch = [
      ...match.teamA.playerIds,
      ...match.teamB.playerIds,
    ].includes(inId);

    // KASUS: tukar posisi antar 2 pemain di preview yang SAMA (mis. tukar
    // partner jadi lawan). Tukar posisi outId <-> inId di dalam match ini.
    if (inThisMatch && inId !== outId) {
      const swap2 = (t: [string, string]): [string, string] =>
        t.map((id) =>
          id === outId ? inId : id === inId ? outId : id,
        ) as [string, string];
      const nA = swap2(match.teamA.playerIds);
      const nB = swap2(match.teamB.playerIds);
      const lv = (id: string) => byId.get(id)?.level ?? null;
      const twoNewbie = (t: [string, string]) =>
        t.every((id) => lv(id) === "newbie");
      if (twoNewbie(nA) || twoNewbie(nB)) {
        return { ok: false, reason: "Swap menghasilkan Newbie+Newbie." };
      }
      await repo.updateMatchTeams(matchId, nA, nB);
      await get().refresh();
      return { ok: true };
    }

    // Tentukan partner dari pemain yang keluar (untuk validasi hard rule).
    const inA = match.teamA.playerIds.includes(outId);
    const team = inA ? match.teamA.playerIds : match.teamB.playerIds;
    const partnerId = team.find((id) => id !== outId);
    const partner = partnerId ? byId.get(partnerId) : undefined;
    if (partner?.level === "newbie" && replacement.level === "newbie") {
      return { ok: false, reason: "Newbie tidak boleh setim dengan Newbie." };
    }

    // Jika pengganti sedang berada di proposed lapangan LAIN -> tukar (swap)
    // agar tetap eksklusif (tidak ada nama dobel antar preview).
    const otherProposed = matches.find(
      (m) =>
        m.id !== matchId &&
        m.state === "proposed" &&
        [...m.teamA.playerIds, ...m.teamB.playerIds].includes(inId),
    );

    const sw = (t: [string, string], from: string, to: string): [string, string] =>
      t.map((id) => (id === from ? to : id)) as [string, string];

    if (otherProposed) {
      // Validasi hard rule di sisi preview LAIN: outId gabung ke sana,
      // partner-nya tidak boleh sama-sama Newbie.
      const rInA = otherProposed.teamA.playerIds.includes(inId);
      const rTeam = rInA
        ? otherProposed.teamA.playerIds
        : otherProposed.teamB.playerIds;
      const rPartnerId = rTeam.find((id) => id !== inId);
      const rPartner = rPartnerId ? byId.get(rPartnerId) : undefined;
      const out = byId.get(outId);
      if (rPartner?.level === "newbie" && out?.level === "newbie") {
        return {
          ok: false,
          reason: "Swap ditolak: menghasilkan Newbie+Newbie di preview lain.",
        };
      }
    }

    const newA = sw(match.teamA.playerIds, outId, inId);
    const newB = sw(match.teamB.playerIds, outId, inId);
    await repo.updateMatchTeams(matchId, newA, newB);

    if (otherProposed) {
      // pemain yang keluar (outId) menggantikan posisi inId di proposed lain
      const oNewA = sw(otherProposed.teamA.playerIds, inId, outId);
      const oNewB = sw(otherProposed.teamB.playerIds, inId, outId);
      await repo.updateMatchTeams(otherProposed.id, oNewA, oNewB);
    }

    await get().refresh();
    return { ok: true };
  },

  async editMatchScore(matchId, scoreA, scoreB, winner) {
    const { matches, players } = get();
    const match = matches.find((m) => m.id === matchId);
    if (!match || match.state !== "finished" || !match.score || !match.winner) {
      return { ok: false, reason: "Match belum selesai / tidak bisa diedit." };
    }

    const oldScore = match.score;
    const oldWinner = match.winner;
    const teamA = new Set(match.teamA.playerIds);
    const teamB = new Set(match.teamB.playerIds);
    const involved = [...match.teamA.playerIds, ...match.teamB.playerIds];
    const map = byIdMap(players);

    // Hitung delta per pemain: (statistik baru) - (statistik lama), lalu terapkan.
    const statFor = (
      inA: boolean,
      sA: number,
      sB: number,
      w: "a" | "b" | "draw",
    ) => {
      const scored = inA ? sA : sB;
      const conceded = inA ? sB : sA;
      const won = (inA && w === "a") || (!inA && w === "b");
      const lost = (inA && w === "b") || (!inA && w === "a");
      const drew = w === "draw";
      return {
        wins: won ? 1 : 0,
        losses: lost ? 1 : 0,
        draws: drew ? 1 : 0,
        scored,
        conceded,
      };
    };

    await repo.finishMatch(matchId, scoreA, scoreB, winner);

    await Promise.all(
      involved.map((id) => {
        const p = map.get(id);
        if (!p) return Promise.resolve();
        const isInA = teamA.has(id);
        void teamB;
        const oldS = statFor(isInA, oldScore.a, oldScore.b, oldWinner);
        const newS = statFor(isInA, scoreA, scoreB, winner);
        return repo.updateSessionPlayer(id, {
          wins: p.wins - oldS.wins + newS.wins,
          losses: p.losses - oldS.losses + newS.losses,
          draws: p.draws - oldS.draws + newS.draws,
          points_scored: p.pointsScored - oldS.scored + newS.scored,
          points_conceded: p.pointsConceded - oldS.conceded + newS.conceded,
        });
      }),
    );

    await get().refresh();
    return { ok: true };
  },

  async substituteInProposed(matchId, leavingId, leavingStatus = "resting") {
    const { matches, players, session } = get();
    if (!session) return { ok: false, reason: "Tidak ada sesi." };
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { ok: false, reason: "Match tidak ditemukan." };

    const history = MatchHistory.fromMatches(matches);
    const busy = get().busyPlayerIds();
    const pool = availablePool(players, {
      requireLevel: true,
      excludeIds: new Set([
        ...busy,
        ...match.teamA.playerIds,
        ...match.teamB.playerIds,
      ]),
    });

    const sub = findSubstitute({
      match: { teamA: match.teamA.playerIds, teamB: match.teamB.playerIds },
      leavingId,
      pool,
      byId: byIdMap(players),
      history,
      currentRound: match.round,
    });

    if (!sub) return { ok: false, reason: "Tidak ada pengganti valid." };

    // pemain yang keluar -> status sesuai niat (resting = istirahat,
    // active = salah pilih/koreksi, balik ke antrian)
    await repo.updateSessionPlayer(leavingId, { status: leavingStatus });

    // ganti di match: cari posisi leavingId
    const replace = (t: [string, string]): [string, string] =>
      t.map((id) => (id === leavingId ? sub : id)) as [string, string];

    const newA = match.teamA.playerIds.includes(leavingId)
      ? replace(match.teamA.playerIds)
      : match.teamA.playerIds;
    const newB = match.teamB.playerIds.includes(leavingId)
      ? replace(match.teamB.playerIds)
      : match.teamB.playerIds;

    // update baris match (hapus & buat ulang paling simpel via finish path tidak cocok;
    // gunakan update langsung)
    await repo.updateMatchTeams(matchId, newA, newB);
    await get().refresh();
    return { ok: true };
  },

  async manualSubstitute(matchId, leavingId, replacementId, leavingStatus = "resting") {
    const { matches, players } = get();
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { ok: false, reason: "Match tidak ditemukan." };

    const byId = byIdMap(players);
    const replacement = byId.get(replacementId);

    const inThisMatch = [
      ...match.teamA.playerIds,
      ...match.teamB.playerIds,
    ].includes(replacementId);

    const swapIn = (
      t: [string, string],
      from: string,
      to: string,
    ): [string, string] =>
      t.map((id) => (id === from ? to : id)) as [string, string];

    // KASUS 1: swap DALAM match yang sama (tukar posisi/tim antar pemain di match ini).
    // Mis. tukar lawan jadi partner. Tidak mengubah status pemain.
    if (inThisMatch && replacementId !== leavingId) {
      // Tukar posisi leavingId <-> replacementId di dalam match ini.
      const sw = (t: [string, string]): [string, string] =>
        t.map((id) =>
          id === leavingId ? replacementId : id === replacementId ? leavingId : id,
        ) as [string, string];
      const newA = sw(match.teamA.playerIds);
      const newB = sw(match.teamB.playerIds);

      // Validasi hard rule kedua tim setelah swap.
      const lv = (id: string) => byId.get(id)?.level ?? null;
      const twoNewbie = (t: [string, string]) =>
        t.every((id) => lv(id) === "newbie");
      if (twoNewbie(newA) || twoNewbie(newB)) {
        return { ok: false, reason: "Swap menghasilkan Newbie+Newbie." };
      }

      await repo.updateMatchTeams(matchId, newA, newB);
      await get().refresh();
      return { ok: true };
    }

    // Deteksi apakah pengganti sedang bermain di match LAIN (proposed/playing).
    // Jika ya -> lakukan SWAP (tukar posisi antar 2 match). Jika tidak -> replace biasa.
    const otherMatch = matches.find(
      (m) =>
        m.id !== matchId &&
        (m.state === "proposed" || m.state === "playing") &&
        [...m.teamA.playerIds, ...m.teamB.playerIds].includes(replacementId),
    );

    // Validasi hard rule untuk match ini (partner dari leavingId + replacement).
    const inA = match.teamA.playerIds.includes(leavingId);
    const team = inA ? match.teamA.playerIds : match.teamB.playerIds;
    const partnerId = team.find((id) => id !== leavingId)!;
    const partner = byId.get(partnerId);
    if (partner?.level === "newbie" && replacement?.level === "newbie") {
      return { ok: false, reason: "Newbie tidak boleh setim dengan Newbie." };
    }

    if (otherMatch) {
      // SWAP: replacement (di otherMatch) <-> leavingId (di match ini).
      // Validasi hard rule di otherMatch juga (partner replacement + leavingId).
      const rInA = otherMatch.teamA.playerIds.includes(replacementId);
      const rTeam = rInA ? otherMatch.teamA.playerIds : otherMatch.teamB.playerIds;
      const rPartnerId = rTeam.find((id) => id !== replacementId)!;
      const rPartner = byId.get(rPartnerId);
      const leaving = byId.get(leavingId);
      if (rPartner?.level === "newbie" && leaving?.level === "newbie") {
        return {
          ok: false,
          reason: "Swap ditolak: menghasilkan Newbie+Newbie di lapangan lain.",
        };
      }

      // match ini: leavingId -> replacementId
      const newA = swapIn(match.teamA.playerIds, leavingId, replacementId);
      const newB = swapIn(match.teamB.playerIds, leavingId, replacementId);
      // otherMatch: replacementId -> leavingId
      const oNewA = swapIn(otherMatch.teamA.playerIds, replacementId, leavingId);
      const oNewB = swapIn(otherMatch.teamB.playerIds, replacementId, leavingId);

      await repo.updateMatchTeams(matchId, newA, newB);
      await repo.updateMatchTeams(otherMatch.id, oNewA, oNewB);
      await get().refresh();
      return { ok: true };
    }

    // REPLACE biasa: pengganti dari pool menunggu. Pemain keluar -> leavingStatus.
    await repo.updateSessionPlayer(leavingId, { status: leavingStatus });
    const newA = match.teamA.playerIds.includes(leavingId)
      ? swapIn(match.teamA.playerIds, leavingId, replacementId)
      : match.teamA.playerIds;
    const newB = match.teamB.playerIds.includes(leavingId)
      ? swapIn(match.teamB.playerIds, leavingId, replacementId)
      : match.teamB.playerIds;

    await repo.updateMatchTeams(matchId, newA, newB);
    await get().refresh();
    return { ok: true };
  },

  async incrementSessionsForPlayed() {
    const { players, profileIdOf } = get();
    const profileIds = players
      .filter((p) => p.gamesPlayed > 0)
      .map((p) => profileIdOf[p.id])
      .filter((id): id is string => Boolean(id));
    await repo.incrementSessionsPlayed(profileIds);
  },

  substituteCandidates(matchId, leavingId) {
    const { matches, players } = get();
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { preferred: [], others: [], playing: [], sameMatch: [] };

    const byId = byIdMap(players);
    const inA = match.teamA.playerIds.includes(leavingId);
    const team = inA ? match.teamA.playerIds : match.teamB.playerIds;
    const otherTeam = inA ? match.teamB.playerIds : match.teamA.playerIds;
    const partnerId = team.find((id) => id !== leavingId);
    const partner = partnerId ? byId.get(partnerId) : undefined;

    const busy = get().busyPlayerIds();
    const inMatch = new Set([...match.teamA.playerIds, ...match.teamB.playerIds]);

    const legalWithPartner = (c: SessionPlayer) =>
      !(partner?.level === "newbie" && c.level === "newbie");

    // Kandidat pengganti dari pool MENUNGGU (active, tidak sedang main).
    const waiting = players.filter(
      (p) => p.status === "active" && !busy.has(p.id) && !inMatch.has(p.id),
    );
    const legal = waiting.filter(legalWithPartner);

    // Kandidat SWAP: pemain yang sedang bermain di match lain (proposed/playing),
    // tidak termasuk pemain di match ini.
    const playing = players.filter(
      (p) => busy.has(p.id) && !inMatch.has(p.id) && legalWithPartner(p),
    );

    const history = MatchHistory.fromMatches(matches);
    const opp1 = byId.get(otherTeam[0]);
    const opp2 = byId.get(otherTeam[1]);
    const w = (lv: SessionPlayer["level"]) =>
      lv ? { newbie: 1, beginner: 2, intermediate: 3, advanced: 4 }[lv] : 0;

    const scored = legal
      .filter((c) => c.level !== null)
      .map((c) => {
        const teamW = w(partner?.level ?? null) + w(c.level);
        const oppW = w(opp1?.level ?? null) + w(opp2?.level ?? null);
        const imbalance = Math.abs(teamW - oppW);
        let cost = imbalance * 10 + c.gamesPlayed * 2;
        if (partnerId) cost += history.partners(partnerId, c.id) * 3;
        cost += history.opponents(otherTeam[0], c.id) * 1.5;
        cost += history.opponents(otherTeam[1], c.id) * 1.5;
        return { player: c, cost };
      })
      .sort((a, b) => a.cost - b.cost);

    const preferredIds = new Set(scored.slice(0, 3).map((s) => s.player.id));
    const preferred = scored.slice(0, 3).map((s) => s.player);
    const others = legal.filter((c) => !preferredIds.has(c.id));

    // Kandidat SWAP di lapangan yang SAMA: 3 pemain lain di match ini
    // (untuk tukar posisi/tim, mis. tukar lawan jadi partner).
    const sameMatch = players.filter(
      (p) => inMatch.has(p.id) && p.id !== leavingId,
    );

    return { preferred, others, playing, sameMatch };
  },
}));

function describe(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message: unknown }).message);
  }
  return String(e);
}
