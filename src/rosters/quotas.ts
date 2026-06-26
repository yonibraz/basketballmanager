/**
 * League roster-quota rules ("the foreigner rules").
 *
 * Unlike the NBA's single salary cap, European/international leagues each
 * impose their own registration constraints on a 12-man game-day roster:
 * caps on foreign players, minimums on locally-trained ("homegrown") players,
 * and sometimes caps on the active-on-court count. These rules are expressed
 * declaratively here so new leagues are data, not code.
 */

import type { Player, Team } from "../types.js";

export interface LeagueQuotaRule {
  /** Stable identifier, e.g. "ESP_ACB". */
  id: string;
  /** Human-readable league name. */
  name: string;
  /** Maximum players that may dress for a game (FIBA default is 12). */
  rosterSize: number;
  /**
   * Maximum number of *foreign* players allowed on the registered game-day
   * roster. A player is foreign when none of their nationalities matches the
   * league's home country (see {@link isForeign}). Omit for no cap.
   */
  maxForeign?: number;
  /**
   * Minimum number of homegrown / locally-trained players that must be on the
   * registered roster. Omit for no minimum.
   */
  minHomegrown?: number;
  /**
   * Optional cap on foreign players who may be *on the court at once*. Some
   * leagues (e.g. certain Asian/African competitions) limit simultaneous
   * foreign players rather than total registration.
   */
  maxForeignOnCourt?: number;
  /** Minimum players required to field a team. */
  minRoster?: number;
}

/**
 * A small but representative catalogue of real-world rule shapes. The numbers
 * are modelled on publicly described league regulations and are intended as
 * sensible defaults that a manager-mode designer can tune.
 */
export const LEAGUE_QUOTAS: Record<string, LeagueQuotaRule> = {
  // Spain — Liga ACB: homegrown minimum on a 12-man roster.
  ESP_ACB: {
    id: "ESP_ACB",
    name: "Liga Endesa (ACB)",
    rosterSize: 12,
    minHomegrown: 4,
    minRoster: 8,
  },
  // Israel — Ligat HaAl: cap on foreign players registered per match.
  ISR_BSL: {
    id: "ISR_BSL",
    name: "Israeli Basketball Premier League",
    rosterSize: 12,
    maxForeign: 5,
    minRoster: 8,
  },
  // EuroLeague — continental, broadly open registration (no nationality cap).
  EUR_EUROLEAGUE: {
    id: "EUR_EUROLEAGUE",
    name: "EuroLeague",
    rosterSize: 13,
    minRoster: 8,
  },
  // A generic FIBA-style domestic league with a moderate foreigner cap.
  GEN_DOMESTIC: {
    id: "GEN_DOMESTIC",
    name: "Generic Domestic League",
    rosterSize: 12,
    maxForeign: 6,
    minHomegrown: 2,
    minRoster: 8,
  },
};

/**
 * Determines whether a player is "foreign" relative to a league's home
 * country. Dual nationals count as local if *either* nationality matches, in
 * line with how most federations treat passports for quota purposes.
 */
export function isForeign(player: Player, leagueCountry: string): boolean {
  if (player.nationality === leagueCountry) return false;
  if (player.secondNationality && player.secondNationality === leagueCountry) return false;
  return true;
}

/** Counts foreign players in a list relative to a league country. */
export function countForeign(players: Player[], leagueCountry: string): number {
  return players.reduce((n, p) => n + (isForeign(p, leagueCountry) ? 1 : 0), 0);
}

/** Counts homegrown / locally-trained players in a list. */
export function countHomegrown(players: Player[]): number {
  return players.reduce((n, p) => n + (p.homegrown ? 1 : 0), 0);
}

/** Resolves a league country to compare nationalities against. */
export function leagueCountryForTeam(team: Team): string {
  return team.country;
}
