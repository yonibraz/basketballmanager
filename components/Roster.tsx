"use client";

import { useMemo, type CSSProperties } from "react";
import type { Player, Team } from "@/src/types";
import { LEAGUE_QUOTAS } from "@/src/rosters/quotas";
import { validateRoster } from "@/src/rosters/validation";
import type { TeamConfig } from "@/lib/league";
import { isForeign, overall } from "@/lib/ratings";
import { Icon } from "@/components/Icon";

function AttrBar({ value, color }: { value: number; color: string }) {
  const pct = ((value - 1) / 19) * 100;
  return (
    <div style={{ height: 3, borderRadius: 2, background: "var(--line)", overflow: "hidden", flex: 1 }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      />
    </div>
  );
}

export function Roster({
  team,
  config,
  injuredPlayers,
}: {
  team: Team;
  config: TeamConfig;
  injuredPlayers: Player[];
}) {
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
            <div className="n">{report.summary.foreign}</div>
            <div className="l">Foreign</div>
          </div>
          <div className="stat">
            <div className="n">{report.summary.homegrown}</div>
            <div className="l">Homegrown</div>
          </div>
        </div>
        <div style={{ marginTop: 12 }} className="spread">
          <span className="muted" style={{ fontSize: 12 }}>{rule.name} registration</span>
          {report.valid ? (
            <span className="badge ok"><Icon name="check" size={12} /> Compliant</span>
          ) : (
            <span className="badge warn"><Icon name="x" size={12} /> {report.violations.length} issue(s)</span>
          )}
        </div>
        {!report.valid && (
          <ul style={{ marginTop: 8, paddingLeft: 18, color: "var(--muted)", fontSize: 12 }}>
            {report.violations.map((v) => (
              <li key={v.code}>{v.message}</li>
            ))}
          </ul>
        )}
      </div>

      {injuredPlayers.length > 0 && (
        <div className="card" style={{ borderLeft: "3px solid var(--red, #c0392b)", marginBottom: 8 }}>
          <strong>Injury Report</strong>
          <div className="muted">
            {injuredPlayers.map((p) => `${p.lastName} (out ${p.injuryWeeksLeft ?? 0})`).join(", ")}
          </div>
        </div>
      )}

      <div className="plist">
        {players.map((p, i) => {
          const injured = (p.injuryWeeksLeft ?? 0) > 0;
          return (
            <div key={p.id} className="prow" style={{ "--i": i } as CSSProperties}>
              <div className="pavatar">{`${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pname" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {p.firstName} {p.lastName}
                  {injured && (
                    <span style={{ color: "var(--red, #c0392b)", fontWeight: 700, fontSize: 11 }}>
                      INJ-{p.injuryWeeksLeft}
                    </span>
                  )}
                </div>
                <div className="pmeta">
                  <span className="pos-tag">{p.position}</span>
                  <span>{p.nationality}</span>
                  {isForeign(p, team.country) ? (
                    <span className="badge foreign">FOR</span>
                  ) : p.homegrown ? (
                    <span className="badge home">HG</span>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                  <AttrBar value={(p.attributes.shootingOutside + p.attributes.shootingInside) / 2} color="var(--accent)" />
                  <AttrBar value={(p.attributes.defPerimeter + p.attributes.defInterior) / 2} color="var(--green)" />
                  <AttrBar value={(p.attributes.strength + p.attributes.pace) / 2} color="var(--primary)" />
                </div>
              </div>
              {injured ? (
                <span className="badge warn" style={{ marginLeft: "auto" }}>INJ</span>
              ) : (
                <span className="badge active" style={{ marginLeft: "auto" }}>Active</span>
              )}
              <div className="ovr" style={{ marginLeft: 16 }}>
                {p.age ?? "?"}
                <small>AGE</small>
              </div>
              <div className="ovr" style={{ marginLeft: 8 }}>
                {overall(p)}
                <small>OVR</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
