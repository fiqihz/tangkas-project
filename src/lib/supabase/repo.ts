// ============================================================================
// Repository — satu-satunya lapisan yang bicara langsung ke Supabase.
// UI memanggil fungsi-fungsi ini; logika matchmaking tetap murni di domain/.
// Dirancang agar mudah di-upgrade ke Opsi C (tinggal ganti filter community).
// ============================================================================
import type { Level, PlayerStatus } from "@/lib/domain/types";
import type { ResolvedMatch } from "@/lib/domain/roster-stats";
import { toTitleCase } from "@/lib/utils";
import { getSupabase } from "./client";
import { toMatch, toSessionPlayer } from "./mappers";
import {
  type DbCommunity,
  type DbCourt,
  type DbInvite,
  type DbMatch,
  type DbPlayerProfile,
  type DbSession,
  type DbSessionPlayer,
  type MembershipRole,
  type SessionStatus,
} from "./types";

function db() {
  return getSupabase();
}

// ---------------------------------------------------------------------------
// ROSTER (player_profile) — persisten lintas mabar
// ---------------------------------------------------------------------------
export async function listProfiles(
  communityId: string,
): Promise<DbPlayerProfile[]> {
  const { data, error } = await db()
    .from("player_profile")
    .select("*")
    .eq("community_id", communityId)
    .order("name");
  if (error) throw error;
  // Title Case saat baca agar profil lama (tersimpan lowercase) tampil rapi
  // tanpa migrasi data.
  return (data ?? []).map((p) => ({ ...p, name: toTitleCase(p.name) }));
}

