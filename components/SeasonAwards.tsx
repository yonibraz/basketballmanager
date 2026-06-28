"use client";
import type { SeasonAwards } from "@/lib/awards";
import { ordinal, pluralWins } from "@/lib/format";

interface Props {
  awards: SeasonAwards;
  userTeamId: string;
  userPosition: number;
  totalTeams: number;
  /** Playoff bracket winner, when the season ran a postseason. Distinct from the regular-season champion. */
  playoffChampion?: { name: string; isUser: boolean };
  onNewSeason: () => void;
}

interface AwardRowProps {
  icon: string;
  label: string;
  teamName: string;
  stat: string;
  isUser: boolean;
}

function AwardRow({ icon, label, teamName, stat, isUser }: AwardRowProps) {
  return (
    <div
      className="spread"
      style={{
        padding: "12px 0",
        borderTop: "1px solid var(--line)",
        color: isUser ? "var(--accent)" : undefined,
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        {isUser && <span aria-hidden="true">★</span>}
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-data)",
          fontWeight: 600,
          fontSize: 14,
          color: isUser ? "var(--accent)" : "var(--text)",
          textAlign: "right",
        }}
      >
        {teamName}
        <span className="muted" style={{ marginLeft: 8, fontWeight: 400 }}>{stat}</span>
      </span>
    </div>
  );
}

export function SeasonAwards({ awards, userTeamId, userPosition, totalTeams, playoffChampion, onNewSeason }: Props) {
  const isChamp = awards.champion.teamId === userTeamId;
  const isOffense = awards.bestOffense.teamId === userTeamId;
  const isDefense = awards.bestDefense.teamId === userTeamId;
  const isWorst = awards.worstRecord.teamId === userTeamId;

  const positionLabel = userPosition > 0 ? ordinal(userPosition) : "—";

  return (
    <div className="screen">
      <div className="hero" style={{ paddingTop: 40, marginBottom: 20 }}>
        <div className="mark">
          <span style={{ fontSize: 40 }}>🏆</span>
        </div>
        <h1>{(playoffChampion?.name ?? awards.champion.name)} Champions!</h1>
        <p>{playoffChampion ? "Playoff champions" : "Season awards ceremony"}</p>
      </div>

      <h2>Season Awards</h2>
      <div className="card" style={{ padding: "4px 18px 14px" }}>
        {playoffChampion && (
          <AwardRow
            icon="👑"
            label="Playoff Champion"
            teamName={playoffChampion.name}
            stat=""
            isUser={playoffChampion.isUser}
          />
        )}
        <AwardRow
          icon="🏆"
          label={playoffChampion ? "Regular Season" : "Champions"}
          teamName={awards.champion.name}
          stat={`${awards.champion.wins}–${awards.champion.losses}`}
          isUser={isChamp}
        />
        <AwardRow
          icon="🎯"
          label="Best Offense"
          teamName={awards.bestOffense.name}
          stat={`${awards.bestOffense.ppg} ppg`}
          isUser={isOffense}
        />
        <AwardRow
          icon="🛡"
          label="Best Defense"
          teamName={awards.bestDefense.name}
          stat={`${awards.bestDefense.oppPpg} opp ppg`}
          isUser={isDefense}
        />
        <AwardRow
          icon="📉"
          label="Wooden Spoon"
          teamName={awards.worstRecord.name}
          stat={pluralWins(awards.worstRecord.wins)}
          isUser={isWorst}
        />
      </div>

      <h2>Your Result</h2>
      <div className="card center">
        <p style={{ fontWeight: 700, fontSize: 18 }}>
          You finished {positionLabel} of {totalTeams} clubs
        </p>
        <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
          Another season in the books. Build for glory.
        </p>
      </div>

      <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={onNewSeason}>
        🔄 Start New Season
      </button>
    </div>
  );
}
