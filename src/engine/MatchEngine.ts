/**
 * MatchEngine — a deterministic, possession-by-possession basketball match
 * simulator built on a Markov-chain possession cycle and a 24-second shot
 * clock (FIBA rules: 40-minute games, four 10-minute quarters, 5-minute
 * overtimes; shot clock resets to 14s after an offensive rebound; a player is
 * disqualified on their 5th personal foul).
 *
 * The engine is pure: it has no knowledge of the UI, the database, or the
 * network. It takes two teams, their tactics, and a seed, and returns a
 * finalized {@link MatchResult} (box scores plus a compressed event stream).
 * Given identical inputs it always produces an identical result.
 *
 * Possession cycle (mirrors the design diagram):
 *
 *   [Start Possession] -> [Pace/Tempo] -> [Decision: pass/drive/shoot]
 *        -> [Turnover check] (steal/deflect) -> [Shot execution]
 *        -> [Make/Miss] -> [Rebound check] -> [New Possession]
 */

import { Rng } from "../rng.js";
import {
  type MatchEvent,
  type MatchInput,
  type MatchResult,
  type OnCourt,
  type Player,
  type PlayerBoxScore,
  type Position,
  type Tactics,
  type Team,
  type TeamBoxScore,
  DEFAULT_TACTICS,
  POSITIONS,
} from "../types.js";
import {
  type ShotZone,
  SHOT_BASELINES,
  SHOT_POINTS,
  clutchBonus,
  effective,
  matchup,
} from "./probability.js";

// ---------------------------------------------------------------------------
// Timing constants (FIBA)
// ---------------------------------------------------------------------------
const PERIOD_SECONDS = 600; // 10-minute quarter
const REGULATION_PERIODS = 4;
const OVERTIME_SECONDS = 300; // 5-minute overtime
const SHOT_CLOCK = 24;
// FIBA resets the shot clock to 14s (not a full 24) when the offense retains
// possession via an offensive rebound in the frontcourt.
const SHOT_CLOCK_AFTER_OREB = 14;
// FIBA Art. 39: a player charged with 5 personal fouls is disqualified and
// must leave the game.
const MAX_PERSONAL_FOULS = 5;
const CLUTCH_TIME_SECONDS = 120; // final two minutes

// Substitute a starter once their fatigue passes this and a fresher option
// exists on the bench.
const FATIGUE_SUB_THRESHOLD = 0.62;

// ---------------------------------------------------------------------------
// Internal per-game state
// ---------------------------------------------------------------------------
interface PlayerState {
  player: Player;
  box: PlayerBoxScore;
  fatigue: number; // 0 (fresh) .. 1 (gassed)
  onCourt: boolean;
  // Disqualified after a 5th personal foul (FIBA). Cannot return to the floor.
  fouledOut: boolean;
}

interface TeamState {
  team: Team;
  tactics: Tactics;
  box: TeamBoxScore;
  states: PlayerState[];
  lineup: PlayerState[]; // exactly five on the floor
}

function blankBox(player: Player): PlayerBoxScore {
  return {
    playerId: player.id,
    name: `${player.firstName} ${player.lastName}`.trim(),
    secondsPlayed: 0,
    points: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    turnovers: 0,
    blocks: 0,
    fouls: 0,
  };
}

/** Rough offensive rating used for usage/lineup weighting. */
function offenseRating(p: Player): number {
  const a = p.attributes;
  return (a.shootingInside + a.shootingOutside + a.playmaking + a.bballIq) / 4;
}

/** Rough overall rating used to choose starters. */
function overallRating(p: Player): number {
  const a = p.attributes;
  return (
    a.shootingInside +
    a.shootingOutside +
    a.playmaking +
    a.defPerimeter +
    a.defInterior +
    a.rebounding +
    a.bballIq
  ) / 7;
}

export class MatchEngine {
  private readonly rng: Rng;
  private readonly recordEvents: boolean;
  private readonly events: MatchEvent[] = [];

  private readonly home: TeamState;
  private readonly away: TeamState;

  private period = 1;
  private clock = 0; // seconds elapsed from tip-off
  private overtime = false;

