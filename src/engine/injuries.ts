import type { Player } from "../types.js";
import type { Rng } from "../rng.js";

/** Per-position injury probability per game. Tuned to ~8% per game. */
const BASE_INJURY_RATE = 0.08;

/**
 * After a game, roll for potential injury on each player who had significant minutes.
 * Returns a new array of players with injuryWeeksLeft set for injured ones.
 */
export function rollInjuries(
  players: Player[],
  secondsPlayed: Record<string, number>,
  rng: Rng,
): Player[] {
  return players.map((p) => {
    // Never re-roll an already-injured player — preserve the existing recovery countdown.
    if (p.injuryWeeksLeft && p.injuryWeeksLeft > 0) return p;
    const secs = secondsPlayed[p.id] ?? 0;
    if (secs < 120) return p; // bench warmers rarely get injured
    // Fatigue factor: more minutes = slightly more risk
    const rate = BASE_INJURY_RATE * (secs / 600);
    if (!rng.chance(rate)) return p;
    // Injury duration: 1-3 matchdays, weighted toward 1
    const weeks = rng.weightedIndex([6, 3, 1]) + 1; // 60% 1-week, 30% 2-week, 10% 3-week
    return { ...p, injuryWeeksLeft: weeks };
  });
}

/** Recover all players by 1 matchday at the start of a new matchday. */
export function recoverPlayers(players: Player[]): Player[] {
  return players.map((p) => {
    if (!p.injuryWeeksLeft || p.injuryWeeksLeft <= 0) return p;
    const newWeeks = p.injuryWeeksLeft - 1;
    return { ...p, injuryWeeksLeft: newWeeks };
  });
}

/** Returns the ids of any injured players in the list. */
export function hasInjuredStarters(players: Player[]): string[] {
  return players.filter((p) => (p.injuryWeeksLeft ?? 0) > 0).map((p) => p.id);
}
