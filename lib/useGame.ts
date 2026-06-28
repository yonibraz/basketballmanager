"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TACTICS, type MatchResult, type PlayerBoxScore, type Tactics } from "@/src/types";
import { Rng } from "@/src/rng";
import {
  type Fixture,
  type League,
  type PlayoffBracket,
  type PlayoffGame,
  TOTAL_MATCHDAYS,
  fixturesForMatchday,
  generatePlayoff,
  makeLeague,
  recordResult,
  resolvePlayoffSemis,
  simulateFixture,
} from "./league";
import { developPlayers } from "./playerDev";

const SAVE_KEY = "courtside-save-v2";
const DEFAULT_SEED = 20260626;

export interface AccumulatedStats {
  playerId: string;
  name: string;
  teamId: string;
  gamesPlayed: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fieldGoalsMade: number;
  fieldGoalsAttempted: number;
  freeThrowsMade: number;
  freeThrowsAttempted: number;
  threePointersMade: number;
  threePointersAttempted: number;
  secondsPlayed: number;
  fouls: number;
}

interface SavedResult {
  matchday: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
}

interface PlayoffState {
  bracket: PlayoffBracket | null;
  phase: "none" | "semis" | "final" | "done";
  currentGame: 0 | 1 | 2;
}

interface SaveData {
  v: 2;
  seasonSeed: number;
  /** How many end-of-season development passes have been applied to this league. */
  developmentPasses: number;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  results: SavedResult[];
  seasonStats?: Record<string, AccumulatedStats>;
  playoff?: PlayoffState;
}

export interface Game {
  ready: boolean;
  league: League;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  seasonOver: boolean;
  userFixture: Fixture | null;
  seasonStats: Record<string, AccumulatedStats>;
  playoff: PlayoffState;
  playoffFixture: PlayoffGame | null;
  chooseTeam: (id: string) => void;
  setTactics: (t: Tactics) => void;
  /** Record the user's (already simulated) result, then sim the rest + advance. */
  completeMatchday: (userFixture: Fixture, homeScore: number, awayScore: number, userResult: MatchResult) => void;
  completePlayoffGame: (homeScore: number, awayScore: number) => void;
  newSeason: () => void;
}

function mergeBoxScore(
  accumulated: Record<string, AccumulatedStats>,
  teamId: string,
  players: PlayerBoxScore[],
): Record<string, AccumulatedStats> {
  const next = { ...accumulated };
  for (const p of players) {
    const existing = next[p.playerId];
    if (existing) {
      next[p.playerId] = {
        ...existing,
        gamesPlayed: existing.gamesPlayed + 1,
        points: existing.points + p.points,
        rebounds: existing.rebounds + p.offensiveRebounds + p.defensiveRebounds,
        assists: existing.assists + p.assists,
        steals: existing.steals + p.steals,
        blocks: existing.blocks + p.blocks,
        turnovers: existing.turnovers + p.turnovers,
        fieldGoalsMade: existing.fieldGoalsMade + p.fieldGoalsMade,
        fieldGoalsAttempted: existing.fieldGoalsAttempted + p.fieldGoalsAttempted,
        freeThrowsMade: existing.freeThrowsMade + p.freeThrowsMade,
        freeThrowsAttempted: existing.freeThrowsAttempted + p.freeThrowsAttempted,
        threePointersMade: existing.threePointersMade + p.threePointersMade,
        threePointersAttempted: existing.threePointersAttempted + p.threePointersAttempted,
        secondsPlayed: existing.secondsPlayed + p.secondsPlayed,
        fouls: existing.fouls + p.fouls,
      };
    } else {
      next[p.playerId] = {
        playerId: p.playerId,
        name: p.name,
        teamId,
        gamesPlayed: 1,
        points: p.points,
        rebounds: p.offensiveRebounds + p.defensiveRebounds,
        assists: p.assists,
        steals: p.steals,
        blocks: p.blocks,
        turnovers: p.turnovers,
        fieldGoalsMade: p.fieldGoalsMade,
        fieldGoalsAttempted: p.fieldGoalsAttempted,
        freeThrowsMade: p.freeThrowsMade,
        freeThrowsAttempted: p.freeThrowsAttempted,
        threePointersMade: p.threePointersMade,
        threePointersAttempted: p.threePointersAttempted,
        secondsPlayed: p.secondsPlayed,
        fouls: p.fouls,
      };
    }
  }
  return next;
}

function findUserFixture(league: League, matchday: number, userTeamId: string | null): Fixture | null {
  if (!userTeamId || matchday > TOTAL_MATCHDAYS) return null;
  return (
    fixturesForMatchday(league, matchday).find((f) => f.homeId === userTeamId || f.awayId === userTeamId) ?? null
  );
}

