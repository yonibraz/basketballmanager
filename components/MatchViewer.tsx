"use client";

import { useEffect, useMemo, useState } from "react";
import type { MatchEvent, MatchResult, TeamBoxScore } from "@/src/types";
import { type Fixture, type League, simulateFixture, teamById } from "@/lib/league";
import type { Tactics } from "@/src/types";
import { gameClock } from "@/lib/ratings";
import { Crest } from "@/components/Crest";
import { Icon } from "@/components/Icon";

const DISPLAYABLE = new Set<MatchEvent["type"]>([
  "made-fg",
  "free-throw",
  "turnover",
  "steal",
  "block",
  "substitution",
  "period-end",
  "final",
]);

function isShown(e: MatchEvent): boolean {
  if (!DISPLAYABLE.has(e.type)) return false;
  if (e.type === "free-throw") return e.detail === "make"; // only made FTs
  return true;
}

interface Prepared {
  result: MatchResult;
  events: MatchEvent[];
  shown: number[]; // indices of displayable events
  homeCum: number[]; // running home score after each event
  awayCum: number[];
  nameById: Record<string, string>;
}

function prepare(league: League, fixture: Fixture, userTeamId: string, tactics: Tactics): Prepared {
  const result = simulateFixture(league, fixture, userTeamId, tactics);
  const events = result.events;
  const homeCum: number[] = [];
  const awayCum: number[] = [];
  const shown: number[] = [];
  let h = 0;
  let a = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.points) {
      if (e.teamId === fixture.homeId) h += e.points;
      else if (e.teamId === fixture.awayId) a += e.points;
    }
    homeCum[i] = h;
    awayCum[i] = a;
    if (isShown(e)) shown.push(i);
  }
  const nameById: Record<string, string> = {};
  for (const id of [fixture.homeId, fixture.awayId]) {
    for (const p of teamById(league, id).players) nameById[p.id] = p.lastName;
  }
  return { result, events, shown, homeCum, awayCum, nameById };
}

function describe(e: MatchEvent, name: string): { text: string; cls: string } {
  switch (e.type) {
    case "made-fg":
      return { text: `${name} scores ${e.points} (${e.detail})`, cls: "score" };
    case "free-throw":
      return { text: `${name} makes a free throw`, cls: "score" };
    case "turnover":
      return { text: `${name} turns it over`, cls: "bad" };
    case "steal":
      return { text: `${name} steals it`, cls: "" };
    case "block":
      return { text: `${name} blocks the shot`, cls: "" };
    case "substitution":
      return { text: `Substitution: ${name} ${e.detail ?? ""}`, cls: "bad" };
    case "period-end":
      return { text: `— End of ${e.period <= 4 ? `Q${e.period}` : `OT${e.period - 4}`} —`, cls: "bad" };
    case "final":
      return { text: "— Final buzzer —", cls: "bad" };
    default:
      return { text: e.type, cls: "" };
  }
}

