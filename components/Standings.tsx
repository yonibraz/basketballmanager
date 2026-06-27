"use client";

import { type League, TOTAL_MATCHDAYS, fixturesForMatchday, sortedStandings } from "@/lib/league";
import { Crest } from "@/components/Crest";

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
              <th className="crest-cell"></th>
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
                  <td className="crest-cell"><Crest id={cfg.id} short={cfg.short} size={18} /></td>
                  <td className="club">{cfg.name}</td>
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
            <div
              key={`${f.homeId}-${f.awayId}`}
              className="fixture"
              style={{ fontWeight: mine ? 700 : 500, color: mine ? "#fff" : undefined }}
            >
              <span className="fx-team fx-home">
                <span className="fx-nm">{home.short}</span>
                <Crest id={home.id} short={home.short} size={20} />
              </span>
              <span className="fx-score">
                {f.played ? `${f.homeScore}–${f.awayScore}` : "vs"}
              </span>
              <span className="fx-team fx-away">
                <Crest id={away.id} short={away.short} size={20} />
                <span className="fx-nm">{away.short}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
