"use client";

import type { MatchEvent, TeamBoxScore } from "@/src/types";

/** Event types worth surfacing in the play-by-play feed. */
export const DISPLAYABLE = new Set<MatchEvent["type"]>([
  "made-fg",
  "free-throw",
  "turnover",
  "steal",
  "block",
  "substitution",
  "timeout",
  "period-end",
  "final",
]);

export function isShown(e: MatchEvent): boolean {
  if (!DISPLAYABLE.has(e.type)) return false;
  if (e.type === "free-throw") return e.detail === "make"; // only made FTs
  return true;
}

/** Render a single feed event into display text + a CSS modifier class. */
export function describe(e: MatchEvent, name: string): { text: string; cls: string } {
  switch (e.type) {
    case "made-fg":
      return { text: `${name} scores ${e.points} (${e.detail})`, cls: "score" };
    case "free-throw":
      return { text: `${name} makes a free throw`, cls: "score" };
    case "turnover":
      return { text: `${name} turns it over`, cls: "bad" };
    case "steal":
      return { text: `${name} steals it`, cls: "" };
    case "block":
      return { text: `${name} blocks the shot`, cls: "" };
    case "substitution":
      return { text: `Substitution: ${name} ${e.detail ?? ""}`, cls: "bad" };
    case "timeout":
      return { text: "Timeout called", cls: "timeout" };
    case "period-end":
      return { text: `— End of ${e.period <= 4 ? `Q${e.period}` : `OT${e.period - 4}`} —`, cls: "bad" };
    case "final":
      return { text: "— Final buzzer —", cls: "bad" };
    default:
      return { text: e.type, cls: "" };
  }
}

/** Compact per-team box score for the post-game screen. */
export function BoxTable({ box, userId }: { box: TeamBoxScore; userId: string }) {
  const players = [...box.players]
    .filter((p) => p.secondsPlayed > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 6);
  return (
    <div className="card tight">
      <div className="spread" style={{ marginBottom: 4 }}>
        <strong style={{ color: box.teamId === userId ? "var(--accent)" : undefined }}>{box.teamName}</strong>
        <strong>{box.points}</strong>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Player</th>
            <th>PTS</th>
            <th>REB</th>
            <th>AST</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId}>
              <td style={{ textAlign: "left" }}>{p.name}</td>
              <td>{p.points}</td>
              <td>{p.offensiveRebounds + p.defensiveRebounds}</td>
              <td>{p.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
