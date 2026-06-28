"use client";

import { useState } from "react";
import type { FreeAgent } from "@/lib/market";
import type { Team } from "@/src/types";
import { overall } from "@/lib/ratings";

interface Props {
  freeAgents: FreeAgent[];
  userTeam: Team;
  budget: number;
  onSign: (fa: FreeAgent) => string | null;
  onRelease: (playerId: string) => void;
}

export function Market({ freeAgents, userTeam, budget, onSign, onRelease }: Props) {
  const [error, setError] = useState<string | null>(null);

  function handleSign(fa: FreeAgent) {
    const err = onSign(fa);
    setError(err);
  }

  function handleRelease(playerId: string) {
    setError(null);
    onRelease(playerId);
  }

  const sortedAgents = [...freeAgents].sort((a, b) => overall(b) - overall(a));
  const sortedRoster = [...userTeam.players].sort((a, b) => overall(b) - overall(a));

  return (
    <div className="screen">
      <div className="spread" style={{ marginBottom: 16 }}>
        <h2>Transfer Market</h2>
        <span className="badge ok" style={{ fontSize: 15, padding: "4px 12px" }}>
          Budget: £{budget}M
        </span>
      </div>

      {error && (
        <div
          className="card"
          style={{ background: "var(--red-bg)", color: "var(--red)", marginBottom: 12, padding: "10px 16px" }}
        >
          {error}
        </div>
      )}

      {/* Your Squad */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h3 style={{ fontWeight: 700 }}>Your Squad</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            {userTeam.players.length} / 12 players
          </span>
        </div>
        {sortedRoster.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No players on roster.
          </p>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>OVR</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((p) => {
                const atMinRoster = userTeam.players.length <= 5;
                return (
                  <tr key={p.id}>
                    <td>
                      {p.firstName} {p.lastName}
                    </td>
                    <td>
                      <span className="pos-tag">{p.position}</span>
                    </td>
                    <td>
                      <strong>{overall(p)}</strong>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleRelease(p.id)}
                        disabled={atMinRoster}
                        title={atMinRoster ? "Cannot release — minimum 5 players required" : "Release player (+£3M)"}
                        style={{ opacity: atMinRoster ? 0.45 : 1 }}
                      >
                        Release · £3M
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Free Agents */}
      <div className="card">
        <div className="spread" style={{ marginBottom: 12 }}>
          <h3 style={{ fontWeight: 700 }}>Free Agents</h3>
          <span className="muted" style={{ fontSize: 12 }}>
            {freeAgents.length} available
          </span>
        </div>
        {sortedAgents.length === 0 ? (
          <p className="muted" style={{ fontSize: 13 }}>
            No free agents available.
          </p>
        ) : (
          <table className="table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Pos</th>
                <th>Nat</th>
                <th>OVR</th>
                <th>Price</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((fa) => {
                const canAfford = budget >= fa.askingPrice;
                const rosterFull = userTeam.players.length >= 12;
                const disabled = !canAfford || rosterFull;
                return (
                  <tr key={fa.id}>
                    <td>
                      {fa.firstName} {fa.lastName}
                    </td>
                    <td>
                      <span className="pos-tag">{fa.position}</span>
                    </td>
                    <td>
                      <span className="muted">{fa.nationality}</span>
                    </td>
                    <td>
                      <strong>{overall(fa)}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-data)",
                          color: canAfford ? "var(--green)" : "var(--red)",
                          fontWeight: 600,
                        }}
                      >
                        £{fa.askingPrice}M
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => handleSign(fa)}
                        disabled={disabled}
                        title={
                          rosterFull
                            ? "Roster full — release a player first"
                            : !canAfford
                              ? `Need £${fa.askingPrice}M (have £${budget}M)`
                              : `Sign for £${fa.askingPrice}M`
                        }
                        style={{ opacity: disabled ? 0.45 : 1 }}
                      >
                        Sign
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