  constructor(private readonly input: MatchInput) {
    this.rng = new Rng(input.seed);
    this.recordEvents = input.recordEvents ?? true;
    this.home = this.buildTeamState(input.home, input.homeTactics ?? DEFAULT_TACTICS);
    this.away = this.buildTeamState(input.away, input.awayTactics ?? DEFAULT_TACTICS);
  }

  /** Convenience entry point. */
  static simulate(input: MatchInput): MatchResult {
    return new MatchEngine(input).run();
  }

  // -------------------------------------------------------------------------
  // Setup
  // -------------------------------------------------------------------------
  private buildTeamState(team: Team, tactics: Tactics): TeamState {
    if (team.players.length < 5) {
      throw new Error(`Team "${team.name}" needs at least 5 players to play.`);
    }
    const states: PlayerState[] = team.players.map((player) => ({
      player,
      box: blankBox(player),
      fatigue: 0,
      onCourt: false,
      fouledOut: false,
    }));

    const lineup = this.pickStartingFive(states);
    for (const s of lineup) s.onCourt = true;

    return {
      team,
      tactics,
      box: { teamId: team.id, teamName: team.name, points: 0, players: states.map((s) => s.box) },
      states,
      lineup,
    };
  }

  /**
   * Choose a starting five. Prefer the best-rated available player at each
   * position; if a position is unfilled, take the best remaining player of any
   * position. This keeps the engine robust to lopsided rosters.
   */
  private pickStartingFive(states: PlayerState[]): PlayerState[] {
    const available = [...states].sort(
      (a, b) => overallRating(b.player) - overallRating(a.player),
    );
    const chosen: PlayerState[] = [];
    const used = new Set<PlayerState>();

    for (const pos of POSITIONS) {
      const pick = available.find((s) => !used.has(s) && s.player.position === pos);
      if (pick) {
        chosen.push(pick);
        used.add(pick);
      }
    }
    for (const s of available) {
      if (chosen.length === 5) break;
      if (!used.has(s)) {
        chosen.push(s);
        used.add(s);
      }
    }
    return chosen.slice(0, 5);
  }

  // -------------------------------------------------------------------------
  // Main loop
  // -------------------------------------------------------------------------
  run(): MatchResult {
    this.emit({ type: "tip-off", period: 1, clock: 0 });

    // Regulation.
    for (this.period = 1; this.period <= REGULATION_PERIODS; this.period++) {
      this.playPeriod(PERIOD_SECONDS);
    }

    // Overtime(s) until a winner emerges.
    while (this.home.box.points === this.away.box.points) {
      this.overtime = true;
      this.playPeriod(OVERTIME_SECONDS);
      this.period++;
    }
    // The for/while loops leave `period` one past the last played period.
    const periodsPlayed = this.period - 1;

    this.emit({ type: "final", period: periodsPlayed, clock: this.clock });

    return {
      home: this.home.box,
      away: this.away.box,
      events: this.events,
      periods: periodsPlayed,
      seed: this.input.seed,
      overtime: this.overtime,
    };
  }

  /** Plays one period of the supplied length, alternating possessions. */
  private playPeriod(periodSeconds: number): void {
    let remaining = periodSeconds;
    // Home receives to open the game; thereafter alternate the opening
    // possession by period to approximate the possession arrow.
    let offense = this.period % 2 === 1 ? this.home : this.away;
    let defense = offense === this.home ? this.away : this.home;
    // A possession that follows an offensive rebound runs off a 14s shot clock
    // (FIBA reset), not a fresh 24.
    let afterOffReb = false;

    while (remaining > 0) {
      const shotClock = afterOffReb ? SHOT_CLOCK_AFTER_OREB : SHOT_CLOCK;
      const duration = this.possessionDuration(offense, defense, remaining, shotClock);
      remaining -= duration;
      this.clock += duration;

      this.applyFatigue(offense, duration);
      this.applyFatigue(defense, duration);
      this.creditMinutes(offense, duration);
      this.creditMinutes(defense, duration);

      const retained = this.runPossession(offense, defense);

      // Substitutions happen at the dead ball between possessions.
      this.maybeSubstitute(offense);
      this.maybeSubstitute(defense);

      // `retained` is true only on an offensive rebound; the next possession by
      // the same offense then gets the shortened 14s clock.
      afterOffReb = retained;
      if (!retained) {
        const t = offense;
        offense = defense;
        defense = t;
      }
    }

    this.emit({ type: "period-end", period: this.period, clock: this.clock });
  }