/**
 * Apply N deterministic development passes to a freshly-built league.
 * Each pass uses a seed derived from the season seed XOR a pass-specific constant,
 * so replaying the same passes always yields the same rosters.
 */
function applyDevelopmentPasses(lg: League, passes: number): void {
  for (let i = 0; i < passes; i++) {
    // XOR with pass index so each pass has a distinct but deterministic seed.
    const devRng = new Rng((lg.seasonSeed ^ 0xdeadbeef) + i);
    lg.teams = lg.teams.map((t) => developPlayers(t, devRng));
  }
}

function rebuild(save: SaveData): League {
  const league = makeLeague(save.seasonSeed);
  applyDevelopmentPasses(league, save.developmentPasses);
  for (const r of save.results) {
    const f = league.schedule.find(
      (x) => x.matchday === r.matchday && x.homeId === r.homeId && x.awayId === r.awayId,
    );
    if (f) recordResult(league, f, r.homeScore, r.awayScore);
  }
  return league;
}

const DEFAULT_PLAYOFF: PlayoffState = { bracket: null, phase: "none", currentGame: 0 };

export function useGame(): Game {
  const [ready, setReady] = useState(false);
  const seedRef = useRef(DEFAULT_SEED);
  const devPassesRef = useRef(0);
  const [league, setLeague] = useState<League>(() => makeLeague(DEFAULT_SEED));
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [tactics, setTacticsState] = useState<Tactics>(DEFAULT_TACTICS);
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [seasonStats, setSeasonStats] = useState<Record<string, AccumulatedStats>>({});
  const [playoff, setPlayoff] = useState<PlayoffState>(DEFAULT_PLAYOFF);

  // Load any saved game on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const save = JSON.parse(raw) as SaveData;
        if (save?.v === 2) {
          seedRef.current = save.seasonSeed;
          devPassesRef.current = save.developmentPasses ?? 0;
          setLeague(rebuild(save));
          setUserTeamId(save.userTeamId);
          setTacticsState(save.tactics ?? DEFAULT_TACTICS);
          setCurrentMatchday(save.currentMatchday ?? 1);
          setSeasonStats(save.seasonStats ?? {});
          if (save.playoff) setPlayoff(save.playoff);
        }
      }
    } catch {
      /* ignore corrupt saves */
    }
    setReady(true);
  }, []);

  const persist = useCallback(
    (next: Partial<{
      userTeamId: string | null;
      tactics: Tactics;
      currentMatchday: number;
      league: League;
      developmentPasses: number;
      seasonStats: Record<string, AccumulatedStats>;
      playoff: PlayoffState;
    }>) => {
      const lg = next.league ?? league;
      const save: SaveData = {
        v: 2,
        seasonSeed: seedRef.current,
        developmentPasses: next.developmentPasses !== undefined ? next.developmentPasses : devPassesRef.current,
        userTeamId: next.userTeamId !== undefined ? next.userTeamId : userTeamId,
        tactics: next.tactics ?? tactics,
        currentMatchday: next.currentMatchday ?? currentMatchday,
        results: lg.schedule
          .filter((f) => f.played)
          .map((f) => ({
            matchday: f.matchday,
            homeId: f.homeId,
            awayId: f.awayId,
            homeScore: f.homeScore ?? 0,
            awayScore: f.awayScore ?? 0,
          })),
        seasonStats: next.seasonStats !== undefined ? next.seasonStats : seasonStats,
        playoff: next.playoff ?? playoff,
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        /* storage may be unavailable */
      }
    },
    [league, userTeamId, tactics, currentMatchday, seasonStats, playoff],
  );

  const chooseTeam = useCallback(
    (id: string) => {
      setUserTeamId(id);
      persist({ userTeamId: id });
    },
    [persist],
  );

  const setTactics = useCallback(
    (t: Tactics) => {
      setTacticsState(t);
      persist({ tactics: t });
    },
    [persist],
  );

  const completeMatchday = useCallback(
    (userFixture: Fixture, homeScore: number, awayScore: number, userResult: MatchResult) => {
      if (!userTeamId) return;

      // Use the MatchResult from the live viewer directly — it already contains
      // the authentic box scores, including any mid-game tactics/subs the user applied.
      let nextStats = { ...seasonStats };
      nextStats = mergeBoxScore(nextStats, userFixture.homeId, userResult.home.players);
      nextStats = mergeBoxScore(nextStats, userFixture.awayId, userResult.away.players);

      // Record the user's match (already simulated by the viewer).
      recordResult(league, userFixture, homeScore, awayScore);

      // Simulate every other fixture on this matchday instantly.
      for (const f of fixturesForMatchday(league, currentMatchday)) {
        if (f.played) continue;
        const res = simulateFixture(league, f, userTeamId, tactics);
        recordResult(league, f, res.home.points, res.away.points);
        nextStats = mergeBoxScore(nextStats, f.homeId, res.home.players);
        nextStats = mergeBoxScore(nextStats, f.awayId, res.away.players);
      }

      const nextMatchday = currentMatchday + 1;
      const cloned = { ...league };
      setLeague(cloned);
      setCurrentMatchday(nextMatchday);
      setSeasonStats(nextStats);

      // Auto-generate playoff bracket when regular season ends.
      let nextPlayoff = playoff;
      if (nextMatchday > TOTAL_MATCHDAYS && playoff.phase === "none") {
        const bracket = generatePlayoff(cloned);
        nextPlayoff = { bracket, phase: "semis", currentGame: 0 };
        setPlayoff(nextPlayoff);
      }

      persist({ currentMatchday: nextMatchday, league: cloned, seasonStats: nextStats, playoff: nextPlayoff });
    },
    [league, userTeamId, tactics, currentMatchday, seasonStats, playoff, persist],
  );

  const completePlayoffGame = useCallback(
    (homeScore: number, awayScore: number) => {
      if (!userTeamId || !playoff.bracket) return;
      const { currentGame } = playoff;

      // Deep-clone the bracket so we never mutate React state in place.
      const bracket: PlayoffBracket = JSON.parse(JSON.stringify(playoff.bracket)) as PlayoffBracket;

      if (playoff.phase === "semis") {
        // Guard: currentGame must be 0 or 1 when in semis.
        if (currentGame !== 0 && currentGame !== 1) return;
        const semiIdx = currentGame;
        const semi = bracket.semis[semiIdx];
        semi.played = true;
        semi.homeScore = homeScore;
        semi.awayScore = awayScore;
        // homeScore === awayScore should not occur (engine guarantees a winner via OT),
        // but default to home team (higher seed) if it somehow does.
        semi.winnerId = homeScore >= awayScore ? semi.homeId : semi.awayId;

        let nextPlayoff: PlayoffState;
        if (semiIdx === 0) {
          // Semi 1 done, move to semi 2
          nextPlayoff = { bracket, phase: "semis", currentGame: 1 };
        } else {
          // Both semis done — wire up the final
          resolvePlayoffSemis(bracket);
          nextPlayoff = { bracket, phase: "final", currentGame: 2 };
        }
        setPlayoff(nextPlayoff);
        persist({ playoff: nextPlayoff });
      } else if (playoff.phase === "final") {
        const final = bracket.final;
        final.played = true;
        final.homeScore = homeScore;
        final.awayScore = awayScore;
        // Default to home team (higher seed) on an impossible tie.
        final.winnerId = homeScore >= awayScore ? final.homeId : final.awayId;
        const nextPlayoff: PlayoffState = { bracket, phase: "done", currentGame: 2 };
        setPlayoff(nextPlayoff);
        persist({ playoff: nextPlayoff });
      }
    },
    [userTeamId, playoff, persist],
  );

  const newSeason = useCallback(() => {
    const seed = (seedRef.current + 1013904223) >>> 0;
    seedRef.current = seed;
    const nextPasses = devPassesRef.current + 1;
    devPassesRef.current = nextPasses;
    const lg = makeLeague(seed);
    applyDevelopmentPasses(lg, nextPasses);
    const emptyStats: Record<string, AccumulatedStats> = {};
    const resetPlayoff = DEFAULT_PLAYOFF;
    setLeague(lg);
    setCurrentMatchday(1);
    setSeasonStats(emptyStats);
    setPlayoff(resetPlayoff);
    persist({ currentMatchday: 1, league: lg, developmentPasses: nextPasses, seasonStats: emptyStats, playoff: resetPlayoff });
  }, [persist]);

  // The current active playoff game (null when not in playoffs or done).
  function getPlayoffFixture(): PlayoffGame | null {
    if (!playoff.bracket) return null;
    if (playoff.phase === "semis") {
      // Bounds-guard: only return a semi if currentGame is a valid index (0 or 1).
      if (playoff.currentGame !== 0 && playoff.currentGame !== 1) return null;
      return playoff.bracket.semis[playoff.currentGame];
    }
    if (playoff.phase === "final") return playoff.bracket.final;
    return null;
  }

  return {
    ready,
    league,
    userTeamId,
    tactics,
    currentMatchday,
    seasonOver: playoff.phase === "done",
    userFixture: findUserFixture(league, currentMatchday, userTeamId),
    seasonStats,
    playoff,
    playoffFixture: getPlayoffFixture(),
    chooseTeam,
    setTactics,
    completeMatchday,
    completePlayoffGame,
    newSeason,
  };
}
