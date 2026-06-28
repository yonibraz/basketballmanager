"use client";

import { useState } from "react";
import { useGame } from "@/lib/useGame";
import { type Fixture, TEAM_CONFIGS, TOTAL_MATCHDAYS, sortedStandings, teamById } from "@/lib/league";
import { Standings } from "@/components/Standings";
import { Roster } from "@/components/Roster";
import { TacticsBoard } from "@/components/TacticsBoard";
import { LiveMatch } from "@/components/LiveMatch";
import { Dashboard } from "@/components/Dashboard";
import { Stats } from "@/components/Stats";
import { Market } from "@/components/Market";
import { Crest } from "@/components/Crest";
import { Icon, type IconName } from "@/components/Icon";
import { SeasonAwards } from "@/components/SeasonAwards";
import { computeAwards } from "@/lib/awards";

type Tab = "dashboard" | "roster" | "schedule" | "tactics" | "stats" | "match" | "market";

const NAV: { k: Tab; ic: IconName; l: string }[] = [
  { k: "dashboard", ic: "dashboard", l: "Dashboard" },
  { k: "roster", ic: "squad", l: "Squad" },
  { k: "schedule", ic: "calendar", l: "Schedule" },
  { k: "tactics", ic: "tactics", l: "Tactics" },
  { k: "stats", ic: "table", l: "Stats" },
  { k: "match", ic: "play", l: "Play" },
  { k: "market", ic: "ball", l: "Market" },
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
  const mdLabel =
    game.playoff.phase === "done"
      ? "Season complete"
      : game.playoff.phase === "semis" || game.playoff.phase === "final"
      ? "Playoffs"
      : `Matchday ${game.currentMatchday} / ${TOTAL_MATCHDAYS}`;
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
          <button className="side-item" onClick={() => { game.newSeason(); setTab("dashboard"); }}>
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
        {tab === "roster" && <Roster team={team} config={config} injuredPlayers={game.injuredPlayers} />}
        {tab === "schedule" && (
          <Standings
            league={game.league}
            userTeamId={userTeamId}
            currentMatchday={game.currentMatchday}
            playoff={game.playoff}
          />
        )}
        {tab === "tactics" && <TacticsBoard tactics={game.tactics} onChange={game.setTactics} />}
        {tab === "stats" && <Stats stats={game.seasonStats} userTeamId={userTeamId} configs={game.league.configs} />}
        {tab === "market" && (
          <Market
            freeAgents={game.freeAgents}
            userTeam={team}
            budget={game.budget}
            onSign={game.signPlayer}
            onRelease={game.releasePlayer}
          />
        )}
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
  // Season is fully over (playoffs done) — show the awards ceremony, headlined by the playoff champion.
  if (game.playoff.phase === "done") {
    const { bracket } = game.playoff;
    const champId = bracket?.final.winnerId ?? null;
    const champ = champId ? game.league.configs[champId] : null;
    const awards = computeAwards(game.league);
    const table = sortedStandings(game.league);
    const myPos = table.findIndex((s) => s.teamId === userTeamId) + 1;
    return (
      <SeasonAwards
        awards={awards}
        userTeamId={userTeamId}
        userPosition={myPos}
        totalTeams={TEAM_CONFIGS.length}
        playoffChampion={champ ? { name: champ.name, isUser: champId === userTeamId } : undefined}
        onNewSeason={() => { game.newSeason(); onGoTable(); }}
      />
    );
  }

  // In playoffs (semis or final) — show playoff fixture.
  if (game.currentMatchday > TOTAL_MATCHDAYS && game.playoff.phase !== "none") {
    const pg = game.playoffFixture;
    if (!pg || !pg.homeId || !pg.awayId) {
      return (
        <div className="screen">
          <div className="card center muted">Setting up next playoff game…</div>
        </div>
      );
    }

    // Determine banner label.
    let bannerLabel = "PLAYOFFS";
    if (game.playoff.phase === "semis") {
      bannerLabel = game.playoff.currentGame === 0 ? "PLAYOFFS — Semifinal 1" : "PLAYOFFS — Semifinal 2";
    } else if (game.playoff.phase === "final") {
      bannerLabel = "PLAYOFFS — Final";
    }

    // Adapt PlayoffGame to Fixture shape for LiveMatch.
    const adaptedFixture: Fixture = {
      matchday: 99,
      homeId: pg.homeId,
      awayId: pg.awayId,
      played: false,
    };

    const playoffKey = `playoff-${game.playoff.phase}-${game.playoff.currentGame}`;

    return (
      <div className="screen">
        <div className="card center" style={{ marginBottom: 0, padding: "8px 16px", background: "var(--accent)", color: "#fff", borderRadius: 8 }}>
          <span style={{ fontWeight: 800, letterSpacing: 1 }}>🏆 {bannerLabel}</span>
        </div>
        <LiveMatch
          key={playoffKey}
          league={game.league}
          fixture={adaptedFixture}
          userTeamId={userTeamId}
          tactics={game.tactics}
          onComplete={(h, a) => game.completePlayoffGame(h, a)}
        />
      </div>
    );
  }

  // Regular season fixture.
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
      onComplete={(h, a, result) => game.completeMatchday(fixture, h, a, result)}
    />
  );
}