  /**
   * Possession length in seconds, derived from both teams' pace tactics. A
   * faster pace shortens possessions (more possessions per game). Clamped to
   * the [4, shotClock] window and never longer than the time left in the
   * period. `shotClock` is 24 normally, or 14 after an offensive rebound.
   */
  private possessionDuration(
    offense: TeamState,
    defense: TeamState,
    remaining: number,
    shotClock: number = SHOT_CLOCK,
  ): number {
    const avgPace = (offense.tactics.pace + defense.tactics.pace) / 2; // 0..100
    const base = 17 - (avgPace - 50) * 0.12; // ~11s (fast) .. ~23s (slow)
    const noise = this.rng.int(-3, 3);
    const dur = Math.max(4, Math.min(shotClock, Math.round(base + noise)));
    return Math.min(dur, remaining);
  }

  // -------------------------------------------------------------------------
  // Possession resolution (the Markov cycle)
  // -------------------------------------------------------------------------
  /** Returns true if the offense retains possession (offensive rebound). */
  private runPossession(offense: TeamState, defense: TeamState): boolean {
    const handler = this.pickBallHandler(offense);

    // --- Turnover / steal check -------------------------------------------
    const press = defense.tactics.pressingIntensity / 100; // 0..1
    const handlerControl = this.eff(handler, (a) => (a.playmaking + a.bballIq) / 2);
    // Base TO rate ~12%, raised by pressing, lowered by ball control.
    const toProb = 0.06 + press * 0.10 + (10 - handlerControl) * 0.006;
    if (this.rng.chance(toProb)) {
      this.recordTurnover(offense, defense, handler);
      return false;
    }

    // --- Decision: shooter & shot zone ------------------------------------
    const shooter = this.pickShooter(offense);
    const zone = this.pickZone(shooter, offense.tactics);
    return this.executeShot(offense, defense, handler, shooter, zone);
  }

  private recordTurnover(offense: TeamState, defense: TeamState, handler: PlayerState): void {
    handler.box.turnovers++;
    // A share of turnovers are live-ball steals credited to a defender.
    if (this.rng.chance(0.55)) {
      const thief = this.bestDefender(defense, "defPerimeter");
      thief.box.steals++;
      this.emit({
        type: "steal",
        period: this.period,
        clock: this.clock,
        teamId: defense.team.id,
        playerId: thief.player.id,
      });
    }
    this.emit({
      type: "turnover",
      period: this.period,
      clock: this.clock,
      teamId: offense.team.id,
      playerId: handler.player.id,
    });
  }

