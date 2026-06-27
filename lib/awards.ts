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
  if (standings.length === 0) {
    throw new Error("computeAwards: league has no standings");
  }
  const withStats = standings.map((s) => ({
    ...s,
    name: league.configs[s.teamId]!.name,
    rawPpg: s.played > 0 ? s.pointsFor / s.played : 0,
    rawOppPpg: s.played > 0 ? s.pointsAgainst / s.played : 0,
  }));

  const champion = withStats[0]!;
  // Sort on raw (unrounded) ratios to avoid ties from rounding resolution on insertion order.
  const bestOffense = [...withStats].sort((a, b) => b.rawPpg - a.rawPpg)[0]!;
  const bestDefense = [...withStats].sort((a, b) => a.rawOppPpg - b.rawOppPpg)[0]!;
  const worstRecord = withStats[withStats.length - 1]!;

  return {
    champion: { teamId: champion.teamId, name: champion.name, wins: champion.wins, losses: champion.losses },
    bestOffense: {
      teamId: bestOffense.teamId,
      name: bestOffense.name,
      ppg: Math.round(bestOffense.rawPpg * 10) / 10,
    },
    bestDefense: {
      teamId: bestDefense.teamId,
      name: bestDefense.name,
      oppPpg: Math.round(bestDefense.rawOppPpg * 10) / 10,
    },
    worstRecord: { teamId: worstRecord.teamId, name: worstRecord.name, wins: worstRecord.wins },
  };
}
