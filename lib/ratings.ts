import type { Player } from "@/src/types";
import { isForeign } from "@/src/rosters/quotas";
import type { AccumulatedStats } from "@/lib/useGame";

/** 1–99 style overall rating for display (maps the 1–20 attribute scale up). */
export function overall(p: Player): number {
  const a = p.attributes;
  const core =
    (a.shootingInside + a.shootingOutside + a.playmaking + a.defPerimeter + a.defInterior + a.rebounding + a.bballIq) / 7;
  return Math.round(35 + core * 3.1);
}

/** Format elapsed seconds-from-tipoff into a Q label + game clock. */
export function gameClock(period: number, clock: number): { quarter: string; mmss: string } {
  const periodLen = period <= 4 ? 600 : 300;
  const start = period <= 4 ? (period - 1) * 600 : 2400 + (period - 5) * 300;
  const remaining = Math.max(0, periodLen - (clock - start));
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const quarter = period <= 4 ? `Q${period}` : `OT${period - 4}`;
  return { quarter, mmss: `${mm}:${String(ss).padStart(2, "0")}` };
}

/** Points per game. */
export function ppg(s: AccumulatedStats): number {
  return s.gamesPlayed > 0 ? +(s.points / s.gamesPlayed).toFixed(1) : 0;
}

/** Rebounds per game. */
export function rpg(s: AccumulatedStats): number {
  return s.gamesPlayed > 0 ? +(s.rebounds / s.gamesPlayed).toFixed(1) : 0;
}

/** Assists per game. */
export function apg(s: AccumulatedStats): number {
  return s.gamesPlayed > 0 ? +(s.assists / s.gamesPlayed).toFixed(1) : 0;
}

/**
 * True Shooting Percentage: a measure of shooting efficiency that accounts
 * for 2-pointers, 3-pointers, and free throws.
 * TS% = PTS / (2 × TSA), where TSA = FGA + 0.44 × FTA
 */
export function tsPct(s: AccumulatedStats): number {
  const tsa = s.fieldGoalsAttempted + 0.44 * s.freeThrowsAttempted;
  return tsa > 0 ? +(s.points / (2 * tsa) * 100).toFixed(1) : 0;
}

export { isForeign };
