"use client";

import { useState } from "react";
import { useGame } from "@/lib/useGame";
import { TEAM_CONFIGS, TOTAL_MATCHDAYS, sortedStandings, teamById } from "@/lib/league";
import { Standings } from "@/components/Standings";
import { Roster } from "@/components/Roster";
import { TacticsBoard } from "@/components/TacticsBoard";
import { LiveMatch } from "@/components/LiveMatch";
import { Crest } from "@/components/Crest";
import { Icon, type IconName } from "@/components/Icon";

type Tab = "home" | "roster" | "tactics" | "match";

export default function Page() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("home");

  if (!game.ready) {
    return (
      <div className="app">
        <div className="hero" style={{ marginTop: "26vh" }}>
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
        <div className="hero">
          <div className="mark"><Icon name="ball" size={46} /></div>
          <h1>Courtside</h1>
          <p>International Basketball Manager. Pick a EuroLeague club and manage your season.</p>
        </div>
        <div className="screen">
          <h2>Choose your club</h2>
          <div className="picker-grid">
            {TEAM_CONFIGS.map((c) => (
              <button key={c.id} className="team-tile" onClick={() => game.chooseTeam(c.id)}>
                <div className="tile-top">
                  <Crest id={c.id} short={c.short} size={40} />
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

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <div className="brand">
            <Crest id={config.id} short={config.short} size={34} />
            <div>
              <h1>{config.name}</h1>
              <div className="sub">{mdLabel}</div>
            </div>
          </div>
        </div>
      </header>

      {tab === "home" && (
        <Standings league={game.league} userTeamId={userTeamId} currentMatchday={game.currentMatchday} />
      )}
      {tab === "roster" && <Roster team={team} config={config} />}
      {tab === "tactics" && <TacticsBoard tactics={game.tactics} onChange={game.setTactics} />}
      {tab === "match" && (
        <MatchScreen game={game} userTeamId={userTeamId} onGoTable={() => setTab("home")} />
      )}

      <nav className="nav">
        {([
          { k: "home", ic: "table", l: "Table" },
          { k: "roster", ic: "squad", l: "Squad" },
          { k: "tactics", ic: "tactics", l: "Tactics" },
          { k: "match", ic: "play", l: "Play" },
        ] as { k: Tab; ic: IconName; l: string }[]).map((n) => (
          <button key={n.k} className={`nav-item ${tab === n.k ? "active" : ""}`} onClick={() => setTab(n.k)}>
            <span className="ic"><Icon name={n.ic} size={20} /></span>
            {n.l}
          </button>
        ))}
      </nav>
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
    const table = sortedStandings(game.league);
    const myPos = table.findIndex((s) => s.teamId === userTeamId) + 1;
    const champ = game.league.configs[table[0]!.teamId]!;
    return (
      <div className="screen">
        <div className="hero" style={{ paddingTop: 28, borderRadius: "var(--radius)", marginBottom: 12 }}>
          <div className="mark"><Icon name="trophy" size={44} /></div>
          <h1>{champ.name}</h1>
          <p>Champions</p>
        </div>
        <div className="card center">
          <p style={{ fontWeight: 800, fontSize: 18 }}>You finished #{myPos}</p>
          <p className="muted" style={{ marginTop: 4 }}>of {TEAM_CONFIGS.length} clubs</p>
        </div>
        <button className="btn btn-primary" onClick={() => { game.newSeason(); onGoTable(); }}>
          Start a new season
        </button>
      </div>
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
