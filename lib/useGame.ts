"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TACTICS, type Player, type Tactics } from "@/src/types";
import {
  type Fixture,
  type League,
  TOTAL_MATCHDAYS,
  fixturesForMatchday,
  makeLeague,
  recordResult,
  simulateFixture,
} from "./league";
import { type FreeAgent, generateFreeAgents } from "./market";

const SAVE_KEY = "courtside-save-v1";
const DEFAULT_SEED = 20260626;
const DEFAULT_BUDGET = 50;

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
  budget?: number;
  freeAgents?: FreeAgent[];
  /** Persisted user-team roster (captures signed/released changes). */
  userTeamPlayers?: Player[];
}

export interface Game {
  ready: boolean;
  league: League;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  seasonOver: boolean;
  userFixture: Fixture | null;
  budget: number;
  freeAgents: FreeAgent[];
  chooseTeam: (id: string) => void;
  setTactics: (t: Tactics) => void;
  /** Record the user's (already simulated) result, then sim the rest + advance. */
  completeMatchday: (userFixture: Fixture, homeScore: number, awayScore: number) => void;
  newSeason: () => void;
  /** Sign a free agent. Returns an error string on failure, null on success. */
  signPlayer: (fa: FreeAgent) => string | null;
  /** Release a player from the user's team (adds £3M waiver comp to budget). */
  releasePlayer: (playerId: string) => void;
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
  // Restore any roster changes (signed/released players) made by the user.
  if (save.userTeamId && save.userTeamPlayers) {
    const idx = league.teams.findIndex((t) => t.id === save.userTeamId);
    if (idx !== -1) {
      league.teams = league.teams.map((t, i) =>
        i === idx ? { ...t, players: save.userTeamPlayers! } : t,
      );
    }
  }
  return league;
}

/** Replace a team in league.teams immutably, returning a new league object. */
function replaceTeamInLeague(league: League, updatedTeam: import("@/src/types").Team): League {
  return {
    ...league,
    teams: league.teams.map((t) => (t.id === updatedTeam.id ? updatedTeam : t)),
  };
}

