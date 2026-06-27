"use client";

import { useMemo } from "react";
import type { Team } from "@/src/types";
import {
  type League,
  type Standing,
  TOTAL_MATCHDAYS,
  sortedStandings,
} from "@/lib/league";
import { overall } from "@/lib/ratings";
import { Crest } from "@/components/Crest";
import { Icon } from "@/components/Icon";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!);
}

/** Rank of a value across teams; `asc` true means lower is better. */
function rankOf(values: { id: string; v: number }[], id: string, asc = false): number {
  const sorted = [...values].sort((a, b) => (asc ? a.v - b.v : b.v - a.v));
  return sorted.findIndex((x) => x.id === id) + 1;
}

export function Dashboard({
  league,
  userTeamId,
  team,
  currentMatchday,
  onNav,
}: {
  league: League;
  userTeamId: string;
  team: Team;
  currentMatchday: number;
  onNav: (tab: string) => void;
}) {
  const cfg = league.configs[userTeamId]!;
  const table = sortedStandings(league);
  const myStanding = league.standings[userTeamId]!;
  const myRank = table.findIndex((s) => s.teamId === userTeamId) + 1;

  // Per-game scoring metrics + their league ranks (real, from standings).
  const ppgVals = Object.values(league.standings).map((s: Standing) => ({
    id: s.teamId,
    v: s.played ? s.pointsFor / s.played : 0,
  }));
  const oppgVals = Object.values(league.standings).map((s: Standing) => ({
    id: s.teamId,
    v: s.played ? s.pointsAgainst / s.played : 0,
  }));
  const diffVals = Object.values(league.standings).map((s: Standing) => ({
    id: s.teamId,
    v: s.played ? (s.pointsFor - s.pointsAgainst) / s.played : 0,
  }));
  const played = myStanding.played;
  const ppg = played ? myStanding.pointsFor / played : 0;
  const oppg = played ? myStanding.pointsAgainst / played : 0;
  const diff = played ? (myStanding.pointsFor - myStanding.pointsAgainst) / played : 0;

  // Recent results for this club (form), oldest → newest.
  const form = useMemo(() => {
    return league.schedule
      .filter((f) => f.played && (f.homeId === userTeamId || f.awayId === userTeamId))
      .sort((a, b) => a.matchday - b.matchday)
      .map((f) => {
        const us = f.homeId === userTeamId ? f.homeScore! : f.awayScore!;
        const them = f.homeId === userTeamId ? f.awayScore! : f.homeScore!;
        return { md: f.matchday, us, them, win: us > them, margin: us - them };
      });
  }, [league, userTeamId]);

  // Next fixture (current matchday).
  const nextFixture = useMemo(
    () =>
      league.schedule.find(
        (f) => f.matchday === currentMatchday && (f.homeId === userTeamId || f.awayId === userTeamId),
      ) ?? null,
    [league, userTeamId, currentMatchday],
  );

  const topPerformers = [...team.players].sort((a, b) => overall(b) - overall(a)).slice(0, 4);

  const snapshot = table.slice(0, 6);

  // Cumulative point-differential sparkline path.
  const spark = useMemo(() => {
    if (form.length < 2) return null;
    let cum = 0;
    const pts = form.map((f) => (cum += f.margin));
    const min = Math.min(0, ...pts);
    const max = Math.max(0, ...pts);
    const span = max - min || 1;
    const W = 100;
    const H = 100;
    const coords = pts.map((p, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - ((p - min) / span) * H;
      return [x, y] as const;
    });
    const line = coords.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L100 100 L0 100 Z`;
    const zeroY = H - ((0 - min) / span) * H;
    return { line, area, zeroY };
  }, [form]);

  return (
    <div className="screen">
      <div className="dash">
        {/* Team overview ---------------------------------------------------- */}
        <div className="panel col-8">
          <div className="team-hero">
            <Crest id={cfg.id} short={cfg.short} size={56} />
            <div className="meta">
              <h1>{cfg.name}</h1>
              <div className="sub">{cfg.country} · EuroLeague</div>
            </div>
            <div className="record">
              <div className="rec">{myStanding.wins}-{myStanding.losses}</div>
              <div className="lbl">{myRank ? ordinal(myRank) : "—"} place</div>
            </div>
          </div>
          <div className="kpi-row" style={{ marginTop: 18 }}>
            <div className="kpi">
              <div><span className="v">{played ? ppg.toFixed(1) : "—"}</span>{played ? <span className="rank">{ordinal(rankOf(ppgVals, userTeamId))}</span> : null}</div>
              <div className="l">Points / game</div>
            </div>
            <div className="kpi">
              <div><span className="v">{played ? oppg.toFixed(1) : "—"}</span>{played ? <span className="rank">{ordinal(rankOf(oppgVals, userTeamId, true))}</span> : null}</div>
              <div className="l">Opp pts / game</div>
            </div>
            <div className="kpi">
              <div><span className="v">{played ? (diff > 0 ? "+" : "") + diff.toFixed(1) : "—"}</span>{played ? <span className="rank">{ordinal(rankOf(diffVals, userTeamId))}</span> : null}</div>
              <div className="l">Differential</div>
            </div>
          </div>
        </div>

        {/* Next game -------------------------------------------------------- */}
        <div className="panel col-4">
          <div className="panel-head"><span className="panel-title">Next Game</span></div>
          {nextFixture ? (
            (() => {
              const home = nextFixture.homeId === userTeamId;
              const oppId = home ? nextFixture.awayId : nextFixture.homeId;
              const opp = league.configs[oppId]!;
              return (
                <div className="nextgame">
                  <Crest id={opp.id} short={opp.short} size={44} />
                  <div>
                    <div className="vs">{home ? "vs" : "@"}</div>
                    <div className="opp">{opp.name}</div>
                  </div>
                  <div className="when">
                    <div className="date">MD {nextFixture.matchday}</div>
                    <div>of {TOTAL_MATCHDAYS}</div>
                  </div>
                </div>
              );
            })()
          ) : (
            <p className="muted">Season complete.</p>
          )}
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => onNav("match")}>
            <Icon name="play" size={15} /> Go to match
          </button>
        </div>

        {/* Standings snapshot ---------------------------------------------- */}
        <div className="panel col-7">
          <div className="panel-head">
            <span className="panel-title">Team Standings</span>
            <button className="panel-link" onClick={() => onNav("schedule")}>Full table</button>
          </div>
          <table className="table">
            <tbody>
              {snapshot.map((s, i) => {
                const c = league.configs[s.teamId]!;
                return (
                  <tr key={s.teamId} className={s.teamId === userTeamId ? "me" : ""}>
                    <td className="pos">{i + 1}</td>
                    <td className="crest-cell"><Crest id={c.id} short={c.short} size={18} /></td>
                    <td className="club">{c.name}</td>
                    <td>{s.wins}-{s.losses}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Form ------------------------------------------------------------- */}
        <div className="panel col-5">
          <div className="panel-head"><span className="panel-title">Form Trend</span></div>
          {spark ? (
            <svg className="spark" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="0" y1={spark.zeroY} x2="100" y2={spark.zeroY} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <path d={spark.area} fill="var(--primary)" fillOpacity="0.1" />
              <path d={spark.line} fill="none" stroke="var(--primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          ) : (
            <p className="muted" style={{ fontSize: 13 }}>Play a few games to chart your form.</p>
          )}
          <div className="form-dots">
            {form.slice(-7).map((f) => (
              <span key={f.md} className={`form-dot ${f.win ? "w" : "l"}`} title={`MD${f.md}: ${f.us}-${f.them}`}>
                {f.win ? "W" : "L"}
              </span>
            ))}
          </div>
        </div>

        {/* Top performers --------------------------------------------------- */}
        <div className="panel col-12">
          <div className="panel-head">
            <span className="panel-title">Active Roster · Top Performers</span>
            <button className="panel-link" onClick={() => onNav("roster")}>Full squad</button>
          </div>
          <div className="plist" style={{ gap: 8 }}>
            {topPerformers.map((p) => (
              <div key={p.id} className="prow" style={{ boxShadow: "none" }}>
                <div className="pavatar">{`${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`}</div>
                <div style={{ minWidth: 0 }}>
                  <div className="pname">{p.firstName} {p.lastName}</div>
                  <div className="pmeta"><span className="pos-tag">{p.position}</span><span>{p.nationality} · {p.age}y</span></div>
                </div>
                <span className="badge active" style={{ marginLeft: "auto" }}>Active</span>
                <div className="ovr" style={{ marginLeft: 14 }}>{overall(p)}<small>OVR</small></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
