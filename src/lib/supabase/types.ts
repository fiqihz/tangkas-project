// ============================================================================
// Tipe baris database (selaras dengan supabase/schema.sql)
// ============================================================================
import type { Level, PlayerStatus } from "@/lib/domain/types";

export interface DbCommunity {
  id: string;
  name: string;
  created_at: string;
}

export interface DbPlayerProfile {
  id: string;
  community_id: string;
  name: string;
  level: Level | null;
  gender: "male" | "female" | null;
  sessions_played: number;
  created_at: string;
  updated_at: string;
}

export type SessionStatus = "scheduled" | "ongoing" | "finished";

export interface DbSession {
  id: string;
  community_id: string;
  name: string;
  courts: number;
  status: SessionStatus;
  current_round: number;
  scheduled_at: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface DbSessionPlayer {
  id: string;
  session_id: string;
  profile_id: string | null;
  name: string;
  level: Level | null;
  gender: "male" | "female" | null;
  status: PlayerStatus;
  checked_in_at: string | null;
  games_played: number;
  last_played_round: number | null;
  available_since_round: number;
  wins: number;
  losses: number;
  draws: number;
  points_scored: number;
  points_conceded: number;
  created_at: string;
}

export interface DbCourt {
  id: string;
  session_id: string;
  label: string;
  position: number;
  created_at: string;
}

export interface DbMatch {
  id: string;
  session_id: string;
  court_id: string | null;
  court_label: string | null;
  round: number;
  team_a_p1: string;
  team_a_p2: string;
  team_b_p1: string;
  team_b_p2: string;
  state: "proposed" | "playing" | "finished" | "unfinished";
  score_a: number | null;
  score_b: number | null;
  winner: "a" | "b" | "draw" | null;
  created_at: string;
  finished_at: string | null;
}

/** ID komunitas default untuk Opsi B (single-tenant). */
export const DEFAULT_COMMUNITY_ID = "00000000-0000-0000-0000-000000000001";