export function useGame(): Game {
  const [ready, setReady] = useState(false);
  const seedRef = useRef(DEFAULT_SEED);
  const [league, setLeague] = useState<League>(() => makeLeague(DEFAULT_SEED));
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [tactics, setTacticsState] = useState<Tactics>(DEFAULT_TACTICS);
  const [currentMatchday, setCurrentMatchday] = useState(1);
  const [budget, setBudget] = useState<number>(DEFAULT_BUDGET);
  const [freeAgents, setFreeAgents] = useState<FreeAgent[]>(() => generateFreeAgents(DEFAULT_SEED));

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
          setBudget(save.budget ?? DEFAULT_BUDGET);
          setFreeAgents(save.freeAgents ?? generateFreeAgents(save.seasonSeed));
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
      budget: number;
      freeAgents: FreeAgent[];
    }>) => {
      const lg = next.league ?? league;
      const resolvedTeamId = next.userTeamId !== undefined ? next.userTeamId : userTeamId;
      // Persist the user team's current roster so signed/released players survive reload.
      const userTeamPlayers = resolvedTeamId
        ? lg.teams.find((t) => t.id === resolvedTeamId)?.players
        : undefined;
      const save: SaveData = {
        v: 1,
        seasonSeed: seedRef.current,
        userTeamId: resolvedTeamId,
        tactics: next.tactics ?? tactics,
        currentMatchday: next.currentMatchday ?? currentMatchday,
        budget: next.budget !== undefined ? next.budget : budget,
        freeAgents: next.freeAgents !== undefined ? next.freeAgents : freeAgents,
        userTeamPlayers,
        results: lg.schedule
          .filter((f) => f.played)
          .map((f) => ({
            matchday: f.matchday,
            homeId: f.homeId,
            awayId: f.awayId,
            homeScore: f.homeScore ?? 0,
            awayScore: f.awayScore ?? 0,
          })),
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        /* storage may be unavailable */
      }
    },
    [league, userTeamId, tactics, currentMatchday, budget, freeAgents],
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
    (userFixture: Fixture, homeScore: number, awayScore: number) => {
      if (!userTeamId) return;
      // Record the user's match (already simulated by the viewer).
      recordResult(league, userFixture, homeScore, awayScore);
      // Simulate every other fixture on this matchday instantly.
      for (const f of fixturesForMatchday(league, currentMatchday)) {
        if (f.played) continue;
        const res = simulateFixture(league, f, userTeamId, tactics);
        recordResult(league, f, res.home.points, res.away.points);
      }
      const nextMatchday = currentMatchday + 1;
      const cloned = { ...league };
      setLeague(cloned);
      setCurrentMatchday(nextMatchday);
      persist({ currentMatchday: nextMatchday, league: cloned });
    },
    [league, userTeamId, tactics, currentMatchday, persist],
  );

  const newSeason = useCallback(() => {
    const seed = (seedRef.current + 1013904223) >>> 0;
    seedRef.current = seed;
    const lg = makeLeague(seed);
    const freshAgents = generateFreeAgents(seed);
    setLeague(lg);
    setCurrentMatchday(1);
    setBudget(DEFAULT_BUDGET);
    setFreeAgents(freshAgents);
    persist({ currentMatchday: 1, league: lg, budget: DEFAULT_BUDGET, freeAgents: freshAgents });
  }, [persist]);

  const signPlayer = useCallback(
    (fa: FreeAgent): string | null => {
      if (!userTeamId) return "No team selected";
      const currentTeam = league.teams.find((t) => t.id === userTeamId);
      if (!currentTeam) return "Team not found";

      if (budget < fa.askingPrice) {
        return `Insufficient budget (need £${fa.askingPrice}M)`;
      }
      if (currentTeam.players.length >= 12) {
        return "Roster full — release a player first";
      }

      const newBudget = budget - fa.askingPrice;
      // Remove the fa's askingPrice extra field when adding to the squad
      const { askingPrice: _price, ...playerOnly } = fa;
      const updatedTeam = {
        ...currentTeam,
        players: [...currentTeam.players, playerOnly],
      };
      const updatedLeague = replaceTeamInLeague(league, updatedTeam);
      const updatedAgents = freeAgents.filter((a) => a.id !== fa.id);

      setLeague(updatedLeague);
      setBudget(newBudget);
      setFreeAgents(updatedAgents);
      persist({ league: updatedLeague, budget: newBudget, freeAgents: updatedAgents });
      return null;
    },
    [league, userTeamId, budget, freeAgents, persist],
  );

  const releasePlayer = useCallback(
    (playerId: string) => {
      if (!userTeamId) return;
      const currentTeam = league.teams.find((t) => t.id === userTeamId);
      if (!currentTeam) return;
      // The match engine requires at least 5 players to start a game.
      if (currentTeam.players.length <= 5) return;

      const updatedTeam = {
        ...currentTeam,
        players: currentTeam.players.filter((p) => p.id !== playerId),
      };
      const newBudget = budget + 3; // £3M waiver compensation
      const updatedLeague = replaceTeamInLeague(league, updatedTeam);

      setLeague(updatedLeague);
      setBudget(newBudget);
      persist({ league: updatedLeague, budget: newBudget });
    },
    [league, userTeamId, budget, persist],
  );

  return {
    ready,
    league,
    userTeamId,
    tactics,
    currentMatchday,
    seasonOver: currentMatchday > TOTAL_MATCHDAYS,
    userFixture: findUserFixture(league, currentMatchday, userTeamId),
    budget,
    freeAgents,
    chooseTeam,
    setTactics,
    completeMatchday,
    newSeason,
    signPlayer,
    releasePlayer,
  };
}
