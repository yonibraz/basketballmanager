/**
 * Deterministic sample-team factory for demos and tests. Builds a full 12-man
 * roster with positionally sensible attribute profiles from a seed, so test
 * fixtures are reproducible without hand-authoring dozens of players.
 */

import { Rng } from "../rng.js";
import type { Player, PlayerAttributes, Position, Team } from "../types.js";

const FIRST_NAMES = [
  "Luka", "Nikola", "Sergio", "Vassilis", "Dario", "Bogdan", "Theo", "Mateusz",
  "Janis", "Tomas", "Pau", "Rudy", "Nando", "Kostas", "Edy", "Adam",
];
const LAST_NAMES = [
  "Doncic", "Jokic", "Rodriguez", "Spanoulis", "Saric", "Bogdanovic", "Maledon",
  "Ponitka", "Strelnieks", "Satoransky", "Ribas", "Fernandez", "DeColo",
  "Sloukas", "Tavares", "Hanga",
];

/** Position template biases (which attributes a position emphasises). */
const POSITION_BIAS: Record<Position, Partial<PlayerAttributes>> = {
  PG: { playmaking: 5, shootingOutside: 3, defPerimeter: 2, pace: 3, rebounding: -3, defInterior: -3, strength: -2 },
  SG: { shootingOutside: 5, playmaking: 2, defPerimeter: 2, rebounding: -2, defInterior: -3 },
  SF: { shootingOutside: 2, shootingInside: 2, rebounding: 1, defPerimeter: 1 },
  PF: { shootingInside: 4, rebounding: 4, defInterior: 3, strength: 3, shootingOutside: -2, pace: -2 },
  C: { shootingInside: 5, rebounding: 5, defInterior: 5, strength: 4, shootingOutside: -4, playmaking: -3, pace: -3 },
};

const LINEUP_ORDER: Position[] = ["PG", "SG", "SF", "PF", "C", "PG", "SG", "SF", "PF", "C", "SF", "PG"];

function clampAttr(v: number): number {
  return Math.max(1, Math.min(20, Math.round(v)));
}

function makeAttributes(rng: Rng, position: Position, baseline: number): PlayerAttributes {
  const bias = POSITION_BIAS[position];
  const base = (key: keyof PlayerAttributes): number =>
    clampAttr(baseline + (bias[key] ?? 0) + rng.int(-2, 2));
  return {
    shootingInside: base("shootingInside"),
    shootingOutside: base("shootingOutside"),
    playmaking: base("playmaking"),
    defPerimeter: base("defPerimeter"),
    defInterior: base("defInterior"),
    rebounding: base("rebounding"),
    pace: base("pace"),
    strength: base("strength"),
    stamina: base("stamina"),
    bballIq: base("bballIq"),
    leadership: base("leadership"),
    clutch: base("clutch"),
  };
}

export interface SampleTeamOptions {
  id: string;
  name: string;
  /** ISO-3 home country; drives nationality assignment. */
  country: string;
  seed: number;
  /** Average attribute level (1–20). Higher => stronger team. */
  strength?: number;
  /** How many players are foreign (non-home-country). */
  foreignCount?: number;
  /** How many players are flagged homegrown / locally trained. */
  homegrownCount?: number;
  /** Foreign nationality pool to draw from. */
  foreignPool?: string[];
}

export function makeSampleTeam(opts: SampleTeamOptions): Team {
  const rng = new Rng(opts.seed);
  const strength = opts.strength ?? 12;
  const foreignCount = opts.foreignCount ?? 4;
  const homegrownCount = opts.homegrownCount ?? 5;
  const foreignPool = opts.foreignPool ?? ["USA", "SRB", "FRA", "GRE", "LTU"];

  const players: Player[] = LINEUP_ORDER.map((position, i) => {
    const foreign = i < foreignCount;
    const nationality = foreign ? foreignPool[i % foreignPool.length]! : opts.country;
    // Homegrown players are taken from the non-foreign tail of the roster.
    const homegrown = !foreign && i >= LINEUP_ORDER.length - homegrownCount;
    return {
      id: `${opts.id}-p${i + 1}`,
      firstName: FIRST_NAMES[(opts.seed + i) % FIRST_NAMES.length]!,
      lastName: LAST_NAMES[(opts.seed * 3 + i) % LAST_NAMES.length]!,
      nationality,
      age: rng.int(19, 34),
      position,
      attributes: makeAttributes(rng, position, strength),
      homegrown,
    };
  });

  return { id: opts.id, name: opts.name, country: opts.country, players };
}
