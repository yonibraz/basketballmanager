-- =============================================================================
-- International Basketball Manager — PostgreSQL / Supabase schema
-- =============================================================================
-- Source of truth for database initialisation. Extends the blueprint DDL with
-- the relational pieces the engine needs: competitions, league quota rules,
-- registrations, fixtures across multiple concurrent tournaments, and FIBA
-- international windows.
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid()).
--   * Country codes are ISO-3166 alpha-3 (e.g. 'ESP', 'ISR').
--   * Attributes are on a 1-20 scale; reputation on a 1-10000 scale.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Competitions (domestic leagues, continental cups, national cups)
-- -----------------------------------------------------------------------------
CREATE TABLE competitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    -- 'domestic_league' | 'continental' | 'national_cup'
    type            VARCHAR(32)  NOT NULL,
    country         VARCHAR(3),               -- NULL for continental competitions
    -- Identifier into the engine's quota catalogue (e.g. 'ESP_ACB').
    quota_rule_id   VARCHAR(64),
    reputation      INT CHECK (reputation BETWEEN 1 AND 10000)
);

-- -----------------------------------------------------------------------------
-- Teams
-- -----------------------------------------------------------------------------
CREATE TABLE teams (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                   VARCHAR(255) NOT NULL,
    country                VARCHAR(3) NOT NULL,           -- ISO code for quota tracking
    domestic_league_id     UUID REFERENCES competitions(id),
    continental_league_id  UUID REFERENCES competitions(id),
    budget_payroll         INT NOT NULL,
    transfer_budget        INT NOT NULL,
    -- Financial Fair Play: wages may not exceed this share of revenue.
    revenue                INT NOT NULL DEFAULT 0,
    ffp_wage_ratio_cap     NUMERIC(4,3) NOT NULL DEFAULT 0.650,
    reputation             INT CHECK (reputation BETWEEN 1 AND 10000)
);

-- -----------------------------------------------------------------------------
-- Players (extends the blueprint attribute set)
-- -----------------------------------------------------------------------------
CREATE TABLE players (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id            UUID REFERENCES teams(id) ON DELETE SET NULL,
    first_name         VARCHAR(100),
    last_name          VARCHAR(100),
    nationality        VARCHAR(3) NOT NULL,
    second_nationality VARCHAR(3),
    age                INT,
    -- 'PG' | 'SG' | 'SF' | 'PF' | 'C'
    position           VARCHAR(2),
    -- Locally-trained status, relevant to homegrown quotas. Distinct from
    -- nationality: a foreign passport holder trained locally is still homegrown.
    homegrown          BOOLEAN NOT NULL DEFAULT FALSE,

    -- Technical / Physical / Mental attributes (1-20 scale)
    shooting_inside    INT, shooting_outside INT, playmaking INT,
    def_perimeter      INT, def_interior     INT, rebounding INT,
    pace               INT, strength         INT, stamina    INT,
    bball_iq           INT, leadership       INT, clutch     INT,

    -- Contract details
    salary             INT,
    contract_expires   DATE,
    market_value       INT
);

CREATE INDEX idx_players_team ON players(team_id);

-- -----------------------------------------------------------------------------
-- Game-day roster registration (per competition)
-- -----------------------------------------------------------------------------
-- A player is registered to play in a specific competition for a team. The
-- engine's validateRoster() runs over the set of players registered here.
CREATE TABLE roster_registrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    competition_id  UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    player_id       UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    registered_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (competition_id, player_id)
);

-- -----------------------------------------------------------------------------
-- Fixtures (multi-tournament calendar)
-- -----------------------------------------------------------------------------
CREATE TABLE fixtures (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id  UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    home_team_id    UUID NOT NULL REFERENCES teams(id),
    away_team_id    UUID NOT NULL REFERENCES teams(id),
    scheduled_at    TIMESTAMPTZ NOT NULL,
    -- 'scheduled' | 'live' | 'final' | 'postponed'
    status          VARCHAR(16) NOT NULL DEFAULT 'scheduled',
    home_score      INT,
    away_score      INT,
    -- Deterministic seed used by MatchEngine so a fixture re-simulates identically.
    sim_seed        BIGINT,
    -- Compressed event stream + box score persisted after simulation.
    result_json     JSONB,
    CHECK (home_team_id <> away_team_id)
);

CREATE INDEX idx_fixtures_competition ON fixtures(competition_id);
CREATE INDEX idx_fixtures_schedule ON fixtures(scheduled_at);

-- -----------------------------------------------------------------------------
-- FIBA international windows (club competitions pause during these)
-- -----------------------------------------------------------------------------
CREATE TABLE international_windows (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,   -- e.g. 'February Window 2026'
    starts_on   DATE NOT NULL,
    ends_on     DATE NOT NULL,
    CHECK (ends_on >= starts_on)
);

-- -----------------------------------------------------------------------------
-- Persisted player game stats (box score rows, for histories)
-- -----------------------------------------------------------------------------
CREATE TABLE player_game_stats (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fixture_id            UUID NOT NULL REFERENCES fixtures(id) ON DELETE CASCADE,
    player_id             UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id               UUID NOT NULL REFERENCES teams(id),
    seconds_played        INT NOT NULL DEFAULT 0,
    points                INT NOT NULL DEFAULT 0,
    field_goals_made      INT NOT NULL DEFAULT 0,
    field_goals_attempted INT NOT NULL DEFAULT 0,
    three_made            INT NOT NULL DEFAULT 0,
    three_attempted       INT NOT NULL DEFAULT 0,
    free_throws_made      INT NOT NULL DEFAULT 0,
    free_throws_attempted INT NOT NULL DEFAULT 0,
    offensive_rebounds    INT NOT NULL DEFAULT 0,
    defensive_rebounds    INT NOT NULL DEFAULT 0,
    assists               INT NOT NULL DEFAULT 0,
    steals                INT NOT NULL DEFAULT 0,
    turnovers             INT NOT NULL DEFAULT 0,
    blocks                INT NOT NULL DEFAULT 0,
    fouls                 INT NOT NULL DEFAULT 0,
    UNIQUE (fixture_id, player_id)
);

CREATE INDEX idx_pgs_player ON player_game_stats(player_id);
