"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_TACTICS, type Tactics } from "@/src/types";
import { Rng } from "@/src/rng";
import {
  type Fixture,
  type League,
  TOTAL_MATCHDAYS,
  fixturesForMatchday,
  makeLeague,
  recordResult,
  simulateFixture,
} from "./league";
import { developPlayers } from "./playerDev";

const SAVE_KEY = "courtside-save-v2";
const DEFAULT_SEED = 20260626;

interface SavedResult {
  matchday: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
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
}

export interface Game {
  ready: boolean;
  league: League;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  seasonOver: boolean;
  userFixture: Fixture | null;
  chooseTeam: (id: string) => void;
  setTactics: (t: Tactics) => void;
  /** Record the user's (already simulated) result, then sim the rest + advance. */
  completeMatchday: (userFixture: Fixture, homeScore: number, awayScore: number) => void;
  newSeason: () => void;
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

export function useGame(): Game {
  const [ready, setReady] = useState(false);
  const seedRef = useRef(DEFAULT_SEED);
  const devPassesRef = useRef(0);
  const [league, setLeague] = useState<League>(() => makeLeague(DEFAULT_SEED));
  const [userTeamId, setUserTeamId] = useState<string | null>(null);
  const [tactics, setTacticsState] = useState<Tactics>(DEFAULT_TACTICS);
  const [currentMatchday, setCurrentMatchday] = useState(1);

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
        }
      }
    } catch {
      /* ignore corrupt saves */
    }
    setReady(true);
  }, []);

  const persist = useCallback(
    (next: Partial<{ userTeamId: string | null; tactics: Tactics; currentMatchday: number; league: League; developmentPasses: number }>) => {
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
      };
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch {
        /* storage may be unavailable */
      }
    },
    [league, userTeamId, tactics, currentMatchday],
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
    const nextPasses = devPassesRef.current + 1;
    devPassesRef.current = nextPasses;
    const lg = makeLeague(seed);
    applyDevelopmentPasses(lg, nextPasses);
    setLeague(lg);
    setCurrentMatchday(1);
    persist({ currentMatchday: 1, league: lg, developmentPasses: nextPasses });
  }, [persist]);

  return {
    ready,
    league,
    userTeamId,
    tactics,
    currentMatchday,
    seasonOver: currentMatchday > TOTAL_MATCHDAYS,
    userFixture: findUserFixture(league, currentMatchday, userTeamId),
    chooseTeam,
    setTactics,
    completeMatchday,
    newSeason,
  };
}
