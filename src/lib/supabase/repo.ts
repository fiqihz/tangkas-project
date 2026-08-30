// ============================================================================
// Repository — satu-satunya lapisan yang bicara langsung ke Supabase.
// UI memanggil fungsi-fungsi ini; logika matchmaking tetap murni di domain/.
// Dirancang agar mudah di-upgrade ke Opsi C (tinggal ganti filter community).
// ============================================================================
import type { Level, PlayerStatus } from "@/lib/domain/types";
import { getSupabase } from "./client";
import { toMatch, toSessionPlayer } from "./mappers";
import {
  DEFAULT_COMMUNITY_ID,
  type DbCourt,
  type DbMatch,
  type DbPlayerProfile,
  type DbSession,
  type DbSessionPlayer,
  type SessionStatus,
} from "./types";

function db() {
  return getSupabase();
}

// ---------------------------------------------------------------------------
// ROSTER (player_profile) — persisten lintas mabar
// ---------------------------------------------------------------------------
export async function listProfiles(
  communityId = DEFAULT_COMMUNITY_ID,
): Promise<DbPlayerProfile[]> {
  const { data, error } = await db()
    .from("player_profile")
    .select("*")
    .eq("community_id", communityId)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createProfile(
  name: string,
  level: Level | null,
  communityId = DEFAULT_COMMUNITY_ID,
): Promise<DbPlayerProfile> {
  const { data, error } = await db()
    .from("player_profile")
    .insert({ name, level, community_id: communityId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<DbPlayerProfile, "name" | "level">>,
): Promise<void> {
  const { error } = await db()
    .from("player_profile")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProfile(id: string): Promise<void> {
  const { error } = await db().from("player_profile").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Tambah/kurang sessions_played untuk sekumpulan profil.
 * increment: +1 saat SELESAI MABAR. decrement: -1 saat reactivate (undo).
 */
async function adjustSessionsPlayed(
  profileIds: string[],
  delta: 1 | -1,
): Promise<void> {
  if (profileIds.length === 0) return;
  const { data, error } = await db()
    .from("player_profile")
    .select("id, sessions_played")
    .in("id", profileIds);
  if (error) throw error;

  await Promise.all(
    (data ?? []).map((row) =>
      db()
        .from("player_profile")
        .update({
          sessions_played: Math.max(0, (row.sessions_played ?? 0) + delta),
        })
        .eq("id", row.id),
    ),
  );
}

export async function incrementSessionsPlayed(
  profileIds: string[],
): Promise<void> {
  await adjustSessionsPlayed(profileIds, 1);
}

export async function decrementSessionsPlayed(
  profileIds: string[],
): Promise<void> {
  await adjustSessionsPlayed(profileIds, -1);
}

// ---------------------------------------------------------------------------
// SESSION (mabar)
// ---------------------------------------------------------------------------
/** Semua sesi (terbaru dulu) untuk ditampilkan di list mabar. */
export async function listSessions(
  communityId = DEFAULT_COMMUNITY_ID,
): Promise<DbSession[]> {
  const { data, error } = await db()
    .from("session")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Sesi yang sedang berjalan (maksimal 1). */
export async function getOngoingSession(
  communityId = DEFAULT_COMMUNITY_ID,
): Promise<DbSession | null> {
  const { data, error } = await db()
    .from("session")
    .select("*")
    .eq("community_id", communityId)
    .eq("status", "ongoing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getSession(id: string): Promise<DbSession | null> {
  const { data, error } = await db()
    .from("session")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createSession(opts: {
  name: string;
  courts: number;
  status?: SessionStatus;
  scheduledAt?: string | null;
  courtLabels?: string[];
  communityId?: string;
}): Promise<DbSession> {
  const communityId = opts.communityId ?? DEFAULT_COMMUNITY_ID;
  const { data, error } = await db()
    .from("session")
    .insert({
      name: opts.name,
      courts: opts.courts,
      status: opts.status ?? "ongoing",
      scheduled_at: opts.scheduledAt ?? null,
      community_id: communityId,
    })
    .select("*")
    .single();
  if (error) throw error;

  // buat lapangan sesuai jumlah courts (dengan label kustom bila ada)
  await ensureCourts(data.id, opts.courts, opts.courtLabels);
  return data;
}

export async function updateSession(
  id: string,
  patch: Partial<
    Pick<
      DbSession,
      "courts" | "status" | "current_round" | "name" | "scheduled_at"
    >
  >,
): Promise<void> {
  const body: Record<string, unknown> = { ...patch };
  if (patch.status === "finished") body.finished_at = new Date().toISOString();
  if (patch.status === "ongoing") body.finished_at = null;
  const { error } = await db().from("session").update(body).eq("id", id);
  if (error) throw error;
}

export async function finishSession(id: string): Promise<void> {
  await updateSession(id, { status: "finished" });
}

export async function deleteSession(id: string): Promise<void> {
  const { error } = await db().from("session").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// COURT (lapangan dinamis)
// ---------------------------------------------------------------------------
export async function listCourts(sessionId: string): Promise<DbCourt[]> {
  const { data, error } = await db()
    .from("court")
    .select("*")
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}

/** Pastikan jumlah court sesuai target (menambah bila kurang). */
export async function ensureCourts(
  sessionId: string,
  target: number,
  labels?: string[],
): Promise<void> {
  const existing = await listCourts(sessionId);
  if (existing.length >= target) return;
  const rows = [];
  for (let i = existing.length; i < target; i++) {
    rows.push({
      session_id: sessionId,
      label: labels?.[i]?.trim() || `Lapangan ${i + 1}`,
      position: i,
    });
  }
  const { error } = await db().from("court").insert(rows);
  if (error) throw error;
}

export async function updateCourtLabel(
  courtId: string,
  label: string,
): Promise<void> {
  const { error } = await db()
    .from("court")
    .update({ label })
    .eq("id", courtId);
  if (error) throw error;
}

export async function addCourt(
  sessionId: string,
  position: number,
): Promise<DbCourt> {
  const { data, error } = await db()
    .from("court")
    .insert({
      session_id: sessionId,
      label: `Lapangan ${position + 1}`,
      position,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function removeCourt(courtId: string): Promise<void> {
  const { error } = await db().from("court").delete().eq("id", courtId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// SESSION PLAYER (state pemain di mabar)
// ---------------------------------------------------------------------------
export async function listSessionPlayers(
  sessionId: string,
): Promise<DbSessionPlayer[]> {
  const { data, error } = await db()
    .from("session_player")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function addSessionPlayer(
  sessionId: string,
  player: {
    name: string;
    level: Level | null;
    profileId?: string | null;
    status?: PlayerStatus;
  },
): Promise<DbSessionPlayer> {
  const { data, error } = await db()
    .from("session_player")
    .insert({
      session_id: sessionId,
      profile_id: player.profileId ?? null,
      name: player.name,
      level: player.level,
      status: player.status ?? "registered",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function linkSessionPlayerProfile(
  sessionPlayerId: string,
  profileId: string,
): Promise<void> {
  const { error } = await db()
    .from("session_player")
    .update({ profile_id: profileId })
    .eq("id", sessionPlayerId);
  if (error) throw error;
}

export async function updateSessionPlayer(
  id: string,
  patch: Partial<
    Pick<
      DbSessionPlayer,
      | "level"
      | "status"
      | "checked_in_at"
      | "games_played"
      | "last_played_round"
      | "available_since_round"
      | "wins"
      | "losses"
      | "draws"
      | "points_scored"
      | "points_conceded"
    >
  >,
): Promise<void> {
  const { error } = await db().from("session_player").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// MATCH
// ---------------------------------------------------------------------------
export async function listMatches(sessionId: string): Promise<DbMatch[]> {
  const { data, error } = await db()
    .from("match")
    .select("*")
    .eq("session_id", sessionId)
    .order("round");
  if (error) throw error;
  return data ?? [];
}

export async function createMatch(match: {
  sessionId: string;
  courtId: string | null;
  courtLabel?: string | null;
  round: number;
  teamA: [string, string];
  teamB: [string, string];
  state?: "proposed" | "playing";
}): Promise<DbMatch> {
  const { data, error } = await db()
    .from("match")
    .insert({
      session_id: match.sessionId,
      court_id: match.courtId,
      court_label: match.courtLabel ?? null,
      round: match.round,
      team_a_p1: match.teamA[0],
      team_a_p2: match.teamA[1],
      team_b_p1: match.teamB[0],
      team_b_p2: match.teamB[1],
      state: match.state ?? "proposed",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateMatchState(
  matchId: string,
  state: "proposed" | "playing" | "finished" | "unfinished",
): Promise<void> {
  const { error } = await db()
    .from("match")
    .update({ state })
    .eq("id", matchId);
  if (error) throw error;
}

export async function deleteMatch(matchId: string): Promise<void> {
  const { error } = await db().from("match").delete().eq("id", matchId);
  if (error) throw error;
}

export async function updateMatchTeams(
  matchId: string,
  teamA: [string, string],
  teamB: [string, string],
): Promise<void> {
  const { error } = await db()
    .from("match")
    .update({
      team_a_p1: teamA[0],
      team_a_p2: teamA[1],
      team_b_p1: teamB[0],
      team_b_p2: teamB[1],
    })
    .eq("id", matchId);
  if (error) throw error;
}

export async function finishMatch(
  matchId: string,
  scoreA: number,
  scoreB: number,
  winner: "a" | "b" | "draw",
): Promise<void> {
  const { error } = await db()
    .from("match")
    .update({
      state: "finished",
      score_a: scoreA,
      score_b: scoreB,
      winner,
      finished_at: new Date().toISOString(),
    })
    .eq("id", matchId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helper konversi ke domain (dipakai UI)
// ---------------------------------------------------------------------------
export { toMatch, toSessionPlayer };
