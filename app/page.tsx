"use client";

import { useState } from "react";
import { useGame } from "@/lib/useGame";
import { TEAM_CONFIGS, TOTAL_MATCHDAYS, sortedStandings, teamById } from "@/lib/league";
import { Standings } from "@/components/Standings";
import { Roster } from "@/components/Roster";
import { TacticsBoard } from "@/components/TacticsBoard";
import { LiveMatch } from "@/components/LiveMatch";

type Tab = "home" | "roster" | "tactics" | "match";

export default function Page() {
  const game = useGame();
  const [tab, setTab] = useState<Tab>("home");

  if (!game.ready) {
    return (
      <div className="app">
        <div className="hero" style={{ marginTop: "30vh" }}>
          <div className="ball">🏀</div>
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
          <div className="ball">🏀</div>
          <h1>Courtside</h1>
          <p>International Basketball Manager. Pick a EuroLeague club and manage your season.</p>
        </div>
        <div className="screen">
          <h2>Choose your club</h2>
          <div className="picker-grid">
            {TEAM_CONFIGS.map((c) => (
              <button key={c.id} className="team-tile" onClick={() => game.chooseTeam(c.id)}>
                <div className="nm">{c.name}</div>
                <div className="ct">{c.country}</div>
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
          <div>
            <h1>{config.name}</h1>
            <div className="sub">{mdLabel}</div>
          </div>
          <div className="ball" style={{ fontSize: 24 }}>🏀</div>
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
          { k: "home", ic: "📊", l: "Table" },
          { k: "roster", ic: "👥", l: "Squad" },
          { k: "tactics", ic: "🎯", l: "Tactics" },
          { k: "match", ic: "🏀", l: "Play" },
        ] as { k: Tab; ic: string; l: string }[]).map((n) => (
          <button key={n.k} className={`nav-item ${tab === n.k ? "active" : ""}`} onClick={() => setTab(n.k)}>
            <span className="ic">{n.ic}</span>
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
        <div className="hero" style={{ paddingTop: 16 }}>
          <div className="ball">🏆</div>
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
