"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TACTICS, type MatchResult, type PlayerBoxScore, type Tactics } from "@/src/types";
import {
  type Fixture,
  type League,
  TOTAL_MATCHDAYS,
  fixturesForMatchday,
  makeLeague,
  recordResult,
  simulateFixture,
} from "./league";

const SAVE_KEY = "courtside-save-v1";
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

interface SaveData {
  v: 1;
  seasonSeed: number;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  results: SavedResult[];
  seasonStats?: Record<string, AccumulatedStats>;
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
  chooseTeam: (id: string) => void;
  setTactics: (t: Tactics) => void;
  /** Record the user's (already simulated) result, then sim the rest + advance. */
  completeMatchday: (userFixture: Fixture, homeScore: number, awayScore: number, userResult: MatchResult) => void;
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

function rebuild(save: SaveData): League {
  const league = makeLeague(save.seasonSeed);
  for (const r of save.results) {
    const f = league.schedule.find(
      (x) => x.matchday === r.matchday && x.homeId === r.homeId && x.awayId === r.awayId,
    );
    if (f) recordResult(league, f, r.homeScore, r.awayScore);
  }
  return league;
}

export function useGame(): Game {
  const [ready, setReady] = useState(false);
  const seedRef = useRef(DEFAULT_SEED);
  const [league, setLeague] = useState<League>(() => makeLeague(DEFAULT_SEED));
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [tactics, setTacticsState] = useState<Tactics>(DEFAULT_TACTICS);
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [seasonStats, setSeasonStats] = useState<Record<string, AccumulatedStats>>({});

  // Load any saved game on mount (client only).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const save = JSON.parse(raw) as SaveData;
        if (save?.v === 1) {
          seedRef.current = save.seasonSeed;
          setLeague(rebuild(save));
          setUserTeamId(save.userTeamId);
          setTacticsState(save.tactics ?? DEFAULT_TACTICS);
          setCurrentMatchday(save.currentMatchday ?? 1);
          setSeasonStats(save.seasonStats ?? {});
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
      seasonStats: Record<string, AccumulatedStats>;
    }>) => {
      const lg = next.league ?? league;
      const save: SaveData = {
        v: 1,
        seasonSeed: seedRef.current,
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
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        /* storage may be unavailable */
      }
    },
    [league, userTeamId, tactics, currentMatchday, seasonStats],
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
      persist({ currentMatchday: nextMatchday, league: cloned, seasonStats: nextStats });
    },
    [league, userTeamId, tactics, currentMatchday, seasonStats, persist],
  );

  const newSeason = useCallback(() => {
    const seed = (seedRef.current + 1013904223) >>> 0;
    seedRef.current = seed;
    const lg = makeLeague(seed);
    const emptyStats: Record<string, AccumulatedStats> = {};
    setLeague(lg);
    setCurrentMatchday(1);
    setSeasonStats(emptyStats);
    persist({ currentMatchday: 1, league: lg, seasonStats: emptyStats });
  }, [persist]);

  return {
    ready,
    league,
    userTeamId,
    tactics,
    currentMatchday,
    seasonOver: currentMatchday > TOTAL_MATCHDAYS,
    userFixture: findUserFixture(league, currentMatchday, userTeamId),
    seasonStats,
    chooseTeam,
    setTactics,
    completeMatchday,
    newSeason,
  };
}
