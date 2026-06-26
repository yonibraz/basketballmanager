/**
 * Demo runner: simulates one match between two sample teams, prints the box
 * score and a short play-by-play, and runs a roster-quota check. Run with:
 *
 *   npm run demo
 */

import { MatchEngine } from "../src/engine/MatchEngine.js";
import { makeSampleTeam } from "../src/data/sampleTeams.js";
import { LEAGUE_QUOTAS } from "../src/rosters/quotas.js";
import { validateTeamRoster } from "../src/rosters/validation.js";
import type { MatchEvent, TeamBoxScore } from "../src/types.js";

const home = makeSampleTeam({
  id: "RMB", name: "Real Madrid", country: "ESP", seed: 101, strength: 15, foreignCount: 4, homegrownCount: 5,
});
const away = makeSampleTeam({
  id: "MTA", name: "Maccabi Tel Aviv", country: "ISR", seed: 202, strength: 14, foreignCount: 5, homegrownCount: 4,
});

// --- Roster compliance --------------------------------------------------------
const acb = validateTeamRoster(home, LEAGUE_QUOTAS.ESP_ACB!);
const isr = validateTeamRoster(away, LEAGUE_QUOTAS.ISR_BSL!);
console.log("Roster checks");
console.log(`  ${home.name} (ACB):`, acb.valid ? "OK" : acb.violations.map((v) => v.message).join("; "),
  `[foreign ${acb.summary.foreign}, homegrown ${acb.summary.homegrown}]`);
console.log(`  ${away.name} (ISR):`, isr.valid ? "OK" : isr.violations.map((v) => v.message).join("; "),
  `[foreign ${isr.summary.foreign}, homegrown ${isr.summary.homegrown}]`);
console.log();

// --- Simulate -----------------------------------------------------------------
const result = MatchEngine.simulate({ home, away, seed: 20260626 });

function line(box: TeamBoxScore): void {
  console.log(`\n${box.teamName} — ${box.points}`);
  console.log("  PLAYER            MIN  PTS  FG    3PT   FT   REB AST STL BLK TO");
  for (const p of [...box.players].sort((a, b) => b.points - a.points).slice(0, 8)) {
    const reb = p.offensiveRebounds + p.defensiveRebounds;
    const min = Math.round(p.secondsPlayed / 60);
    console.log(
      `  ${p.name.padEnd(16)} ${String(min).padStart(3)} ${String(p.points).padStart(4)}` +
        `  ${p.fieldGoalsMade}/${p.fieldGoalsAttempted}`.padEnd(7) +
        ` ${p.threePointersMade}/${p.threePointersAttempted}`.padEnd(6) +
        ` ${p.freeThrowsMade}/${p.freeThrowsAttempted}`.padEnd(5) +
        ` ${String(reb).padStart(3)} ${String(p.assists).padStart(3)} ${String(p.steals).padStart(3)}` +
        ` ${String(p.blocks).padStart(3)} ${String(p.turnovers).padStart(2)}`,
    );
  }
}

const winner = result.home.points > result.away.points ? result.home : result.away;
console.log(
  `FINAL${result.overtime ? " (OT)" : ""}: ${result.home.teamName} ${result.home.points} — ` +
    `${result.away.points} ${result.away.teamName}  |  winner: ${winner.teamName}  |  ${result.periods} periods`,
);
line(result.home);
line(result.away);

// --- Sample play-by-play ------------------------------------------------------
console.log("\nLast plays:");
const scoring = (e: MatchEvent) => e.type === "made-fg" || e.type === "free-throw";
for (const e of result.events.filter(scoring).slice(-6)) {
  const team = e.teamId === home.id ? home : away;
  const p = team.players.find((x) => x.id === e.playerId);
  const mm = Math.floor(e.clock / 60);
  const ss = String(e.clock % 60).padStart(2, "0");
  console.log(`  Q${e.period} ${mm}:${ss}  ${p?.lastName ?? "?"} ${e.type === "made-fg" ? `+${e.points} (${e.detail})` : "free throw"}`);
}
console.log(`\nTotal events: ${result.events.length}`);
