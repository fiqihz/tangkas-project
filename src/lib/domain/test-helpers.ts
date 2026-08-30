import type { Level, SessionPlayer } from "./types";

let counter = 0;

/** Buat SessionPlayer untuk keperluan tes/simulasi. */
export function makePlayer(
  name: string,
  level: Level | null,
  overrides: Partial<SessionPlayer> = {},
): SessionPlayer {
  counter += 1;
  return {
    id: overrides.id ?? `p${counter}`,
    name,
    level,
    status: "active",
    gamesPlayed: 0,
    lastPlayedRound: null,
    availableSinceRound: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    pointsScored: 0,
    pointsConceded: 0,
    ...overrides,
  };
}

/** Reset counter id (agar id deterministik antar-tes bila diperlukan). */
export function resetIds() {
  counter = 0;
}
