import { describe, expect, it } from "vitest";
import type { Player } from "../src/types.js";
import { LEAGUE_QUOTAS, countForeign, isForeign } from "../src/rosters/quotas.js";
import { validateOnCourt, validateRoster } from "../src/rosters/validation.js";

function player(over: Partial<Player> & Pick<Player, "id" | "nationality">): Player {
  return {
    firstName: "Test",
    lastName: over.id,
    age: 25,
    position: "SF",
    attributes: {
      shootingInside: 10, shootingOutside: 10, playmaking: 10,
      defPerimeter: 10, defInterior: 10, rebounding: 10,
      pace: 10, strength: 10, stamina: 10,
      bballIq: 10, leadership: 10, clutch: 10,
    },
    ...over,
  };
}

/** Build a roster: `foreign` foreigners + `local` locals (some homegrown). */
function roster(country: string, foreign: number, local: number, homegrown: number): Player[] {
  const out: Player[] = [];
  for (let i = 0; i < foreign; i++) out.push(player({ id: `f${i}`, nationality: "USA" }));
  for (let i = 0; i < local; i++) {
    out.push(player({ id: `l${i}`, nationality: country, homegrown: i < homegrown }));
  }
  return out;
}

describe("isForeign / countForeign", () => {
  it("treats a matching nationality as local", () => {
    expect(isForeign(player({ id: "x", nationality: "ESP" }), "ESP")).toBe(false);
  });

  it("treats dual nationals as local if either passport matches", () => {
    const dual = player({ id: "d", nationality: "USA", secondNationality: "ESP" });
    expect(isForeign(dual, "ESP")).toBe(false);
    expect(isForeign(dual, "FRA")).toBe(true);
  });

  it("counts foreigners correctly", () => {
    expect(countForeign(roster("ESP", 3, 9, 4), "ESP")).toBe(3);
  });
});

describe("ACB homegrown rule", () => {
  const rule = LEAGUE_QUOTAS.ESP_ACB!;

  it("passes with >= 4 homegrown on a legal 12-man roster", () => {
    const report = validateRoster(roster("ESP", 4, 8, 4), rule, "ESP");
    expect(report.valid).toBe(true);
    expect(report.summary.homegrown).toBe(4);
  });

  it("flags too few homegrown", () => {
    const report = validateRoster(roster("ESP", 6, 6, 3), rule, "ESP");
    expect(report.valid).toBe(false);
    expect(report.violations.map((v) => v.code)).toContain("TOO_FEW_HOMEGROWN");
  });
});

describe("Israeli foreign-player cap", () => {
  const rule = LEAGUE_QUOTAS.ISR_BSL!;

  it("passes with <= 5 foreign players", () => {
    expect(validateRoster(roster("ISR", 5, 7, 0), rule, "ISR").valid).toBe(true);
  });

  it("flags more than 5 foreign players", () => {
    const report = validateRoster(roster("ISR", 6, 6, 0), rule, "ISR");
    expect(report.valid).toBe(false);
    const v = report.violations.find((x) => x.code === "TOO_MANY_FOREIGN");
    expect(v?.limit).toBe(5);
    expect(v?.actual).toBe(6);
  });
});

describe("roster size + duplicates", () => {
  const rule = LEAGUE_QUOTAS.GEN_DOMESTIC!;

  it("flags an oversized roster", () => {
    const report = validateRoster(roster("FRA", 6, 8, 2), rule, "FRA"); // 14 players
    expect(report.violations.map((v) => v.code)).toContain("ROSTER_TOO_LARGE");
  });

  it("flags an undersized roster", () => {
    const report = validateRoster(roster("FRA", 2, 3, 2), rule, "FRA"); // 5 players
    expect(report.violations.map((v) => v.code)).toContain("ROSTER_TOO_SMALL");
  });

  it("flags duplicate registrations", () => {
    const dup = player({ id: "same", nationality: "FRA" });
    const report = validateRoster([dup, dup], rule, "FRA");
    expect(report.violations.map((v) => v.code)).toContain("DUPLICATE_PLAYER");
  });
});

describe("on-court foreign cap", () => {
  it("flags too many foreigners on the floor", () => {
    const rule = { ...LEAGUE_QUOTAS.GEN_DOMESTIC!, maxForeignOnCourt: 3 };
    const onCourt = roster("FRA", 4, 1, 0); // 4 foreign on court
    const report = validateOnCourt(onCourt, rule, "FRA");
    expect(report.valid).toBe(false);
    expect(report.violations[0]!.code).toBe("TOO_MANY_FOREIGN_ON_COURT");
  });
});
