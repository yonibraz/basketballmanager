"use client";

import { type League, sortedStandings } from "@/lib/league";
import { Crest } from "@/components/Crest";

export function Stats({ league, userTeamId }: { league: League; userTeamId: string }) {
  const table = sortedStandings(league);
  const anyPlayed = Object.values(league.standings).some((s) => s.played > 0);

  const rows = Object.values(league.standings)
    .map((s) => ({
      id: s.teamId,
      played: s.played,
      ppg: s.played ? s.pointsFor / s.played : 0,
      oppg: s.played ? s.pointsAgainst / s.played : 0,
      diff: s.played ? (s.pointsFor - s.pointsAgainst) / s.played : 0,
    }))
    .sort((a, b) => b.ppg - a.ppg);

  return (
    <div className="screen">
      <h2>League Statistics</h2>
      {!anyPlayed ? (
        <div className="card muted">No games played yet — statistics appear once the season is under way.</div>
      ) : (
        <div className="card tight">
          <table className="table">
            <thead>
              <tr>
                <th className="pos">#</th>
                <th className="crest-cell"></th>
                <th className="l">Club</th>
                <th>GP</th>
                <th>PPG</th>
                <th>OPP</th>
                <th>DIFF</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const c = league.configs[r.id]!;
                return (
                  <tr key={r.id} className={r.id === userTeamId ? "me" : ""}>
                    <td className="pos">{i + 1}</td>
                    <td className="crest-cell"><Crest id={c.id} short={c.short} size={18} /></td>
                    <td className="club">{c.name}</td>
                    <td>{r.played}</td>
                    <td>{r.played ? r.ppg.toFixed(1) : "—"}</td>
                    <td>{r.played ? r.oppg.toFixed(1) : "—"}</td>
                    <td>{r.played ? (r.diff > 0 ? "+" : "") + r.diff.toFixed(1) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12, padding: "0 2px" }}>
        Standings are sorted by wins, then point differential. Statistics are derived from
        completed fixtures across the {table.length}-club competition.
      </p>
    </div>
  );
}
