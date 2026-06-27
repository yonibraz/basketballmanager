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
  teamById,
} from "./league";
import { rollInjuries, recoverPlayers } from "@/src/engine/injuries";
import { Rng } from "@/src/rng";

const SAVE_KEY = "courtside-save-v1";
const DEFAULT_SEED = 20260626;

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
  /** Persisted injury state for the user's squad. */
  playerInjuries?: Record<string, number>;
}

export interface Game {
  ready: boolean;
  league: League;
  userTeamId: string | null;
  tactics: Tactics;
  currentMatchday: number;
  seasonOver: boolean;
  userFixture: Fixture | null;
  /** Players currently out with injury. */
  injuredPlayers: Player[];
  chooseTeam: (id: string) => void;
  setTactics: (t: Tactics) => void;
  /** Record the user's (already simulated) result, then sim the rest + advance. */
  completeMatchday: (
    userFixture: Fixture,
    homeScore: number,
    awayScore: number,
    userSecondsPlayed: Record<string, number>,
  ) => void;
  newSeason: () => void;
}

function findUserFixture(league: League, matchday: number, userTeamId: string | null): Fixture | null {
  if (!userTeamId || matchday > TOTAL_MATCHDAYS) return null;
  return (
    fixturesForMatchday(league, matchday).find((f) => f.homeId === userTeamId || f.awayId === userTeamId) ?? null
  );
}

/** Apply a persisted injury map back onto a league's team players. */
function applyInjuryMap(league: League, userTeamId: string, injuryMap: Record<string, number>): League {
  const teams = league.teams.map((t) => {
    if (t.id !== userTeamId) return t;
    const players = t.players.map((p) => {
      const weeks = injuryMap[p.id];
      if (weeks !== undefined && weeks > 0) return { ...p, injuryWeeksLeft: weeks };
      // Clear any previously set injury if not in the map.
      if (p.injuryWeeksLeft) return { ...p, injuryWeeksLeft: 0 };
      return p;
    });
    return { ...t, players };
  });
  return { ...league, teams };
}

function rebuild(save: SaveData): League {
  const league = makeLeague(save.seasonSeed);
  for (const r of save.results) {
    const f = league.schedule.find(
      (x) => x.matchday === r.matchday && x.homeId === r.homeId && x.awayId === r.awayId,
    );
    if (f) recordResult(league, f, r.homeScore, r.awayScore);
  }
  // Re-apply persisted injuries.
  if (save.userTeamId && save.playerInjuries) {
    return applyInjuryMap(league, save.userTeamId, save.playerInjuries);
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
        }
      }
    } catch {
      /* ignore corrupt saves */
    }
    setReady(true);
  }, []);

  const persist = useCallback(
    (next: Partial<{ userTeamId: string | null; tactics: Tactics; currentMatchday: number; league: League }>) => {
      const lg = next.league ?? league;
      const uid = next.userTeamId !== undefined ? next.userTeamId : userTeamId;
      // Build a map of player injury state for the user's team.
      let playerInjuries: Record<string, number> | undefined;
      if (uid) {
        try {
          const userTeam = teamById(lg, uid);
          playerInjuries = {};
          for (const p of userTeam.players) {
            if (p.injuryWeeksLeft && p.injuryWeeksLeft > 0) {
              playerInjuries[p.id] = p.injuryWeeksLeft;
            }
          }
        } catch {
          /* team may not exist yet */
        }
      }
      const save: SaveData = {
        v: 1,
        seasonSeed: seedRef.current,
        userTeamId: uid,
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
        playerInjuries,
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
    (userFixture: Fixture, homeScore: number, awayScore: number, userSecondsPlayed: Record<string, number>) => {
      if (!userTeamId) return;
      // Record the user's match (already simulated by the viewer).
      recordResult(league, userFixture, homeScore, awayScore);
      // Simulate every other fixture on this matchday instantly.
      for (const f of fixturesForMatchday(league, currentMatchday)) {
        if (f.played) continue;
        const res = simulateFixture(league, f, userTeamId, tactics);
        recordResult(league, f, res.home.points, res.away.points);
      }

      // --- Injury rolling: deterministic per matchday + season seed ---
      const injuryRng = new Rng((currentMatchday * 0xbeef + league.seasonSeed) >>> 0);
      const userTeamIndex = league.teams.findIndex((t) => t.id === userTeamId);
      let updatedTeams = [...league.teams];

      if (userTeamIndex !== -1) {
        const userTeam = updatedTeams[userTeamIndex]!;
        // Step 1: Recover existing injuries by 1 matchday (the new matchday has begun).
        // This must run BEFORE rollInjuries so that a newly-set 1-week injury is NOT
        // immediately decremented — the player must sit out the full next matchday.
        const recoveredPlayers = recoverPlayers(userTeam.players);
        // Step 2: Roll new injuries from this matchday's game on the recovered roster.
        // Only roll against healthy players (injuryWeeksLeft = 0/undefined after recovery).
        const playersAfterInjuryRoll = rollInjuries(recoveredPlayers, userSecondsPlayed, injuryRng);
        updatedTeams = updatedTeams.map((t, i) =>
          i === userTeamIndex ? { ...t, players: playersAfterInjuryRoll } : t,
        );
      }

      const nextMatchday = currentMatchday + 1;
      const cloned: League = { ...league, teams: updatedTeams };
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
    setLeague(lg);
    setCurrentMatchday(1);
    persist({ currentMatchday: 1, league: lg });
  }, [persist]);

  // Compute injuredPlayers convenience list.
  let injuredPlayers: Player[] = [];
  if (userTeamId) {
    try {
      const userTeam = teamById(league, userTeamId);
      injuredPlayers = userTeam.players.filter((p) => (p.injuryWeeksLeft ?? 0) > 0);
    } catch {
      /* team may not be found */
    }
  }

  return {
    ready,
    league,
    userTeamId,
    tactics,
    currentMatchday,
    seasonOver: currentMatchday > TOTAL_MATCHDAYS,
    userFixture: findUserFixture(league, currentMatchday, userTeamId),
    injuredPlayers,
    chooseTeam,
    setTactics,
    completeMatchday,
    newSeason,
  };
}
