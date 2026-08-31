// ============================================================================
// Konversi antara baris DB (snake_case) dan tipe domain (camelCase)
// ============================================================================
import type { Match, SessionPlayer } from "@/lib/domain/types";
import type { DbMatch, DbSessionPlayer } from "./types";

export function toSessionPlayer(row: DbSessionPlayer): SessionPlayer {
  return {
    id: row.id,
    name: row.name,
    level: row.level,
    gender: row.gender,
    status: row.status,
    checkedInAt: row.checked_in_at,
    gamesPlayed: row.games_played,
    lastPlayedRound: row.last_played_round,
    availableSinceRound: row.available_since_round,
    wins: row.wins,
    losses: row.losses,
    draws: row.draws,
    pointsScored: row.points_scored,
    pointsConceded: row.points_conceded,
  };
}

export function toMatch(row: DbMatch): Match {
  return {
    id: row.id,
    courtId: row.court_id ?? "",
    courtLabel: row.court_label,
    round: row.round,
    teamA: { playerIds: [row.team_a_p1, row.team_a_p2] },
    teamB: { playerIds: [row.team_b_p1, row.team_b_p2] },
    state: row.state,
    score:
      row.score_a !== null && row.score_b !== null
        ? { a: row.score_a, b: row.score_b }
        : null,
    winner: row.winner,
  };
}
