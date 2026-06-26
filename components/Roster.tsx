"use client";

import { useMemo } from "react";
import type { Team } from "@/src/types";
import { LEAGUE_QUOTAS } from "@/src/rosters/quotas";
import { validateRoster } from "@/src/rosters/validation";
import type { TeamConfig } from "@/lib/league";
import { isForeign, overall } from "@/lib/ratings";

export function Roster({ team, config }: { team: Team; config: TeamConfig }) {
  const rule = LEAGUE_QUOTAS[config.quotaRuleId] ?? LEAGUE_QUOTAS.GEN_DOMESTIC!;
  const report = useMemo(
    () => validateRoster(team.players, rule, team.country),
    [team, rule],
  );

  const players = [...team.players].sort((a, b) => overall(b) - overall(a));

  return (
    <div className="screen">
      <h2>{config.name} — Roster</h2>

      <div className="card">
        <div className="stat-grid">
          <div className="stat">
            <div className="n">{team.players.length}</div>
            <div className="l">Squad</div>
          </div>
          <div className="stat">
            <div className="n" style={{ color: "var(--blue)" }}>{report.summary.foreign}</div>
            <div className="l">Foreign</div>
          </div>
          <div className="stat">
            <div className="n" style={{ color: "var(--accent-2)" }}>{report.summary.homegrown}</div>
            <div className="l">Homegrown</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }} className="spread">
          <span className="muted" style={{ fontSize: 12 }}>{rule.name} registration</span>
          {report.valid ? (
            <span className="badge ok">✓ Compliant</span>
          ) : (
            <span className="badge warn">✕ {report.violations.length} issue(s)</span>
          )}
        </div>
        {!report.valid && (
          <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--red)", fontSize: 12 }}>
            {report.violations.map((v) => (
              <li key={v.code}>{v.message}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="plist">
        {players.map((p) => (
          <div key={p.id} className="prow">
            <div className="pos-chip">{p.position}</div>
            <div>
              <div className="pname">
                {p.firstName} {p.lastName}
              </div>
              <div className="pmeta">
                {p.nationality} · {p.age}y
                {isForeign(p, team.country) ? (
                  <span className="badge foreign" style={{ marginLeft: 6 }}>FOR</span>
                ) : p.homegrown ? (
                  <span className="badge home" style={{ marginLeft: 6 }}>HG</span>
                ) : null}
              </div>
            </div>
            <div className="ovr">
              {overall(p)}
              <small>OVR</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
