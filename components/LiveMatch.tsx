"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MatchEngine, type LiveSide, type LiveState } from "@/src/engine/MatchEngine";
import type { MatchEvent, MatchResult, OffensiveFocus, Tactics } from "@/src/types";
import { type Fixture, type League, aiTactics, fixtureSeed, teamById } from "@/lib/league";
import { gameClock } from "@/lib/ratings";
import { BoxTable, describe, isShown } from "./matchShared";
import { AnimatedNumber } from "@/components/AnimatedNumber";

type Phase = "pre" | "play" | "done";
type Panel = null | "tactics" | "subs" | "defense";

function fatiguePct(f: number): number {
  return Math.round(f * 100);
}

export function LiveMatch({
  league,
  fixture,
  userTeamId,
  tactics,
  onComplete,
}: {
  league: League;
  fixture: Fixture;
  userTeamId: string;
  tactics: Tactics;
  onComplete: (homeScore: number, awayScore: number, result: MatchResult) => void;
}) {
  const userSide: LiveSide = fixture.homeId === userTeamId ? "home" : "away";
  const oppSide: LiveSide = userSide === "home" ? "away" : "home";

  // One persistent engine for the life of this matchday (the parent re-keys it).
  const engineRef = useRef<MatchEngine | null>(null);
  if (engineRef.current === null) {
    const home = teamById(league, fixture.homeId);
    const away = teamById(league, fixture.awayId);
    const userIsHome = userSide === "home";
    engineRef.current = new MatchEngine({
      home,
      away,
      homeTactics: userIsHome ? tactics : aiTactics(league.configs[fixture.homeId]!.strength),
      awayTactics: userIsHome ? aiTactics(league.configs[fixture.awayId]!.strength) : tactics,
      seed: fixtureSeed(league, fixture),
      live: true,
    });
  }
  const engine = engineRef.current;

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const id of [fixture.homeId, fixture.awayId]) {
      for (const p of teamById(league, id).players) m[p.id] = p.lastName;
    }
    return m;
  }, [league, fixture.homeId, fixture.awayId]);

  const homeCfg = league.configs[fixture.homeId]!;
  const awayCfg = league.configs[fixture.awayId]!;

  const [phase, setPhase] = useState<Phase>("pre");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [feed, setFeed] = useState<MatchEvent[]>([]);
  const [live, setLive] = useState<LiveState>(() => engine.getLiveState());
  const [panel, setPanel] = useState<Panel>(null);

  // Score flash states
  const [flashHome, setFlashHome] = useState(false);
  const [flashAway, setFlashAway] = useState(false);

  // Flash home score on change — initialize from actual starting score, not 0,
  // so remounting mid-game (navigate away and back) doesn't trigger a spurious flash.
  const initialState = engine.getLiveState();
  const prevHomeRef = useRef(initialState.homeScore);
  useEffect(() => {
    if (live.homeScore !== prevHomeRef.current) {
      prevHomeRef.current = live.homeScore;
      setFlashHome(true);
      const t = setTimeout(() => setFlashHome(false), 500);
      return () => clearTimeout(t);
    }
  }, [live.homeScore]);

  // Flash away score on change
  const prevAwayRef = useRef(initialState.awayScore);
  useEffect(() => {
    if (live.awayScore !== prevAwayRef.current) {
      prevAwayRef.current = live.awayScore;
      setFlashAway(true);
      const t = setTimeout(() => setFlashAway(false), 500);
      return () => clearTimeout(t);
    }
  }, [live.awayScore]);

  // Coaching selections.
  const [liveTactics, setLiveTactics] = useState<Tactics>(tactics);
  const [subOut, setSubOut] = useState<string | null>(null);
  const [defTarget, setDefTarget] = useState<string | null>(null);

  // Drive the simulation one possession per tick while playing.
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const id = setInterval(() => {
      const { events, stoppage } = engine.step();
      if (events.length) {
        const shown = events.filter(isShown);
        if (shown.length) setFeed((prev) => [...prev, ...shown]);
      }
      setLive(engine.getLiveState());
      if (stoppage === "final") {
        setPhase("done");
      } else if (stoppage === "period-end") {
        setPaused(true); // pause at quarter breaks for adjustments
      }
    }, 360 / speed);
    return () => clearInterval(id);
  }, [phase, paused, speed, engine]);

  function tipOff() {
    engine.startLive(userSide);
    setLive(engine.getLiveState());
    setPhase("play");
  }

  function skipToEnd() {
    let guard = 0;
    while (!engine.getLiveState().done && guard++ < 200000) engine.step();
    setLive(engine.getLiveState());
    setPanel(null);
    setPhase("done");
  }

  function pushFeed(e: MatchEvent) {
    setFeed((prev) => [...prev, e]);
  }

  function callTimeout() {
    if (engine.requestTimeout(userSide)) {
      setPaused(true);
      setLive(engine.getLiveState());
      pushFeed({ type: "timeout", period: live.period, clock: live.clock, teamId: userTeamId });
    }
  }

  function applyTactics(patch: Partial<Tactics>) {
    const next = { ...liveTactics, ...patch };
    setLiveTactics(next);
    engine.setTeamTactics(userSide, next);
  }

  function doSub(inId: string) {
    if (!subOut) return;
    const out = engine.getSquad(userSide).find((p) => p.id === subOut);
    if (engine.substitute(userSide, subOut, inId)) {
      pushFeed({
        type: "substitution",
        period: live.period,
        clock: live.clock,
        teamId: userTeamId,
        playerId: inId,
        detail: `for ${out?.name ?? ""}`,
      });
      setSubOut(null);
      setLive(engine.getLiveState());
    }
  }

  function assignDefender(defenderId: string) {
    if (!defTarget) return;
    engine.setDefensiveTarget(userSide, defTarget, defenderId);
    setLive(engine.getLiveState());
  }

  function clearDefense() {
    engine.setDefensiveTarget(userSide, null);
    setDefTarget(null);
    setLive(engine.getLiveState());
  }

  const clk = phase === "pre" ? { quarter: "Q1", mmss: "10:00" } : gameClock(live.period, live.clock);
  const tail = feed.slice(-14).reverse();
  const m = live.momentum;

  return (
    <div className="screen">
      <div className="scoreboard">
        <div className="sb-team">
          <div className="nm" style={{ color: userSide === "home" ? "var(--accent)" : undefined }}>{homeCfg.short}</div>
          <div className={`sc${flashHome ? " scored" : ""}`}>
            <AnimatedNumber value={live.homeScore} />
          </div>
        </div>
        <div className="sb-mid">
          <div className="clock">{clk.quarter}</div>
          <div>{phase === "done" ? (live.overtime ? "FINAL/OT" : "FINAL") : clk.mmss}</div>
        </div>
        <div className="sb-team">
          <div className="nm" style={{ color: userSide === "away" ? "var(--accent)" : undefined }}>{awayCfg.short}</div>
          <div className={`sc${flashAway ? " scored" : ""}`}>
            <AnimatedNumber value={live.awayScore} />
          </div>
        </div>
      </div>

      {/* Momentum bar (home grows left of center, away grows right). */}
      {phase !== "pre" && (
        <div className="momentum" title="Momentum">
          <div className="mo-home" style={{ width: `${Math.max(0, m) * 50}%` }} />
          <div className="mo-away" style={{ width: `${Math.max(0, -m) * 50}%` }} />
        </div>
      )}

      {phase === "pre" && (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="center muted" style={{ marginBottom: 4 }}>
            {homeCfg.name} host {awayCfg.name}.
          </p>
          <p className="center muted" style={{ fontSize: 12, marginBottom: 12 }}>
            You&apos;re on the bench. Call timeouts, adjust tactics, substitute, and set defensive
            matchups as the game unfolds.
          </p>
          <button className="btn btn-primary" onClick={tipOff}>▶ Tip-off</button>
        </div>
      )}

      {phase === "play" && (
        <>
          {/* Manager control bar */}
          <div className="coach-bar">
            <button className="btn btn-sm" onClick={callTimeout} disabled={engine.timeoutsRemaining(userSide) <= 0}>
              ⏱ Timeout ({engine.timeoutsRemaining(userSide)})
            </button>
            <button className="btn btn-sm" onClick={() => setPanel(panel === "tactics" ? null : "tactics")}>🎯 Tactics</button>
            <button className="btn btn-sm" onClick={() => setPanel(panel === "subs" ? null : "subs")}>🔄 Subs</button>
            <button className="btn btn-sm" onClick={() => setPanel(panel === "defense" ? null : "defense")}>🛡 Defense</button>
          </div>

          {panel === "tactics" && (
            <div className="card coach-panel">
              <CoachSlider label="Tempo / Pace" value={liveTactics.pace} onChange={(v) => applyTactics({ pace: v })} />
              <CoachSlider label="Pressing" value={liveTactics.pressingIntensity} onChange={(v) => applyTactics({ pressingIntensity: v })} />
              <CoachSlider label="Star rotation" value={liveTactics.starRotation} onChange={(v) => applyTactics({ starRotation: v })} suffix="%" />
              <div className="slider-head"><span>Offensive focus</span></div>
              <div className="seg">
                {(["inside", "balanced", "perimeter"] as OffensiveFocus[]).map((f) => (
                  <button key={f} className={liveTactics.offensiveFocus === f ? "active" : ""} onClick={() => applyTactics({ offensiveFocus: f })}>
                    {f[0]!.toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {panel === "subs" && (
            <div className="card coach-panel">
              <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {subOut ? "Tap a bench player to bring on." : "Tap a player on the floor to take off."}
              </p>
              <div className="sub-grid">
                {engine.getSquad(userSide).map((p) => {
                  const selectable = p.onCourt ? !subOut : !!subOut;
                  return (
                    <button
                      key={p.id}
                      className={`sub-chip ${p.onCourt ? "on" : "off"} ${subOut === p.id ? "sel" : ""}`}
                      disabled={!selectable}
                      onClick={() => (p.onCourt ? setSubOut(p.id) : doSub(p.id))}
                    >
                      <span className="pos-chip" style={{ width: 24, height: 24, flex: "0 0 24px" }}>{p.position}</span>
                      <span className="sub-nm">{p.name}</span>
                      <span className="sub-meta">{p.points}p · {fatiguePct(p.fatigue)}%{p.fouls ? ` · ${p.fouls}f` : ""}</span>
                    </button>
                  );
                })}
              </div>
              {subOut && (
                <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, width: "100%" }} onClick={() => setSubOut(null)}>Cancel</button>
              )}
            </div>
          )}

          {panel === "defense" && (
            <div className="card coach-panel">
              <p className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
                {defTarget ? "Assign one of your defenders to lock them up." : "Pick the opponent scorer to shut down."}
              </p>
              {!defTarget ? (
                <div className="sub-grid">
                  {engine.getSquad(oppSide).filter((p) => p.onCourt).sort((a, b) => b.points - a.points).map((p) => (
                    <button key={p.id} className="sub-chip off" onClick={() => setDefTarget(p.id)}>
                      <span className="pos-chip" style={{ width: 24, height: 24, flex: "0 0 24px" }}>{p.position}</span>
                      <span className="sub-nm">{p.name}</span>
                      <span className="sub-meta">{p.points} pts</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="sub-grid">
                  {engine.getSquad(userSide).filter((p) => p.onCourt).map((p) => (
                    <button key={p.id} className="sub-chip on" onClick={() => { assignDefender(p.id); setDefTarget(null); }}>
                      <span className="pos-chip" style={{ width: 24, height: 24, flex: "0 0 24px" }}>{p.position}</span>
                      <span className="sub-nm">{p.name}</span>
                      <span className="sub-meta">assign</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="btn btn-sm btn-ghost" style={{ marginTop: 8, width: "100%" }} onClick={clearDefense}>Clear assignment</button>
            </div>
          )}

          {/* Playback controls */}
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setPaused((p) => !p)}>
              {paused ? "▶ Resume" : "⏸ Pause"}
            </button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setSpeed((s) => (s >= 8 ? 1 : s * 2))}>{speed}× speed</button>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={skipToEnd}>⏭ Skip</button>
          </div>

          <div className="feed">
            {tail.map((e, i) => {
              const d = describe(e, e.playerId ? nameById[e.playerId] ?? "" : "");
              const c = gameClock(e.period, e.clock);
              return (
                <div key={`${feed.length - i}-${e.clock}-${e.type}`} className={`ev ${d.cls}`}>
                  <span className="t">{c.quarter} {c.mmss}</span>
                  <span>{d.text}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {phase === "done" && (() => {
        const result = engine.getResult();
        return (
          <div style={{ marginTop: 14 }}>
            <p className="center" style={{ fontWeight: 800, marginBottom: 12 }}>
              {result.home.points > result.away.points ? homeCfg.name : awayCfg.name} win{result.overtime ? " (OT)" : ""}
            </p>
            <BoxTable box={result.home} userId={userTeamId} />
            <BoxTable box={result.away} userId={userTeamId} />
            <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => onComplete(result.home.points, result.away.points, result)}>
              Continue →
            </button>
          </div>
        );
      })()}
    </div>
  );
}

function CoachSlider({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  return (
    <div className="slider-block" style={{ marginBottom: 12 }}>
      <div className="slider-head">
        <span>{label}</span>
        <span className="v">{value}{suffix ?? ""}</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
