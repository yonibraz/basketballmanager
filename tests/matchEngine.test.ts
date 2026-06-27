import { describe, expect, it } from "vitest";
import { MatchEngine } from "../src/engine/MatchEngine.js";
import { makeSampleTeam } from "../src/data/sampleTeams.js";
import type { MatchResult, TeamBoxScore } from "../src/types.js";

function teams(strengthA = 12, strengthB = 12) {
  const home = makeSampleTeam({ id: "HOM", name: "Home BC", country: "ESP", seed: 11, strength: strengthA });
  const away = makeSampleTeam({ id: "AWY", name: "Away BC", country: "ISR", seed: 22, strength: strengthB });
  return { home, away };
}

/** Sum of every player's points must equal the team total. */
function pointsAddUp(box: TeamBoxScore): boolean {
  return box.players.reduce((s, p) => s + p.points, 0) === box.points;
}

describe("MatchEngine determinism", () => {
  it("produces identical results for the same seed and inputs", () => {
    const { home, away } = teams();
    const a = MatchEngine.simulate({ home, away, seed: 777 });
    const b = MatchEngine.simulate({ home, away, seed: 777 });
    expect(a.home.points).toBe(b.home.points);
    expect(a.away.points).toBe(b.away.points);
    expect(a.events.length).toBe(b.events.length);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different results for different seeds", () => {
    const { home, away } = teams();
    const a = MatchEngine.simulate({ home, away, seed: 1 });
    const b = MatchEngine.simulate({ home, away, seed: 2 });
    expect(a.home.points + a.away.points).not.toBe(b.home.points + b.away.points);
  });
});

describe("MatchEngine box-score integrity", () => {
  const results: MatchResult[] = Array.from({ length: 30 }, (_, i) => {
    const { home, away } = teams();
    return MatchEngine.simulate({ home, away, seed: 1000 + i });
  });

  it("never ends regulation/OT in a tie", () => {
    for (const r of results) expect(r.home.points).not.toBe(r.away.points);
  });

  it("keeps team points equal to the sum of player points", () => {
    for (const r of results) {
      expect(pointsAddUp(r.home)).toBe(true);
      expect(pointsAddUp(r.away)).toBe(true);
    }
  });

  it("produces believable FIBA score lines (typically 55-115)", () => {
    const avg =
      results.reduce((s, r) => s + r.home.points + r.away.points, 0) / (results.length * 2);
    expect(avg).toBeGreaterThan(55);
    expect(avg).toBeLessThan(115);
  });

  it("keeps made <= attempted for FG, 3PT and FT", () => {
    for (const r of results) {
      for (const box of [r.home, r.away]) {
        for (const p of box.players) {
          expect(p.fieldGoalsMade).toBeLessThanOrEqual(p.fieldGoalsAttempted);
          expect(p.threePointersMade).toBeLessThanOrEqual(p.threePointersAttempted);
          expect(p.freeThrowsMade).toBeLessThanOrEqual(p.freeThrowsAttempted);
          expect(p.points).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it("plays at least the four regulation periods", () => {
    for (const r of results) expect(r.periods).toBeGreaterThanOrEqual(4);
  });

  it("emits tip-off and final events", () => {
    const r = results[0]!;
    expect(r.events[0]!.type).toBe("tip-off");
    expect(r.events.at(-1)!.type).toBe("final");
  });
});

describe("MatchEngine responds to team strength", () => {
  it("the much stronger team wins the large majority of games", () => {
    let strongWins = 0;
    const n = 50;
    for (let i = 0; i < n; i++) {
      const home = makeSampleTeam({ id: "STR", name: "Strong", country: "ESP", seed: 5, strength: 16 });
      const away = makeSampleTeam({ id: "WEK", name: "Weak", country: "ISR", seed: 9, strength: 8 });
      const r = MatchEngine.simulate({ home, away, seed: 3000 + i });
      if (r.home.points > r.away.points) strongWins++;
    }
    expect(strongWins).toBeGreaterThan(n * 0.75);
  });
});

describe("MatchEngine event-stream toggle", () => {
  it("omits events when recordEvents is false", () => {
    const { home, away } = teams();
    const r = MatchEngine.simulate({ home, away, seed: 5, recordEvents: false });
    expect(r.events.length).toBe(0);
    expect(r.home.points).toBeGreaterThan(0);
  });
});

describe("MatchEngine robustness to degenerate inputs", () => {
  it("does not throw when players have all-zero shooting/strength attributes", () => {
    // Caller-supplied teams may come from nullable DB columns; zeroed shooting
    // and strength must not make pickZone's weights sum to zero (regression).
    const { home, away } = teams();
    for (const p of home.players) {
      p.attributes.shootingInside = 0;
      p.attributes.shootingOutside = 0;
      p.attributes.strength = 0;
    }
    expect(() => MatchEngine.simulate({ home, away, seed: 42 })).not.toThrow();
  });
});
