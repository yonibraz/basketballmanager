import { describe, expect, it } from "vitest";
import { MatchEngine } from "../src/engine/MatchEngine.js";
import { makeSampleTeam } from "../src/data/sampleTeams.js";
import type { Team } from "../src/types.js";

function teams(strengthA = 12, strengthB = 12): { home: Team; away: Team } {
  const home = makeSampleTeam({ id: "HOM", name: "Home BC", country: "ESP", seed: 11, strength: strengthA });
  const away = makeSampleTeam({ id: "AWY", name: "Away BC", country: "ISR", seed: 22, strength: strengthB });
  return { home, away };
}

/** Drive a live engine to completion with no manager input. */
function playOut(engine: MatchEngine): void {
  engine.startLive("home");
  let guard = 0;
  while (!engine.getLiveState().done && guard++ < 200000) engine.step();
}

describe("MatchEngine live driver", () => {
  it("an unmanaged live game finishes with a valid, non-tie result", () => {
    const { home, away } = teams();
    const engine = new MatchEngine({ home, away, seed: 4242, live: true });
    playOut(engine);

    const r = engine.getResult();
    expect(r.home.points).not.toBe(r.away.points);
    expect(r.periods).toBeGreaterThanOrEqual(4);
    expect(r.events[0]!.type).toBe("tip-off");
    expect(r.events.at(-1)!.type).toBe("final");
    // Team points equal the sum of player points.
    for (const box of [r.home, r.away]) {
      expect(box.players.reduce((s, p) => s + p.points, 0)).toBe(box.points);
    }
  });

  it("step() before startLive() is a no-op", () => {
    const { home, away } = teams();
    const engine = new MatchEngine({ home, away, seed: 7, live: true });
    const out = engine.step();
    expect(out.events).toHaveLength(0);
    expect(engine.getLiveState().homeScore).toBe(0);
  });

  it("timeouts decrement, floor at zero, and emit a timeout event", () => {
    const { home, away } = teams();
    const engine = new MatchEngine({ home, away, seed: 99, live: true });
    engine.startLive("home");
    expect(engine.timeoutsRemaining("home")).toBe(5);

    let granted = 0;
    for (let i = 0; i < 8; i++) if (engine.requestTimeout("home")) granted++;
    expect(granted).toBe(5);
    expect(engine.timeoutsRemaining("home")).toBe(0);
    expect(engine.getResult().events.some((e) => e.type === "timeout")).toBe(true);
  });

  it("substitute swaps a bench player onto the floor; invalid subs are no-ops", () => {
    const { home, away } = teams();
    const engine = new MatchEngine({ home, away, seed: 5, live: true });
    engine.startLive("home");

    const squad = engine.getSquad("home");
    const onCourt = squad.find((p) => p.onCourt)!;
    const bench = squad.find((p) => !p.onCourt)!;

    expect(engine.substitute("home", onCourt.id, bench.id)).toBe(true);
    const after = engine.getSquad("home");
    expect(after.find((p) => p.id === bench.id)!.onCourt).toBe(true);
    expect(after.find((p) => p.id === onCourt.id)!.onCourt).toBe(false);

    // Out player no longer on court -> invalid; unknown ids -> invalid.
    expect(engine.substitute("home", onCourt.id, bench.id)).toBe(false);
    expect(engine.substitute("home", "nope", "nada")).toBe(false);
  });

  it("a defensive assignment suppresses the targeted scorer's output", () => {
    // Compare the same matchup with and without locking up the away team's
    // top scorer. Averaged over many games the target should score less.
    const N = 24;
    let withAssign = 0;
    let without = 0;
    let targetId = "";

    for (let i = 0; i < N; i++) {
      const { home, away } = teams(12, 14);
      // Identify the away team's primary scorer from a control run.
      const control = new MatchEngine({ home, away, seed: 6000 + i, live: true });
      playOut(control);
      const star = [...control.getResult().away.players].sort((a, b) => b.points - a.points)[0]!;
      targetId = star.playerId;
      without += star.points;

      const guarded = new MatchEngine({ home, away, seed: 6000 + i, live: true });
      guarded.startLive("home");
      const defender = guarded.getSquad("home").find((p) => p.onCourt)!;
      guarded.setDefensiveTarget("home", star.playerId, defender.id);
      let guard = 0;
      while (!guarded.getLiveState().done && guard++ < 200000) guarded.step();
      const sameStar = guarded.getResult().away.players.find((p) => p.playerId === star.playerId)!;
      withAssign += sameStar.points;
    }

    expect(targetId).not.toBe("");
    expect(withAssign).toBeLessThan(without);
  });
});
