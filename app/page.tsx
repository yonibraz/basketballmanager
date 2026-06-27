"use client";

import { useState } from "react";
import { useGame } from "@/lib/useGame";
import { TEAM_CONFIGS, TOTAL_MATCHDAYS, sortedStandings, teamById } from "@/lib/league";
import { Standings } from "@/components/Standings";
import { Roster } from "@/components/Roster";
import { TacticsBoard } from "@/components/TacticsBoard";
import { LiveMatch } from "@/components/LiveMatch";
import { Dashboard } from "@/components/Dashboard";
import { Stats } from "@/components/Stats";
import { Crest } from "@/components/Crest";
import { Icon, type IconName } from "@/components/Icon";
import { SeasonAwards } from "@/components/SeasonAwards";
import { computeAwards } from "@/lib/awards";

type Tab = "dashboard" | "roster" | "schedule" | "tactics" | "stats" | "match";

const NAV: { k: Tab; ic: IconName; l: string }[] = [
  { k: "dashboard", ic: "dashboard", l: "Dashboard" },
  { k: "roster", ic: "squad", l: "Squad" },
  { k: "schedule", ic: "calendar", l: "Schedule" },
  { k: "tactics", ic: "tactics", l: "Tactics" },
  { k: "stats", ic: "table", l: "Stats" },
  { k: "match", ic: "play", l: "Play" },
];

export default function Page() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!game.ready) {
    return (
      <div className="app">
        <div className="hero" style={{ marginTop: "24vh" }}>
          <div className="mark"><Icon name="ball" size={46} /></div>
          <h1>Courtside</h1>
        </div>
      </div>
    );
  }

  // ---- Onboarding: pick a club -------------------------------------------
  if (!game.userTeamId) {
    return (
      <div className="app">
        <div className="screen">
          <div className="hero">
            <div className="mark"><Icon name="ball" size={46} /></div>
            <h1>Courtside</h1>
            <p>International Basketball Manager. Pick a EuroLeague club and manage your season.</p>
          </div>
          <h2 style={{ marginTop: 24 }}>Choose your club</h2>
          <div className="picker-grid">
            {TEAM_CONFIGS.map((c) => (
              <button key={c.id} className="team-tile" onClick={() => game.chooseTeam(c.id)}>
                <div className="tile-top">
                  <Crest id={c.id} short={c.short} size={44} />
                  <div>
                    <div className="nm">{c.name}</div>
                    <div className="ct">{c.country}</div>
                  </div>
                </div>
                <div className="str">
                  <i style={{ width: `${(c.strength / 18) * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const userTeamId = game.userTeamId;
  const team = teamById(game.league, userTeamId);
  const config = game.league.configs[userTeamId]!;
  const mdLabel = game.seasonOver ? "Season complete" : `Matchday ${game.currentMatchday} / ${TOTAL_MATCHDAYS}`;
  const active = NAV.find((n) => n.k === tab)!;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="ball"><Icon name="ball" size={24} /></span>
          <span className="name">Courtside</span>
        </div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <button key={n.k} className={`side-item ${tab === n.k ? "active" : ""}`} onClick={() => setTab(n.k)}>
              <Icon name={n.ic} size={19} />
              <span className="lbl">{n.l}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <button className="side-item" onClick={() => game.newSeason()}>
            <Icon name="settings" size={19} />
            <span className="lbl">New season</span>
          </button>
        </div>
      </aside>

      <div className="content">
        <header className="topbar">
          <div className="crumb">
            <span className="hide-sm">{active.l}</span>
            <span className="sep hide-sm">/</span>
            <Crest id={config.id} short={config.short} size={22} />
            <span className="muted2">{config.name}</span>
          </div>
          <div className="me-chip">
            <span className="muted">{mdLabel}</span>
          </div>
        </header>

        {tab === "dashboard" && (
          <Dashboard
            league={game.league}
            userTeamId={userTeamId}
            team={team}
            currentMatchday={game.currentMatchday}
            onNav={(t) => setTab(t as Tab)}
          />
        )}
        {tab === "roster" && <Roster team={team} config={config} />}
        {tab === "schedule" && (
          <Standings league={game.league} userTeamId={userTeamId} currentMatchday={game.currentMatchday} />
        )}
        {tab === "tactics" && <TacticsBoard tactics={game.tactics} onChange={game.setTactics} />}
        {tab === "stats" && <Stats league={game.league} userTeamId={userTeamId} />}
        {tab === "match" && (
          <MatchScreen game={game} userTeamId={userTeamId} onGoTable={() => setTab("dashboard")} />
        )}
      </div>
    </div>
  );
}

function MatchScreen({
  game,
  userTeamId,
  onGoTable,
}: {
  game: ReturnType<typeof useGame>;
  userTeamId: string;
  onGoTable: () => void;
}) {
  if (game.seasonOver) {
    const awards = computeAwards(game.league);
    const table = sortedStandings(game.league);
    const myPos = table.findIndex((s) => s.teamId === userTeamId) + 1;
    return (
      <SeasonAwards
        awards={awards}
        userTeamId={userTeamId}
        userPosition={myPos}
        totalTeams={TEAM_CONFIGS.length}
        onNewSeason={() => { game.newSeason(); onGoTable(); }}
      />
    );
  }

  const fixture = game.userFixture;
  if (!fixture) {
    return (
      <div className="screen">
        <div className="card center muted">No fixture scheduled.</div>
      </div>
    );
  }

  return (
    <LiveMatch
      key={`md-${game.currentMatchday}`}
      league={game.league}
      fixture={fixture}
      userTeamId={userTeamId}
      tactics={game.tactics}
      onComplete={(h, a) => game.completeMatchday(fixture, h, a)}
    />
  );
}