  /**
   * Resolve a shot attempt. Handles shooting fouls (free throws), blocks,
   * makes (with possible assist), and misses (with rebound battle).
   * Returns true if the offense retains possession via offensive rebound.
   */
  private executeShot(
    offense: TeamState,
    defense: TeamState,
    handler: PlayerState,
    shooter: PlayerState,
    zone: ShotZone,
  ): boolean {
    const isThree = zone === "three";
    const defender =
      zone === "inside"
        ? this.bestDefender(defense, "defInterior")
        : this.bestDefender(defense, "defPerimeter");

    // Shooting foul check — more likely inside and against heavy pressing.
    const foulProb =
      (zone === "inside" ? 0.13 : isThree ? 0.03 : 0.06) +
      (defense.tactics.pressingIntensity / 100) * 0.04;
    if (this.rng.chance(foulProb)) {
      this.commitFoul(defense, defender);
      this.shootFreeThrows(offense, shooter, isThree ? 3 : 2);
      return false; // ball changes hands after the final free throw
    }

    // Make probability from the offense/defense matchup, fatigue and clutch.
    const offAttr =
      zone === "three"
        ? this.eff(shooter, (a) => a.shootingOutside)
        : zone === "inside"
          ? this.eff(shooter, (a) => a.shootingInside)
          : this.eff(shooter, (a) => (a.shootingInside + a.shootingOutside) / 2);
    const defAttr = zone === "inside"
      ? this.eff(defender, (a) => a.defInterior)
      : this.eff(defender, (a) => a.defPerimeter);

    let makeProb = matchup(offAttr, defAttr, SHOT_BASELINES[zone]);
    // Clutch swing in the final two minutes of a one-possession game.
    if (this.isClutchTime()) {
      const margin = Math.abs(this.home.box.points - this.away.box.points);
      if (margin <= 3) makeProb = clamp(makeProb + clutchBonus(shooter.player.attributes.clutch, true));
    }

    shooter.box.fieldGoalsAttempted++;
    if (isThree) shooter.box.threePointersAttempted++;

    // Block check on a miss-bound inside attempt.
    const made = this.rng.chance(makeProb);
    if (!made) {
      const blockProb = zone === "inside" ? 0.05 + (defAttr - 10) * 0.006 : 0.012;
      if (this.rng.chance(blockProb)) {
        defender.box.blocks++;
        this.emit({
          type: "block",
          period: this.period,
          clock: this.clock,
          teamId: defense.team.id,
          playerId: defender.player.id,
        });
      }
      this.emit({
        type: "missed-fg",
        period: this.period,
        clock: this.clock,
        teamId: offense.team.id,
        playerId: shooter.player.id,
        detail: zone,
      });
      return this.reboundBattle(offense, defense);
    }

    // Made field goal.
    const points = SHOT_POINTS[zone];
    this.score(offense, shooter, points);
    if (isThree) shooter.box.threePointersMade++;
    shooter.box.fieldGoalsMade++;

    // Assist: credited to the ball handler when distinct from the shooter.
    if (handler !== shooter && this.rng.chance(this.assistProbability(handler, zone))) {
      handler.box.assists++;
    }

    this.emit({
      type: "made-fg",
      period: this.period,
      clock: this.clock,
      teamId: offense.team.id,
      playerId: shooter.player.id,
      points,
      detail: zone,
    });
    return false;
  }

  private shootFreeThrows(offense: TeamState, shooter: PlayerState, count: number): void {
    // Free-throw skill proxied from outside shooting and clutch.
    const ftSkill = (shooter.player.attributes.shootingOutside + shooter.player.attributes.clutch) / 2;
    const ftProb = clamp(0.5 + (ftSkill - 10) * 0.025); // ~50%..75% across the scale
    for (let i = 0; i < count; i++) {
      shooter.box.freeThrowsAttempted++;
      const made = this.rng.chance(ftProb);
      if (made) {
        shooter.box.freeThrowsMade++;
        this.score(offense, shooter, 1);
      }
      this.emit({
        type: "free-throw",
        period: this.period,
        clock: this.clock,
        teamId: offense.team.id,
        playerId: shooter.player.id,
        // points is 1 on a make / 0 on a miss so a viewer can reconstruct the
        // running score purely from the event stream.
        points: made ? 1 : 0,
        detail: made ? "make" : "miss",
      });
    }
  }

  /** Resolve the rebound after a missed shot. Returns true on offensive board. */
  private reboundBattle(offense: TeamState, defense: TeamState): boolean {
    const offReb = this.teamReboundStrength(offense);
    const defReb = this.teamReboundStrength(defense);
    // Defenses recover the large majority of rebounds; weight accordingly.
    const offChance = (offReb * 0.45) / (offReb * 0.45 + defReb);
    if (this.rng.chance(offChance)) {
      const rebounder = this.bestRebounder(offense);
      rebounder.box.offensiveRebounds++;
      this.emit({
        type: "offensive-rebound",
        period: this.period,
        clock: this.clock,
        teamId: offense.team.id,
        playerId: rebounder.player.id,
      });
      return true;
    }
    const rebounder = this.bestRebounder(defense);
    rebounder.box.defensiveRebounds++;
    this.emit({
      type: "defensive-rebound",
      period: this.period,
      clock: this.clock,
      teamId: defense.team.id,
      playerId: rebounder.player.id,
    });
    return false;
  }

