# International Basketball Manager — Engine Core

A *Football Manager*-style engine for **international / European basketball**.
Unlike an NBA simulator, this models multi-competition calendars, foreign-player
registration quotas, FIBA timing (40-minute games, 24-second shot clock), and
Financial Fair Play instead of a salary cap.

This repository currently contains the **verifiable engine core** — the pure,
deterministic, fully-tested foundation the rest of the game (UI, persistence,
season loop) builds on. It has **no UI or database dependency** and runs
anywhere TypeScript runs (Next.js route, Expo app, worker, or CLI).

## What's here

| Area | File | Notes |
| --- | --- | --- |
| Match engine | `src/engine/MatchEngine.ts` | Possession-by-possession Markov simulation on a 24s shot clock. Outputs a box score + compressed event stream. Fully deterministic. |
| Probability model | `src/engine/probability.ts` | Logistic offense-vs-defense matchup model, fatigue and clutch modifiers. |
| Roster quotas | `src/rosters/quotas.ts` | Declarative "foreigner rules" per league (ACB homegrown minimum, Israeli foreign cap, EuroLeague, generic). |
| Roster validation | `src/rosters/validation.ts` | Middleware-style checker returning a structured violation report. |
| Domain types | `src/types.ts` | `Player`, `Team`, `Tactics`, `TeamBoxScore`, `MatchEvent`, … |
| Deterministic RNG | `src/rng.ts` | Seedable `mulberry32`; no `Math.random()` anywhere in the sim. |
| Sample data | `src/data/sampleTeams.ts` | Reproducible team factory for demos/tests. |
| Database schema | `db/schema.sql` | PostgreSQL / Supabase DDL: teams, players, competitions, fixtures, registrations, FIBA windows, game stats. |

## Quick start

```bash
npm install
npm test          # 29 unit tests (engine determinism, box-score integrity, quotas)
npm run typecheck # strict TypeScript, no emit
npm run demo      # simulate one match + roster checks, printed to stdout
```

## Using the engine

```ts
import { MatchEngine, makeSampleTeam } from "./src/index.js";

const home = makeSampleTeam({ id: "RMB", name: "Real Madrid", country: "ESP", seed: 101, strength: 15 });
const away = makeSampleTeam({ id: "MTA", name: "Maccabi Tel Aviv", country: "ISR", seed: 202, strength: 14 });

// Same seed + same inputs => identical result, every time.
const result = MatchEngine.simulate({ home, away, seed: 20260626 });
console.log(result.home.points, "-", result.away.points);
```

### Roster quota validation

```ts
import { LEAGUE_QUOTAS, validateTeamRoster } from "./src/index.js";

const report = validateTeamRoster(realMadrid, LEAGUE_QUOTAS.ESP_ACB);
// report.valid, report.violations[], report.summary { foreign, homegrown, rosterSize }
```

Dual nationals count as local if **either** passport matches the league country.
Homegrown status is a registration property, independent of nationality.

## Design notes

- **Determinism first.** All randomness flows through a seeded `Rng`. A fixture's
  `sim_seed` (see `db/schema.sql`) makes any match re-simulate identically — vital
  for reproducibility, debugging, and the test suite.
- **Matchup probabilities, not coin flips.** Each shot is an offense-vs-defense
  contest mapped through a logistic curve around a realistic FIBA baseline, then
  modified by fatigue and (late, close games) clutch.
- **Decoupled layers.** The engine knows nothing about the UI or DB, per the
  architectural spec. Persistence maps `db/schema.sql` rows onto `src/types.ts`.

## Roadmap (not yet built)

The engine core is the foundation. Still to come from the blueprint:

1. **Season loop** — multi-competition scheduler (domestic + continental + cup)
   that pauses club fixtures during FIBA international windows.
2. **Financial model** — payroll budgeting + FFP wage-ratio enforcement.
3. **Persistence layer** — Supabase/PostgreSQL wiring against `db/schema.sql`,
   with a Redis/in-memory live-tick cache for game days.
4. **Mobile-first UI** — Roster, Tactics board, Transfer/Scouting hub, and a
   live text Match Day viewer.
