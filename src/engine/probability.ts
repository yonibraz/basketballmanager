/**
 * Probability model: converts the 1–20 attribute scale into the conversion
 * and event probabilities the possession engine consumes.
 *
 * The guiding idea is a *matchup* model. An offensive action is a contest
 * between an offensive attribute and the relevant defensive attribute. We map
 * the difference through a logistic curve so that an even matchup sits near a
 * realistic baseline, and large attribute gaps move the probability without
 * ever reaching 0 or 1.
 */

import { clamp01 } from "../rng.js";

/** Standard logistic squashing function. */
export function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Resolves an offensive vs defensive matchup into a make/success probability.
 *
 * @param offense   offensive attribute (1–20)
 * @param defense   defensive attribute (1–20)
 * @param baseRate  the league-average success rate for an even matchup
 * @param spread    how sharply attribute gaps swing the result (per point)
 */
export function matchup(
  offense: number,
  defense: number,
  baseRate: number,
  spread = 0.09,
): number {
  // Convert the base rate into logit space, then nudge it by the attribute
  // differential. This keeps an even matchup exactly at `baseRate`.
  const baseLogit = Math.log(baseRate / (1 - baseRate));
  return clamp01(logistic(baseLogit + (offense - defense) * spread));
}

/**
 * League-average baselines for the three shot zones. These are deliberately
 * tuned toward modern FIBA/EuroLeague efficiency so that two average teams
 * produce a believable score in the 70s–80s.
 */
export const SHOT_BASELINES = {
  inside: 0.58, // at-rim / paint
  mid: 0.42, // mid-range two
  three: 0.355, // beyond the arc
} as const;

export type ShotZone = keyof typeof SHOT_BASELINES;

/** Points awarded for a made shot from each zone. */
export const SHOT_POINTS: Record<ShotZone, number> = {
  inside: 2,
  mid: 2,
  three: 3,
};

/**
 * Fatigue multiplier applied to a player's effective attributes. A fresh
 * player (fatigue 0) performs at 100%; a gassed player (fatigue 1) drops to
 * roughly 80%. Stamina blunts the slope so high-stamina players tire slower in
 * *effect* even though their raw fatigue accrues the same way.
 */
export function fatigueMultiplier(fatigue: number, stamina: number): number {
  const maxDrop = 0.2 * (1 - (stamina - 1) / 19) + 0.08; // 0.08–0.28 range
  return clamp01(1 - maxDrop * clamp01(fatigue));
}

/** Applies the fatigue multiplier to a raw attribute value. */
export function effective(attribute: number, fatigue: number, stamina: number): number {
  return attribute * fatigueMultiplier(fatigue, stamina);
}

/**
 * In the final two minutes of a tight game, clutch players raise (and chokers
 * lower) their effective shooting. Returns a small additive logit bonus.
 */
export function clutchBonus(clutch: number, isClutchTime: boolean): number {
  if (!isClutchTime) return 0;
  return ((clutch - 10) / 10) * 0.15;
}
