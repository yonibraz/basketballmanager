"use client";

import { type League, TOTAL_MATCHDAYS, fixturesForMatchday, sortedStandings } from "@/lib/league";

export function Standings({
  league,
  userTeamId,
  currentMatchday,
}: {
  league: League;
  userTeamId: string;
  currentMatchday: number;
}) {
  const table = sortedStandings(league);
  const md = Math.min(currentMatchday, TOTAL_MATCHDAYS);
  const fixtures = fixturesForMatchday(league, md);

  return (
    <div className="screen">
      <h2>Standings</h2>
      <div className="card tight">
        <table className="table">
          <thead>
            <tr>
              <th className="pos">#</th>
              <th>Club</th>
              <th>P</th>
              <th>W</th>
              <th>L</th>
              <th>+/-</th>
            </tr>
          </thead>
          <tbody>
            {table.map((s, i) => {
              const cfg = league.configs[s.teamId]!;
              const diff = s.pointsFor - s.pointsAgainst;
              return (
                <tr key={s.teamId} className={s.teamId === userTeamId ? "me" : ""}>
                  <td className="pos">{i + 1}</td>
                  <td>{cfg.name}</td>
                  <td>{s.played}</td>
                  <td>{s.wins}</td>
                  <td>{s.losses}</td>
                  <td>{diff > 0 ? `+${diff}` : diff}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2>
        {currentMatchday > TOTAL_MATCHDAYS ? "Final results" : `Matchday ${md} fixtures`}
      </h2>
      <div className="card tight">
        {fixtures.map((f) => {
          const home = league.configs[f.homeId]!;
          const away = league.configs[f.awayId]!;
          const mine = f.homeId === userTeamId || f.awayId === userTeamId;
          return (
            <div key={`${f.homeId}-${f.awayId}`} className="spread" style={{ padding: "8px 2px", borderTop: "1px solid var(--line)" }}>
              <span style={{ fontWeight: mine ? 800 : 500, color: mine ? "var(--accent)" : undefined }}>
                {home.short}
              </span>
              <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>
                {f.played ? `${f.homeScore} – ${f.awayScore}` : "vs"}
              </span>
              <span style={{ fontWeight: mine ? 800 : 500, color: mine ? "var(--accent)" : undefined, textAlign: "right" }}>
                {away.short}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
