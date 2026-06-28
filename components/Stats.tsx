"use client";

import { type TeamConfig } from "@/lib/league";
import { type AccumulatedStats } from "@/lib/useGame";
import { ppg, rpg, apg, tsPct } from "@/lib/ratings";
import { Crest } from "@/components/Crest";

interface Props {
  stats: Record<string, AccumulatedStats>;
  userTeamId: string;
  configs: Record<string, TeamConfig>;
}

export function Stats({ stats, userTeamId, configs }: Props) {
  const players = Object.values(stats);
  const anyPlayed = players.length > 0;

  // Top 15 scoring leaders sorted by PPG descending
  const leaders = players
    .filter((s) => s.gamesPlayed > 0)
    .sort((a, b) => ppg(b) - ppg(a))
    .slice(0, 15);

  // Build team rows from configs (use standings-style data derived from player stats)
  const teamRows = Object.entries(configs).map(([teamId, config]) => {
    const teamPlayers = players.filter((s) => s.teamId === teamId);
    if (teamPlayers.length === 0) {
      return { teamId, config, teamPpg: 0, gp: 0 };
    }
    const gp = Math.max(...teamPlayers.map((s) => s.gamesPlayed));
    const totalPoints = teamPlayers.reduce((sum, s) => sum + s.points, 0);
    const teamPpg = gp > 0 ? totalPoints / gp : 0;
    return { teamId, config, teamPpg, gp };
  }).sort((a, b) => b.teamPpg - a.teamPpg);

  return (
    <div className="screen">
      <h2>Season Statistics</h2>

      {!anyPlayed ? (
        <div className="card muted">No games played yet — statistics appear once the season is under way.</div>
      ) : (
        <>
          <h3 style={{ marginBottom: 8, marginTop: 16 }}>Scoring Leaders</h3>
          <div className="card tight">
            <table className="table">
              <thead>
                <tr>
                  <th className="pos">#</th>
                  <th className="l">Player</th>
                  <th className="l">Team</th>
                  <th>GP</th>
                  <th>PPG</th>
                  <th>RPG</th>
                  <th>APG</th>
                  <th>TS%</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((s, i) => {
                  const config = configs[s.teamId];
                  return (
                    <tr key={s.playerId} className={s.teamId === userTeamId ? "me" : ""}>
                      <td className="pos">{i + 1}</td>
                      <td className="club">{s.name}</td>
                      <td className="l">
                        {config ? (
                          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Crest id={config.id} short={config.short} size={16} />
                            {config.short}
                          </span>
                        ) : (
                          s.teamId
                        )}
                      </td>
                      <td>{s.gamesPlayed}</td>
                      <td>{ppg(s)}</td>
                      <td>{rpg(s)}</td>
                      <td>{apg(s)}</td>
                      <td>{tsPct(s)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 style={{ marginBottom: 8, marginTop: 24 }}>Team Scoring</h3>
          <div className="card tight">
            <table className="table">
              <thead>
                <tr>
                  <th className="pos">#</th>
                  <th className="crest-cell"></th>
                  <th className="l">Team</th>
                  <th>GP</th>
                  <th>PPG</th>
                </tr>
              </thead>
              <tbody>
                {teamRows.map((r, i) => (
                  <tr key={r.teamId} className={r.teamId === userTeamId ? "me" : ""}>
                    <td className="pos">{i + 1}</td>
                    <td className="crest-cell">
                      <Crest id={r.config.id} short={r.config.short} size={18} />
                    </td>
                    <td className="club">{r.config.name}</td>
                    <td>{r.gp}</td>
                    <td>{r.gp > 0 ? r.teamPpg.toFixed(1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted" style={{ fontSize: 12, padding: "0 2px", marginTop: 12 }}>
            Player stats accumulate each matchday. TS% = True Shooting Percentage.
          </p>
        </>
      )}
    </div>
  );
}