export async function createProfile(
  name: string,
  level: Level | null,
  gender: "male" | "female" | null = null,
  communityId: string,
): Promise<DbPlayerProfile> {
  const { data, error } = await db()
    .from("player_profile")
    .insert({ name: toTitleCase(name), level, gender, community_id: communityId })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<DbPlayerProfile, "name" | "level" | "gender">>,
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
  communityId: string,
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
  communityId: string,
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
  communityId: string;
}): Promise<DbSession> {
  const communityId = opts.communityId;
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
    gender?: "male" | "female" | null;
    profileId?: string | null;
    status?: PlayerStatus;
  },
): Promise<DbSessionPlayer> {
  const { data, error } = await db()
    .from("session_player")
    .insert({
      session_id: sessionId,
      profile_id: player.profileId ?? null,
      name: toTitleCase(player.name),
      level: player.level,
      gender: player.gender ?? null,
      status: player.status ?? "registered",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSessionPlayer(id: string): Promise<void> {
  const { error } = await db().from("session_player").delete().eq("id", id);
  if (error) throw error;
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
      | "name"
      | "level"
      | "gender"
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

/**
 * Mulai match: set state 'playing' + catat started_at=now() (untuk timer
 * durasi). Hanya set started_at bila belum ada, agar re-start tidak mereset
 * timer secara tak sengaja.
 */
export async function startMatchPlaying(matchId: string): Promise<void> {
  const { error } = await db()
    .from("match")
    .update({ state: "playing", started_at: new Date().toISOString() })
    .eq("id", matchId)
    .is("started_at", null);
  if (error) throw error;
  // Bila started_at sudah terisi (filter .is null tidak match), tetap pastikan
  // state playing.
  const { error: e2 } = await db()
    .from("match")
    .update({ state: "playing" })
    .eq("id", matchId);
  if (e2) throw e2;
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
// RPC ATOMIK (poin stabilisasi #4) — operasi multi-write dalam 1 transaksi.
// ---------------------------------------------------------------------------
/**
 * Selesaikan match + update statistik 4 pemainnya secara atomik (di DB).
 * Statistik dihitung server-side dari kolom tim match, jadi kebal terhadap
 * snapshot client yang basi. Idempoten terhadap retry (match yang sudah
 * finished tidak diproses ulang).
 */
export async function finishMatchAtomic(
  matchId: string,
  scoreA: number,
  scoreB: number,
  winner: "a" | "b" | "draw",
): Promise<void> {
  const { error } = await db().rpc("finish_match_atomic", {
    p_match_id: matchId,
    p_score_a: scoreA,
    p_score_b: scoreB,
    p_winner: winner,
  });
  if (error) throw error;
}

/**
 * Buat match 'proposed' + naikkan current_round secara atomik. Nomor ronde
 * dihitung di DB sehingga dua device tidak bentrok nomor ronde.
 */
export async function createMatchAtomic(match: {
  sessionId: string;
  courtId: string | null;
  courtLabel?: string | null;
  teamA: [string, string];
  teamB: [string, string];
  state?: "proposed" | "playing";
}): Promise<DbMatch> {
  const { data, error } = await db().rpc("create_match_atomic", {
    p_session_id: match.sessionId,
    p_court_id: match.courtId,
    p_court_label: match.courtLabel ?? null,
    p_team_a_p1: match.teamA[0],
    p_team_a_p2: match.teamA[1],
    p_team_b_p1: match.teamB[0],
    p_team_b_p2: match.teamB[1],
    p_state: match.state ?? "proposed",
  });
  if (error) throw error;
  return data as DbMatch;
}

/**
 * Selesaikan sesi + increment sessions_played untuk pemain yang benar-benar
 * main, secara atomik. Idempoten (sesi yang sudah finished tidak diproses ulang).
 */
export async function finishSessionAtomic(sessionId: string): Promise<void> {
  const { error } = await db().rpc("finish_session_atomic", {
    p_session_id: sessionId,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// REALTIME (livescore multi-device)
// ---------------------------------------------------------------------------
/**
 * Berlangganan perubahan realtime untuk satu sesi. Memantau tabel match,
 * session_player, dan court (difilter per session_id) plus baris session itu
 * sendiri. Setiap ada INSERT/UPDATE/DELETE, `onChange` dipanggil — pemanggil
 * (store) lalu melakukan refresh() agar semua device tetap sinkron.
 *
 * Mengembalikan fungsi unsubscribe; WAJIB dipanggil saat unmount / ganti sesi
 * agar tidak terjadi kebocoran channel atau langganan ganda.
 */
export function subscribeToSession(
  sessionId: string,
  onChange: () => void,
): () => void {
  const supabase = db();
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "match", filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "session_player", filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "court", filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "session", filter: `id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();

  return () => {
    // removeChannel juga meng-unsubscribe channel-nya.
    void supabase.removeChannel(channel);
  };
}

// ---------------------------------------------------------------------------
// STATISTIK LINTAS-MABAR (roster) — agregasi semua mabar di community
// ---------------------------------------------------------------------------
/**
 * Ambil semua match yang sudah selesai di seluruh mabar community, lalu
 * resolve tiap slot pemain (session_player.id) menjadi profile_id agar bisa
 * diagregasi lintas-mabar (identitas roster persisten).
 *
 * Slot yang session_player-nya tidak tertaut ke roster (profile_id null) atau
 * sudah terhapus akan bernilai null pada ResolvedMatch dan diabaikan saat
 * dihitung oleh domain/roster-stats.
 */
export async function listResolvedMatches(
  communityId: string,
): Promise<ResolvedMatch[]> {
  // 1. Semua sesi milik community.
  const sessions = await listSessions(communityId);
  const sessionIds = sessions.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  // 2. session_player -> profile_id (untuk semua sesi community).
  const { data: spRows, error: spErr } = await db()
    .from("session_player")
    .select("id, profile_id")
    .in("session_id", sessionIds);
  if (spErr) throw spErr;
  const profileOf = new Map<string, string | null>();
  for (const r of spRows ?? []) profileOf.set(r.id, r.profile_id);

  // 3. Semua match 'finished' (punya winner) di sesi-sesi tersebut.
  const { data: mRows, error: mErr } = await db()
    .from("match")
    .select(
      "session_id, team_a_p1, team_a_p2, team_b_p1, team_b_p2, score_a, score_b, winner, state",
    )
    .in("session_id", sessionIds)
    .eq("state", "finished");
  if (mErr) throw mErr;

  const resolved: ResolvedMatch[] = [];
  for (const m of mRows ?? []) {
    if (m.winner === null || m.score_a === null || m.score_b === null) continue;
    resolved.push({
      sessionId: m.session_id,
      teamA: [
        profileOf.get(m.team_a_p1) ?? null,
        profileOf.get(m.team_a_p2) ?? null,
      ],
      teamB: [
        profileOf.get(m.team_b_p1) ?? null,
        profileOf.get(m.team_b_p2) ?? null,
      ],
      scoreA: m.score_a,
      scoreB: m.score_b,
      winner: m.winner as "a" | "b" | "draw",
    });
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// FEEDBACK (masukan dari landing page)
// ---------------------------------------------------------------------------
/**
 * Kirim masukan dari pengunjung landing page. Boleh anonim (kontak opsional).
 * Anon hanya diizinkan INSERT (lihat migration 010) — tidak bisa membaca
 * masukan orang lain. Host membaca via dashboard/email notifikasi.
 */
export async function submitFeedback(
  message: string,
  contact?: string | null,
): Promise<void> {
  const trimmed = message.trim();
  if (!trimmed) throw new Error("Pesan tidak boleh kosong.");
  const trimmedContact = contact?.trim() || null;
  const { error } = await db()
    .from("feedback")
    .insert({ message: trimmed, contact: trimmedContact });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// AUTH / MULTI-TENANT (Fase 2) — membership, community, invite
// ---------------------------------------------------------------------------
// Semua tulisan ke `membership` diblok RLS dan hanya boleh lewat RPC
// SECURITY DEFINER (owner-only). Baca membership/community dibatasi RLS ke
// user login (membership_select). Delete community diizinkan langsung karena
// design menyediakan policy community_delete owner-only.

/** Ringkasan membership milik user login (untuk switcher & onboarding). */
export interface Membership {
  communityId: string;
  communityName: string;
  role: MembershipRole;
}

/** Baris member sebuah community (untuk dialog kelola admin). */
export interface MemberRow {
  userId: string;
  role: MembershipRole;
  createdAt: string;
  /**
   * Email member. Diisi hanya oleh `listCommunityMembersWithEmail` (RPC owner-
   * only). `listCommunityMembers` lama tidak mengambil email → bernilai null.
   */
  email: string | null;
}

/**
 * Ambil membership milik user login, join ke `community` agar mendapat nama
 * community. RLS `membership_select` sudah membatasi baris ke user login,
 * namun kita tetap filter eksplisit `user_id = auth.uid()` untuk kejelasan
 * dan agar aman bila kebijakan berubah. *Req 4, 8.1.*
 */
export async function listMyMemberships(): Promise<Membership[]> {
  const {
    data: { user },
    error: userErr,
  } = await db().auth.getUser();
  if (userErr) throw userErr;
  if (!user) return [];

  const { data, error } = await db()
    .from("membership")
    .select("community_id, role, community:community_id (id, name)")
    .eq("user_id", user.id)
    .order("created_at");
  if (error) throw error;

  return (data ?? []).map((row) => {
    // Supabase mengembalikan relasi embedded sebagai objek (atau array).
    const community = Array.isArray(row.community)
      ? row.community[0]
      : row.community;
    return {
      communityId: row.community_id as string,
      communityName: (community?.name as string) ?? "",
      role: row.role as MembershipRole,
    };
  });
}

/**
 * Buat community baru + membership owner untuk user login, sekaligus mengklaim
 * data lama, secara atomik di DB. Memanggil RPC `create_community_with_owner`
 * (SECURITY DEFINER; dibuat pada migration 015). *Req 3.3, 10.*
 */
export async function createCommunityWithOwner(
  name: string,
): Promise<DbCommunity> {
  const { data, error } = await db().rpc("create_community_with_owner", {
    p_name: name.trim(),
  });
  if (error) throw error;
  return data as DbCommunity;
}

/**
 * Buat undangan admin ke sebuah community. Role dipaksa 'admin' (Fase 2 hanya
 * mengizinkan admin; RLS `invite_insert` + CHECK juga menjamin ini). Token
 * WAJIB di-set karena kolom `token` tidak punya default (migration 012); kita
 * bangkitkan token acak yang sulit ditebak di client. Insert dijaga owner-only
 * oleh RLS. *Req 6.2, 6.10.*
 */
export async function createInvite(
  communityId: string,
  email: string,
): Promise<DbInvite> {
  const { data, error } = await db()
    .from("invite")
    .insert({
      community_id: communityId,
      email: email.trim().toLowerCase(),
      role: "admin",
      token: generateInviteToken(),
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/**
 * Bangkitkan token invite acak (sulit ditebak & praktis unik). Menggabungkan
 * dua UUID acak dari CSPRNG (`crypto.randomUUID`). Tabel `invite.token` juga
 * ber-unique constraint sebagai jaring pengaman terakhir.
 */
function generateInviteToken(): string {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
}

/**
 * Tukar token invite menjadi membership admin. Memanggil RPC `redeem_invite`
 * (SECURITY DEFINER; dibuat pada migration 015) yang mengembalikan jsonb
 * `{ ok, reason?, community_id? }`. Saat sukses, `community_id` diteruskan
 * sebagai `communityId` agar pemanggil dapat langsung auto-switch ke komunitas
 * hasil undangan. *Req 6.5–6.8.*
 */
export async function redeemInvite(
  token: string,
): Promise<{ ok: boolean; reason?: string; communityId?: string }> {
  const { data, error } = await db().rpc("redeem_invite", { p_token: token });
  if (error) throw error;
  const result = (data ?? {}) as {
    ok?: boolean;
    reason?: string;
    community_id?: string;
  };
  return {
    ok: Boolean(result.ok),
    reason: result.reason,
    communityId: result.community_id ?? undefined,
  };
}

/**
 * Daftar member sebuah community (RLS membatasi ke anggota community tsb).
 * *Req 5.3.*
 */
export async function listCommunityMembers(
  communityId: string,
): Promise<MemberRow[]> {
  const { data, error } = await db()
    .from("membership")
    .select("user_id, role, created_at")
    .eq("community_id", communityId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    userId: row.user_id as string,
    role: row.role as MembershipRole,
    createdAt: row.created_at as string,
    email: null,
  }));
}

/**
 * Daftar member sebuah community LENGKAP dengan email (owner-only). Memanggil
 * RPC `list_community_members_with_email` (SECURITY DEFINER; dibuat pada
 * migration 016) yang membaca `auth.users` dan menjaga guard owner-only.
 * Dipakai dialog kelola admin agar owner bisa mengenali member dari email.
 * *Req 5.3.*
 */
export async function listCommunityMembersWithEmail(
  communityId: string,
): Promise<MemberRow[]> {
  const { data, error } = await db().rpc("list_community_members_with_email", {
    p_community_id: communityId,
  });
  if (error) throw error;
  return ((data ?? []) as Array<{
    user_id: string;
    role: MembershipRole;
    email: string | null;
    created_at: string;
  }>).map((row) => ({
    userId: row.user_id,
    role: row.role,
    createdAt: row.created_at,
    email: row.email,
  }));
}

/**
 * Keluarkan seorang member dari community. Penulisan langsung ke `membership`
 * diblok RLS (tulis membership hanya lewat RPC SECURITY DEFINER owner-only),
 * jadi kita panggil RPC `kick_member`.
 *
 * TODO(migration RPC): RPC `kick_member(p_community_id uuid, p_user_id uuid)`
 * perlu didefinisikan pada migration RPC (SECURITY DEFINER, owner-only) — Task 3
 * belum tentu membuatnya. Konsisten dengan design: tulis membership lewat RPC.
 * *Req 5.3, 5.4.*
 */
export async function kickMember(
  communityId: string,
  userId: string,
): Promise<void> {
  const { error } = await db().rpc("kick_member", {
    p_community_id: communityId,
    p_user_id: userId,
  });
  if (error) throw error;
}

/**
 * Hapus community (beserta data turunannya via ON DELETE CASCADE). Delete
 * langsung diizinkan karena design menyediakan policy `community_delete`
 * owner-only pada tabel community. *Req 5.1, 5.2.*
 */
export async function deleteCommunity(communityId: string): Promise<void> {
  const { error } = await db()
    .from("community")
    .delete()
    .eq("id", communityId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Helper konversi ke domain (dipakai UI)
// ---------------------------------------------------------------------------
export { toMatch, toSessionPlayer };
