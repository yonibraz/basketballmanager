/**
 * Season-over-season player development and decline curves.
 *
 * Each call to {@link developPlayers} ages an entire team's roster by one year
 * and applies attribute changes according to the player's new age bucket:
 *   18-23 — growth phase: 3 random position-relevant attributes each +1
 *   24-27 — peak:         1 random attribute +1, 1 different attribute -1
 *   28-30 — early decline: 2 random attributes -1 each
 *   31+   — steep decline: 3 random attributes -1 each
 *
 * All attribute values are clamped to [1, 20] after changes.
 * The function never mutates its inputs — it returns a new Team object.
 */

import { Rng } from "@/src/rng";
import type { Player, PlayerAttributes, Position, Team } from "@/src/types";

/** Position-relevant attributes used to focus development rolls. */
const POSITION_ATTRS: Record<Position, ReadonlyArray<keyof PlayerAttributes>> = {
  PG: ["playmaking", "shootingOutside", "pace", "bballIq"],
  SG: ["shootingOutside", "shootingInside", "pace", "clutch"],
  SF: ["shootingOutside", "defPerimeter", "rebounding", "strength"],
  PF: ["rebounding", "strength", "defInterior", "shootingInside"],
  C:  ["rebounding", "defInterior", "strength", "shootingInside"],
};

function clampAttr(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}

/**
 * Pick `count` distinct indices from `pool` using the supplied RNG.
 * Returns an array of the chosen keys.
 */
function pickDistinct(
  rng: Rng,
  pool: ReadonlyArray<keyof PlayerAttributes>,
  count: number,
): Array<keyof PlayerAttributes> {
  const available = [...pool];
  const picked: Array<keyof PlayerAttributes> = [];
  const n = Math.min(count, available.length);
  for (let i = 0; i < n; i++) {
    const idx = rng.int(0, available.length - 1);
    picked.push(available[idx]!);
    available.splice(idx, 1);
  }
  return picked;
}

function applyDeltas(
  attrs: PlayerAttributes,
  keys: ReadonlyArray<keyof PlayerAttributes>,
  delta: number,
): PlayerAttributes {
  const next = { ...attrs };
  for (const k of keys) {
    (next as Record<keyof PlayerAttributes, number>)[k] = clampAttr(
      (next as Record<keyof PlayerAttributes, number>)[k] + delta,
    );
  }
  return next;
}

function developPlayer(player: Player, rng: Rng): Player {
  const newAge = player.age + 1;
  const pool = POSITION_ATTRS[player.position];
  let attrs = { ...player.attributes };

  if (newAge <= 23) {
    // Growth phase: 3 random position attrs each +1
    const gains = pickDistinct(rng, pool, 3);
    attrs = applyDeltas(attrs, gains, +1);
  } else if (newAge <= 27) {
    // Peak fluctuation: 1 attr +1, 1 different attr -1
    const [gainKey, ...rest] = pickDistinct(rng, pool, 2);
    if (gainKey !== undefined) attrs = applyDeltas(attrs, [gainKey], +1);
    if (rest[0] !== undefined) attrs = applyDeltas(attrs, [rest[0]], -1);
  } else if (newAge <= 30) {
    // Early decline: 2 random attrs -1 each
    const losses = pickDistinct(rng, pool, 2);
    attrs = applyDeltas(attrs, losses, -1);
  } else {
    // Steep decline (31+): 3 random attrs -1 each
    const losses = pickDistinct(rng, pool, 3);
    attrs = applyDeltas(attrs, losses, -1);
  }

  return { ...player, age: newAge, attributes: attrs };
}

/**
 * Age every player on the team by one year and apply attribute changes.
 * Returns a new Team — inputs are never mutated.
 */
export function developPlayers(team: Team, rng: Rng): Team {
  return {
    ...team,
    players: team.players.map((p) => developPlayer(p, rng)),
  };
}