function BoxTable({ box, userId }: { box: TeamBoxScore; userId: string }) {
  const players = [...box.players].filter((p) => p.secondsPlayed > 0).sort((a, b) => b.points - a.points).slice(0, 6);
  const isUser = box.teamId === userId;
  return (
    <div className="card tight" style={{ borderColor: isUser ? "var(--line-strong)" : undefined }}>
      <div className="spread boxhead">
        <strong className="boxteam">
          <Crest id={box.teamId} short={box.teamName} size={20} />
          {box.teamName}
        </strong>
        <strong>{box.points}</strong>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th className="l">Player</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId}>
              <td className="l">{p.name}</td>
              <td>{p.points}</td>
              <td>{p.offensiveRebounds + p.defensiveRebounds}</td>
              <td>{p.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MatchViewer({
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
  onComplete: (homeScore: number, awayScore: number) => void;
}) {
  const data = useMemo(() => prepare(league, fixture, userTeamId, tactics), [league, fixture, userTeamId, tactics]);
  const { result, events, shown, homeCum, awayCum, nameById } = data;

  const [phase, setPhase] = useState<"pre" | "play" | "done">("pre");
  const [pointer, setPointer] = useState(0); // index into `shown`
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(2);

  // Advance the playback pointer on a timer.
  useEffect(() => {
    if (phase !== "play" || paused) return;
    const id = setInterval(() => {
      setPointer((p) => Math.min(p + 1, shown.length - 1));
    }, 360 / speed);
    return () => clearInterval(id);
  }, [phase, paused, speed, shown.length]);

  // Transition to the result screen once playback reaches the end.
  useEffect(() => {
    if (phase === "play" && pointer >= shown.length - 1) {
      const t = setTimeout(() => setPhase("done"), 500);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [phase, pointer, shown.length]);

  const homeCfg = league.configs[fixture.homeId]!;
  const awayCfg = league.configs[fixture.awayId]!;

  const curIdx = phase === "pre" ? -1 : shown[pointer] ?? events.length - 1;
  const homeScore = curIdx >= 0 ? homeCum[curIdx]! : 0;
  const awayScore = curIdx >= 0 ? awayCum[curIdx]! : 0;
  const clk = curIdx >= 0 ? gameClock(events[curIdx]!.period, events[curIdx]!.clock) : { quarter: "Q1", mmss: "10:00" };

  const feed = shown.slice(Math.max(0, pointer - 13), pointer + 1).reverse();

  return (
    <div className="screen">
      <div className="scoreboard">
        <div className={`sb-team ${fixture.homeId === userTeamId ? "user" : ""}`}>
          <Crest id={fixture.homeId} short={homeCfg.short} size={34} />
          <div className="nm">{homeCfg.short}</div>
          <div className="sc">{homeScore}</div>
        </div>
        <div className="sb-mid">
          <div className="clock">{clk.quarter}</div>
          <div>{phase === "done" ? (result.overtime ? "FINAL/OT" : "FINAL") : clk.mmss}</div>
        </div>
        <div className={`sb-team ${fixture.awayId === userTeamId ? "user" : ""}`}>
          <Crest id={fixture.awayId} short={awayCfg.short} size={34} />
          <div className="nm">{awayCfg.short}</div>
          <div className="sc">{awayScore}</div>
        </div>
      </div>

      {phase === "pre" && (
        <div className="card" style={{ marginTop: 14 }}>
          <p className="center muted" style={{ marginBottom: 12 }}>
            {homeCfg.name} host {awayCfg.name}. Your tactics are locked in.
          </p>
          <button className="btn btn-primary" onClick={() => setPhase("play")}>
            <Icon name="play" size={16} /> Tip-off
          </button>
        </div>
      )}

      {phase === "play" && (
        <>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button className="btn btn-sm" style={{ flex: 1 }} onClick={() => setPaused((p) => !p)}>
              <Icon name={paused ? "play" : "pause"} size={14} /> {paused ? "Resume" : "Pause"}
            </button>
            <button
              className="btn btn-sm"
              style={{ flex: 1 }}
              onClick={() => setSpeed((s) => (s >= 8 ? 1 : s * 2))}
            >
              {speed}× speed
            </button>
            <button
              className="btn btn-sm"
              style={{ flex: 1 }}
              onClick={() => {
                setPointer(shown.length - 1);
                setPhase("done");
              }}
            >
              <Icon name="skip" size={14} /> Skip
            </button>
          </div>
          <div className="feed">
            {feed.map((idx) => {
              const e = events[idx]!;
              const d = describe(e, e.playerId ? nameById[e.playerId] ?? "" : "");
              const c = gameClock(e.period, e.clock);
              return (
                <div key={idx} className={`ev ${d.cls}`}>
                  <span className="t">
                    {c.quarter} {c.mmss}
                  </span>
                  <span>{d.text}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {phase === "done" && (
        <div style={{ marginTop: 14 }}>
          <p className="center" style={{ fontWeight: 800, marginBottom: 12 }}>
            {result.home.points > result.away.points ? homeCfg.name : awayCfg.name} win
            {result.overtime ? " (OT)" : ""}
          </p>
          <BoxTable box={result.home} userId={userTeamId} />
          <BoxTable box={result.away} userId={userTeamId} />
          <button
            className="btn btn-primary"
            style={{ marginTop: 8 }}
            onClick={() => onComplete(result.home.points, result.away.points)}
          >
            Continue <Icon name="chevronRight" size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