  // -------------------------------------------------------------------------
  // Selection helpers (weighted, deterministic via the seeded RNG)
  // -------------------------------------------------------------------------
  private pickBallHandler(team: TeamState): PlayerState {
    const weights = team.lineup.map((s) =>
      Math.max(0.1, this.eff(s, (a) => a.playmaking * 1.5 + a.bballIq)),
    );
    return team.lineup[this.rng.weightedIndex(weights)]!;
  }

  private pickShooter(team: TeamState): PlayerState {
    // Usage concentrates on better offensive players; starRotation sharpens it.
    const sharpen = 1 + team.tactics.starRotation / 120;
    const weights = team.lineup.map((s) =>
      Math.pow(Math.max(1, this.eff(s, () => offenseRating(s.player))), sharpen),
    );
    return team.lineup[this.rng.weightedIndex(weights)]!;
  }

  private pickZone(shooter: PlayerState, tactics: Tactics): ShotZone {
    const a = shooter.player.attributes;
    // Base tendency from the player's own profile.
    let insideW = a.shootingInside + a.strength * 0.4;
    let threeW = a.shootingOutside;
    let midW = (a.shootingInside + a.shootingOutside) / 2;
    // Tactical focus tilts shot selection.
    if (tactics.offensiveFocus === "inside") {
      insideW *= 1.6;
      threeW *= 0.7;
    } else if (tactics.offensiveFocus === "perimeter") {
      threeW *= 1.6;
      insideW *= 0.8;
    }
    // Floor each weight so a player with all-zero shooting/strength (possible
    // for caller-supplied teams loaded from nullable DB columns) can never make
    // the weights sum to zero — which would throw in weightedPick. Consistent
    // with the Math.max floors used by the other on-court selectors.
    return this.rng.weightedPick(
      ["inside", "mid", "three"] as const,
      [Math.max(0.1, insideW), Math.max(0.1, midW), Math.max(0.1, threeW)],
    );
  }

  private assistProbability(handler: PlayerState, zone: ShotZone): number {
    const base = zone === "three" ? 0.55 : zone === "inside" ? 0.4 : 0.35;
    return clamp(base + (handler.player.attributes.playmaking - 10) * 0.02);
  }

  private bestDefender(team: TeamState, attr: "defPerimeter" | "defInterior"): PlayerState {
    return team.lineup.reduce((best, s) =>
      this.eff(s, (a) => a[attr]) > this.eff(best, (a) => a[attr]) ? s : best,
    );
  }

  private bestRebounder(team: TeamState): PlayerState {
    // Weighted, not deterministic-max, so boards spread across the lineup.
    const weights = team.lineup.map((s) =>
      Math.max(0.2, this.eff(s, (a) => a.rebounding * 1.5 + a.strength)),
    );
    return team.lineup[this.rng.weightedIndex(weights)]!;
  }

  private teamReboundStrength(team: TeamState): number {
    return team.lineup.reduce(
      (sum, s) => sum + this.eff(s, (a) => a.rebounding + a.strength * 0.5),
      0,
    );
  }

  // -------------------------------------------------------------------------
  // Fatigue, minutes, substitutions
  // -------------------------------------------------------------------------
  private applyFatigue(team: TeamState, seconds: number): void {
    for (const s of team.states) {
      if (s.onCourt) {
        // Higher stamina => slower fatigue accrual.
        const rate = (1.2 - (s.player.attributes.stamina - 1) / 19) / 1100;
        s.fatigue = clamp(s.fatigue + rate * seconds);
      } else {
        // Bench players recover.
        s.fatigue = Math.max(0, s.fatigue - (seconds / 900));
      }
    }
  }

  private creditMinutes(team: TeamState, seconds: number): void {
    for (const s of team.lineup) s.box.secondsPlayed += seconds;
  }

