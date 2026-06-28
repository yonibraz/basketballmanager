/**
 * Domain types for the international basketball manager engine.
 *
 * These types mirror the PostgreSQL schema in `db/schema.sql` but use
 * camelCase and the units the simulation actually works in. The persistence
 * layer is responsible for mapping snake_case rows onto these shapes.
 */

/** Playing positions, used for defensive matchups and lineup validity. */
export type Position = "PG" | "SG" | "SF" | "PF" | "C";

export const POSITIONS: readonly Position[] = ["PG", "SG", "SF", "PF", "C"];

/**
 * Player attributes on the canonical 1–20 scale (as in the DDL). Higher is
 * better. Grouped here for readability; persisted as flat columns.
 */
export interface PlayerAttributes {
  // Technical / offensive
  shootingInside: number;
  shootingOutside: number;
  playmaking: number;
  // Defensive
  defPerimeter: number;
  defInterior: number;
  rebounding: number;
  // Physical
  pace: number;
  strength: number;
  stamina: number;
  // Mental
  bballIq: number;
  leadership: number;
  clutch: number;
}

export const ATTRIBUTE_KEYS: readonly (keyof PlayerAttributes)[] = [
  "shootingInside",
  "shootingOutside",
  "playmaking",
  "defPerimeter",
  "defInterior",
  "rebounding",
  "pace",
  "strength",
  "stamina",
  "bballIq",
  "leadership",
  "clutch",
];

export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  /** ISO-3166 alpha-3 country code, e.g. "ESP". Used for quota tracking. */
  nationality: string;
  /** Optional second nationality (dual passports affect foreigner quotas). */
  secondNationality?: string;
  age: number;
  position: Position;
  attributes: PlayerAttributes;
  /**
   * Whether the player counts as "homegrown / locally trained" for the team
   * they are registered with. This is a registration property, not derived
   * purely from nationality (a foreign passport holder trained locally can
   * still be homegrown under most European rules).
   */
  homegrown?: boolean;
  /**
   * Remaining matchdays the player is unavailable due to injury.
   * 0 or undefined = healthy; >0 = injured and out for that many matchdays.
   */
  injuryWeeksLeft?: number;
}

/** A team's full registered roster plus identity used for quota checks. */
export interface Team {
  id: string;
  name: string;
  /** ISO-3166 alpha-3 code of the team's home country. */
  country: string;
  players: Player[];
  /** Transfer budget in millions (e.g. 50 = £50M). Optional for backwards compatibility. */
  budget?: number;
}

/** Offensive emphasis applied when distributing shot selection. */
export type OffensiveFocus = "inside" | "balanced" | "perimeter";

/**
 * Coach-controlled tactical inputs. All sliders are on a 0–100 scale unless
 * otherwise noted; the engine maps them onto possession-level probabilities.
 */
export interface Tactics {
  /** 0 = walk it up (slow), 100 = run constantly (fast). Affects possessions. */
  pace: number;
  /** Where the offense looks to score. */
  offensiveFocus: OffensiveFocus;
  /** 0 = sag off, 100 = full-court press. Trades turnovers for foul/blow-by risk. */
  pressingIntensity: number;
  /** 0–100. How heavily minutes concentrate on the starters/stars. */
  starRotation: number;
}

export const DEFAULT_TACTICS: Tactics = {
  pace: 50,
  offensiveFocus: "balanced",
  pressingIntensity: 50,
  starRotation: 60,
};

/** The five players currently on the floor for a team, by lineup slot. */
export interface OnCourt {
  PG: Player;
  SG: Player;
  SF: Player;
  PF: Player;
  C: Player;
}

/** Per-player accumulated statistics for a single game. */
export interface PlayerBoxScore {
  playerId: string;
  name: string;
  secondsPlayed: number;
  points: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  turnovers: number;
  blocks: number;
  fouls: number;
}

/** Aggregated team line for a single game. */
export interface TeamBoxScore {
  teamId: string;
  teamName: string;
  points: number;
  players: PlayerBoxScore[];
}

/** Discrete, replayable events emitted during simulation. */
export type MatchEventType =
  | "tip-off"
  | "made-fg"
  | "missed-fg"
  | "free-throw"
  | "offensive-rebound"
  | "defensive-rebound"
  | "turnover"
  | "steal"
  | "block"
  | "foul"
  | "foul-out"
  | "substitution"
  | "timeout"
  | "period-end"
  | "final";

/**
 * A single event in the compressed match stream. `clock` is seconds elapsed
 * from tip-off; `period` is 1–4 (or 5+ for overtime).
 */
export interface MatchEvent {
  period: number;
  clock: number;
  type: MatchEventType;
  teamId?: string;
  playerId?: string;
  points?: number;
  detail?: string;
}

export interface MatchResult {
  home: TeamBoxScore;
  away: TeamBoxScore;
  events: MatchEvent[];
  periods: number;
  seed: number;
  /** Convenience flag: did the game require overtime? */
  overtime: boolean;
}

export interface MatchInput {
  home: Team;
  away: Team;
  homeTactics?: Tactics;
  awayTactics?: Tactics;
  /** Deterministic seed. Same seed + same inputs => identical result. */
  seed: number;
  /** Whether to record the full event stream (defaults to true). */
  recordEvents?: boolean;
  /**
   * Enable interactive ("live") mode. When set, the engine is driven one
   * possession at a time via {@link MatchEngine.startLive}/`step`, and manager
   * hooks (timeouts, in-game tactics, manual subs, defensive matchups) take
   * effect. Live-only mechanics never run in batch mode, so {@link
   * MatchEngine.simulate} stays byte-identical for a given seed.
   */
  live?: boolean;
}
