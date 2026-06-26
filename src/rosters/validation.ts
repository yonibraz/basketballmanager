/**
 * Roster registration validation — the "middleware" that scans a team's
 * game-day roster before tip-off and guarantees compliance with a league's
 * quota rules. Returns a structured report rather than throwing, so callers
 * (UI, API routes) can surface every violation at once.
 */

import type { Player, Team } from "../types.js";
import {
  type LeagueQuotaRule,
  countForeign,
  countHomegrown,
  isForeign,
} from "./quotas.js";

export type ViolationCode =
  | "ROSTER_TOO_SMALL"
  | "ROSTER_TOO_LARGE"
  | "TOO_MANY_FOREIGN"
  | "TOO_FEW_HOMEGROWN"
  | "TOO_MANY_FOREIGN_ON_COURT"
  | "DUPLICATE_PLAYER";

export interface Violation {
  code: ViolationCode;
  message: string;
  /** Machine-readable specifics for UI badges/tooltips. */
  limit?: number;
  actual?: number;
}

export interface ValidationReport {
  valid: boolean;
  leagueId: string;
  violations: Violation[];
  summary: {
    rosterSize: number;
    foreign: number;
    homegrown: number;
  };
}

/**
 * Validate a registered game-day roster against a league rule.
 *
 * @param roster        the players registered for this game (<= rosterSize)
 * @param rule          the league's quota rule
 * @param leagueCountry ISO-3 country the league's "local" status is measured against
 */
export function validateRoster(
  roster: Player[],
  rule: LeagueQuotaRule,
  leagueCountry: string,
): ValidationReport {
  const violations: Violation[] = [];

  // Duplicate guard — the same player must not be registered twice.
  const seen = new Set<string>();
  for (const p of roster) {
    if (seen.has(p.id)) {
      violations.push({
        code: "DUPLICATE_PLAYER",
        message: `Player ${p.firstName} ${p.lastName} is registered more than once.`,
      });
    }
    seen.add(p.id);
  }

  const size = roster.length;
  const foreign = countForeign(roster, leagueCountry);
  const homegrown = countHomegrown(roster);

  const minRoster = rule.minRoster ?? 5;
  if (size < minRoster) {
    violations.push({
      code: "ROSTER_TOO_SMALL",
      message: `Roster has ${size} players; at least ${minRoster} required.`,
      limit: minRoster,
      actual: size,
    });
  }
  if (size > rule.rosterSize) {
    violations.push({
      code: "ROSTER_TOO_LARGE",
      message: `Roster has ${size} players; maximum is ${rule.rosterSize}.`,
      limit: rule.rosterSize,
      actual: size,
    });
  }

  if (rule.maxForeign !== undefined && foreign > rule.maxForeign) {
    violations.push({
      code: "TOO_MANY_FOREIGN",
      message: `${foreign} foreign players registered; maximum is ${rule.maxForeign}.`,
      limit: rule.maxForeign,
      actual: foreign,
    });
  }

  if (rule.minHomegrown !== undefined && homegrown < rule.minHomegrown) {
    violations.push({
      code: "TOO_FEW_HOMEGROWN",
      message: `${homegrown} homegrown players registered; at least ${rule.minHomegrown} required.`,
      limit: rule.minHomegrown,
      actual: homegrown,
    });
  }

  return {
    valid: violations.length === 0,
    leagueId: rule.id,
    violations,
    summary: { rosterSize: size, foreign, homegrown },
  };
}

/**
 * Validate the five players a team intends to put on the court against a
 * league's simultaneous-foreign-players cap (where one exists).
 */
export function validateOnCourt(
  onCourt: Player[],
  rule: LeagueQuotaRule,
  leagueCountry: string,
): ValidationReport {
  const violations: Violation[] = [];
  const foreign = countForeign(onCourt, leagueCountry);

  if (rule.maxForeignOnCourt !== undefined && foreign > rule.maxForeignOnCourt) {
    violations.push({
      code: "TOO_MANY_FOREIGN_ON_COURT",
      message: `${foreign} foreign players on court; maximum is ${rule.maxForeignOnCourt}.`,
      limit: rule.maxForeignOnCourt,
      actual: foreign,
    });
  }

  return {
    valid: violations.length === 0,
    leagueId: rule.id,
    violations,
    summary: {
      rosterSize: onCourt.length,
      foreign,
      homegrown: countHomegrown(onCourt),
    },
  };
}

/**
 * Convenience: validate a whole {@link Team}'s player list against a rule,
 * using the team's own country as the league country. Suitable as an
 * Express/Next.js middleware guard before persisting a lineup.
 */
export function validateTeamRoster(team: Team, rule: LeagueQuotaRule): ValidationReport {
  return validateRoster(team.players, rule, team.country);
}

/** Re-export for ergonomic single-import usage. */
export { isForeign };
