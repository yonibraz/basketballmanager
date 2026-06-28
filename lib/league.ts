/**
 * Season layer: builds a small EuroLeague-style competition out of the engine's
 * sample teams, generates a single round-robin schedule, simulates matchdays,
 * and maintains the standings table. Pure and deterministic — the UI holds the
 * resulting state and re-simulates identically from the same seed.
 */

import { MatchEngine } from "@/src/engine/MatchEngine";
import { makeSampleTeam } from "@/src/data/sampleTeams";
import { REAL_ROSTERS } from "@/src/data/realRosters";
import { seedFromString } from "@/src/rng";
import { DEFAULT_TACTICS, type MatchResult, type Tactics, type Team } from "@/src/types";

export interface TeamConfig {
  id: string;
  name: string;
  short: string;
  country: string;
  strength: number;
  quotaRuleId: string;
  foreignCount: number;
  homegrownCount: number;
}

/** The competition's clubs. Strengths are tuned to give a believable table. */
export const TEAM_CONFIGS: readonly TeamConfig[] = [
  { id: "RMB", name: "Real Madrid", short: "RMB", country: "ESP", strength: 16, quotaRuleId: "ESP_ACB", foreignCount: 4, homegrownCount: 5 },
  { id: "FCB", name: "Barcelona", short: "FCB", country: "ESP", strength: 15, quotaRuleId: "ESP_ACB", foreignCount: 4, homegrownCount: 5 },
  { id: "MTA", name: "Maccabi Tel Aviv", short: "MTA", country: "ISR", strength: 15, quotaRuleId: "ISR_BSL", foreignCount: 5, homegrownCount: 4 },
  { id: "OLY", name: "Olympiacos", short: "OLY", country: "GRC", strength: 14, quotaRuleId: "EUR_EUROLEAGUE", foreignCount: 6, homegrownCount: 3 },
  { id: "PAO", name: "Panathinaikos", short: "PAO", country: "GRC", strength: 15, quotaRuleId: "EUR_EUROLEAGUE", foreignCount: 6, homegrownCount: 3 },
  { id: "FEN", name: "Fenerbahce", short: "FEN", country: "TUR", strength: 14, quotaRuleId: "EUR_EUROLEAGUE", foreignCount: 6, homegrownCount: 3 },
  { id: "PAR", name: "Partizan", short: "PAR", country: "SRB", strength: 13, quotaRuleId: "EUR_EUROLEAGUE", foreignCount: 5, homegrownCount: 4 },
  { id: "BAY", name: "Bayern Munich", short: "BAY", country: "GER", strength: 13, quotaRuleId: "EUR_EUROLEAGUE", foreignCount: 6, homegrownCount: 3 },
];

export interface Fixture {
  matchday: number;
  homeId: string;
  awayId: string;
  played: boolean;
  homeScore?: number;
  awayScore?: number;
}

export interface Standing {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface League {
  seasonSeed: number;
  teams: Team[];
  configs: Record<string, TeamConfig>;
  schedule: Fixture[];
  standings: Record<string, Standing>;
}

export function teamById(league: League, id: string): Team {
  const t = league.teams.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown team ${id}`);
  return t;
}

/** AI tactics derived from a club's strength: stronger sides push the pace. */
export function aiTactics(strength: number): Tactics {
  return {
    ...DEFAULT_TACTICS,
    pace: 40 + strength * 1.5,
    pressingIntensity: 45 + (strength - 13) * 4,
    starRotation: 55 + (strength - 13) * 3,
  };
}

/** Circle-method single round-robin. 8 teams -> 7 matchdays of 4 games. */
function roundRobin(ids: string[]): Fixture[] {
  const arr = [...ids];
  if (arr.length % 2 !== 0) arr.push("BYE");
  const n = arr.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixtures: Fixture[] = [];
  const rotation = [...arr];

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      if (home === "BYE" || away === "BYE") continue;
      // Alternate home/away by round for a touch of balance.
      const swap = r % 2 === 1;
      fixtures.push({
        matchday: r + 1,
        homeId: swap ? away : home,
        awayId: swap ? home : away,
        played: false,
      });
    }
    // Rotate all but the first element.
    rotation.splice(1, 0, rotation.pop()!);
  }
  return fixtures;
}

export function makeLeague(seasonSeed: number): League {
  const teams = TEAM_CONFIGS.map((c) =>
    makeSampleTeam({
      id: c.id,
      name: c.name,
      country: c.country,
      seed: seasonSeed + seedFromString(c.id),
      strength: c.strength,
      foreignCount: c.foreignCount,
      homegrownCount: c.homegrownCount,
      nameRoster: REAL_ROSTERS[c.id],
    }),
  );

  const configs: Record<string, TeamConfig> = {};
  const standings: Record<string, Standing> = {};
  for (const c of TEAM_CONFIGS) {
    configs[c.id] = c;
    standings[c.id] = { teamId: c.id, played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 };
  }

  return {
    seasonSeed,
    teams,
    configs,
    schedule: roundRobin(TEAM_CONFIGS.map((c) => c.id)),
    standings,
  };
}

export const TOTAL_MATCHDAYS = TEAM_CONFIGS.length - 1;

export function fixturesForMatchday(league: League, matchday: number): Fixture[] {
  return league.schedule.filter((f) => f.matchday === matchday);
}

/** Deterministic per-fixture seed so any game re-simulates identically. */
export function fixtureSeed(league: League, f: Fixture): number {
  return seedFromString(`${league.seasonSeed}:${f.matchday}:${f.homeId}:${f.awayId}`);
}

/**
 * Simulate one fixture. The user's tactics are applied when their team plays;
 * every other club uses strength-derived AI tactics.
 */
export function simulateFixture(
  league: League,
  f: Fixture,
  userTeamId: string,
  userTactics: Tactics,
): MatchResult {
  const home = teamById(league, f.homeId);
  const away = teamById(league, f.awayId);
  const homeTactics = f.homeId === userTeamId ? userTactics : aiTactics(league.configs[f.homeId]!.strength);
  const awayTactics = f.awayId === userTeamId ? userTactics : aiTactics(league.configs[f.awayId]!.strength);
  return MatchEngine.simulate({
    home,
    away,
    homeTactics,
    awayTactics,
    seed: fixtureSeed(league, f),
    recordEvents: f.homeId === userTeamId || f.awayId === userTeamId,
  });
}

/** Apply a finished result to the schedule + standings (mutates `league`). */
export function recordResult(league: League, f: Fixture, homeScore: number, awayScore: number): void {
  const fixture = league.schedule.find(
    (x) => x.matchday === f.matchday && x.homeId === f.homeId && x.awayId === f.awayId,
  );
  if (!fixture || fixture.played) return;
  fixture.played = true;
  fixture.homeScore = homeScore;
  fixture.awayScore = awayScore;

  const h = league.standings[f.homeId]!;
  const a = league.standings[f.awayId]!;
  h.played++; a.played++;
  h.pointsFor += homeScore; h.pointsAgainst += awayScore;
  a.pointsFor += awayScore; a.pointsAgainst += homeScore;
  if (homeScore > awayScore) { h.wins++; a.losses++; } else { a.wins++; h.losses++; }
}

/** Standings sorted by wins, then point differential, then points scored. */
export function sortedStandings(league: League): Standing[] {
  return Object.values(league.standings).sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    const dx = x.pointsFor - x.pointsAgainst;
    const dy = y.pointsFor - y.pointsAgainst;
    if (dy !== dx) return dy - dx;
    return y.pointsFor - x.pointsFor;
  });
}