  private maybeSubstitute(team: TeamState): void {
    if (team.states.length <= 5) return; // no bench
    for (let i = 0; i < team.lineup.length; i++) {
      const tired = team.lineup[i]!;
      if (tired.fatigue < FATIGUE_SUB_THRESHOLD) continue;

      // Find the freshest eligible bench player (never a disqualified one).
      const replacement = this.freshestBench(team);
      if (!replacement || replacement.fatigue > tired.fatigue - 0.1) continue;

      tired.onCourt = false;
      replacement.onCourt = true;
      team.lineup[i] = replacement;
      this.emit({
        type: "substitution",
        period: this.period,
        clock: this.clock,
        teamId: team.team.id,
        playerId: replacement.player.id,
        detail: `for ${tired.box.name}`,
      });
    }
  }

  /** Freshest bench player still eligible to enter (not on court, not DQ'd). */
  private freshestBench(team: TeamState): PlayerState | undefined {
    return team.states
      .filter((s) => !s.onCourt && !s.fouledOut)
      .sort((a, b) => a.fatigue - b.fatigue)[0];
  }

  /**
   * Charge a personal foul. On the 5th foul the player is disqualified (FIBA)
   * and is immediately replaced by the freshest eligible bench player. If no
   * substitute is available the team plays on a man short.
   */
  private commitFoul(team: TeamState, fouler: PlayerState): void {
    fouler.box.fouls++;
    this.emit({
      type: "foul",
      period: this.period,
      clock: this.clock,
      teamId: team.team.id,
      playerId: fouler.player.id,
    });
    // Foulers are only ever drawn from the on-court lineup, so a player who is
    // already disqualified can never reach this point.
    if (fouler.box.fouls < MAX_PERSONAL_FOULS) return;

    // The disqualified player must leave the floor regardless of whether a
    // substitute exists. If the bench is exhausted the team plays a man short;
    // either way the player is removed from the lineup so they can no longer be
    // selected to shoot, defend, rebound, or foul again.
    fouler.fouledOut = true;
    fouler.onCourt = false;
    const replacement = this.freshestBench(team);
    const slot = team.lineup.indexOf(fouler);
    if (slot !== -1) {
      if (replacement) {
        replacement.onCourt = true;
        team.lineup[slot] = replacement;
      } else {
        team.lineup.splice(slot, 1);
      }
    }
    this.emit({
      type: "foul-out",
      period: this.period,
      clock: this.clock,
      teamId: team.team.id,
      playerId: fouler.player.id,
      detail: replacement ? `replaced by ${replacement.box.name}` : "no substitute available",
    });
  }

  // -------------------------------------------------------------------------
  // Small utilities
  // -------------------------------------------------------------------------
  /** Effective attribute value for a player after fatigue is applied. */
  private eff(s: PlayerState, select: (a: Player["attributes"]) => number): number {
    return effective(select(s.player.attributes), s.fatigue, s.player.attributes.stamina);
  }

  private score(team: TeamState, scorer: PlayerState, points: number): void {
    scorer.box.points += points;
    team.box.points += points;
  }

  private isClutchTime(): boolean {
    // Clutch only matters from the fourth quarter onward (and any overtime).
    if (this.period < REGULATION_PERIODS) return false;
    const periodLen = this.period <= REGULATION_PERIODS ? PERIOD_SECONDS : OVERTIME_SECONDS;
    const elapsedInPeriod = this.clock - this.periodStartClock();
    return periodLen - elapsedInPeriod <= CLUTCH_TIME_SECONDS;
  }

  private periodStartClock(): number {
    if (this.period <= REGULATION_PERIODS) return (this.period - 1) * PERIOD_SECONDS;
    return REGULATION_PERIODS * PERIOD_SECONDS + (this.period - REGULATION_PERIODS - 1) * OVERTIME_SECONDS;
  }

  private emit(event: MatchEvent): void {
    if (this.recordEvents) this.events.push(event);
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Helper: build an {@link OnCourt} lineup map from five players by position. */
export function lineupFromPlayers(players: Player[]): OnCourt {
  const byPos = (pos: Position) => players.find((p) => p.position === pos) ?? players[0]!;
  return {
    PG: byPos("PG"),
    SG: byPos("SG"),
    SF: byPos("SF"),
    PF: byPos("PF"),
    C: byPos("C"),
  };
}

export type { MatchResult, MatchInput, TeamBoxScore, PlayerBoxScore };
export { MatchEngine as default };
