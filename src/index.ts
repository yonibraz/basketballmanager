/**
 * Public API barrel for the international basketball manager core.
 *
 * The core is intentionally framework-agnostic: import these from a Next.js
 * route, an Expo app, a worker, or a CLI. Nothing here touches a database or
 * the network.
 */

export * from "./types.js";
export { Rng, clamp01, seedFromString } from "./rng.js";
export {
  MatchEngine,
  lineupFromPlayers,
} from "./engine/MatchEngine.js";
export type {
  LiveSide,
  LiveState,
  Stoppage,
  SquadPlayer,
} from "./engine/MatchEngine.js";
export * from "./engine/probability.js";
export * from "./rosters/quotas.js";
export * from "./rosters/validation.js";
export { makeSampleTeam } from "./data/sampleTeams.js";
export type { SampleTeamOptions } from "./data/sampleTeams.js";
