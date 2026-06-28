import { makeSampleTeam } from "@/src/data/sampleTeams";
import { Rng, seedFromString } from "@/src/rng";
import type { Player } from "@/src/types";
import { overall } from "@/lib/ratings";

export interface FreeAgent extends Player {
  askingPrice: number; // in millions (e.g. 5 = £5M)
}

/** Generate a pool of ~21 free agents from a deterministic seed. */
export function generateFreeAgents(seasonSeed: number): FreeAgent[] {
  const rng = new Rng(seedFromString(`market:${seasonSeed}`));
  const pool: FreeAgent[] = [];
  const strengths = [10, 11, 12, 13, 14, 15, 16];
  const countries = ["USA", "FRA", "ESP", "GER", "SRB", "GRE", "TUR", "AUS"];
  let id = 0;
  for (const str of strengths) {
    const team = makeSampleTeam({
      id: `FA_${str}`,
      name: `Pool ${str}`,
      country: countries[rng.int(0, 7)]!,
      seed: seasonSeed + str * 1337,
      strength: str,
      foreignCount: rng.int(3, 7),
      homegrownCount: 0,
    });
    // Take only first 3 players from each strength bracket
    for (const p of team.players.slice(0, 3)) {
      const ovr = overall(p);
      const askingPrice = Math.round((ovr - 50) * 0.4 + rng.int(2, 8));
      pool.push({ ...p, id: `fa_${id++}_${p.id}`, askingPrice: Math.max(1, askingPrice) });
    }
  }
  return pool;
}
