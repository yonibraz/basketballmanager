import type { League } from "@/lib/league";
import { sortedStandings } from "@/lib/league";

export interface SeasonAwards {
  champion: { teamId: string; name: string; wins: number; losses: number };
  bestOffense: { teamId: string; name: string; ppg: number };
  bestDefense: { teamId: string; name: string; oppPpg: number };
  worstRecord: { teamId: string; name: string; wins: number };
}

export function computeAwards(league: League): SeasonAwards {
  const standings = sortedStandings(league);
  const withStats = standings.map((s) => ({
    ...s,
    name: league.configs[s.teamId]!.name,
    ppg: s.played > 0 ? Math.round((s.pointsFor / s.played) * 10) / 10 : 0,
    oppPpg: s.played > 0 ? Math.round((s.pointsAgainst / s.played) * 10) / 10 : 0,
  }));

  const champion = withStats[0]!;
  const bestOffense = [...withStats].sort((a, b) => b.ppg - a.ppg)[0]!;
  const bestDefense = [...withStats].sort((a, b) => a.oppPpg - b.oppPpg)[0]!;
  const worstRecord = withStats[withStats.length - 1]!;

  return {
    champion: { teamId: champion.teamId, name: champion.name, wins: champion.wins, losses: champion.losses },
    bestOffense: { teamId: bestOffense.teamId, name: bestOffense.name, ppg: bestOffense.ppg },
    bestDefense: { teamId: bestDefense.teamId, name: bestDefense.name, oppPpg: bestDefense.oppPpg },
    worstRecord: { teamId: worstRecord.teamId, name: worstRecord.name, wins: worstRecord.wins },
  };
}
