-- ─── Databases ───────────────────────────────────────────────────────────────
CREATE DATABASE betbuddy;
CREATE DATABASE vinoreveal;
CREATE DATABASE authelia;

-- ─── BetBuddy Schema ─────────────────────────────────────────────────────────
\c betbuddy

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  uid                       TEXT PRIMARY KEY,
  display_name              TEXT NOT NULL,
  display_name_lower        TEXT NOT NULL,
  balance                   INTEGER DEFAULT 1000 NOT NULL,
  wins                      INTEGER DEFAULT 0 NOT NULL,
  losses                    INTEGER DEFAULT 0 NOT NULL,
  theme                     TEXT DEFAULT 'brutal-flat',
  photo_url                 TEXT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  last_bet_resolved_at      TIMESTAMPTZ,
  last_challenge_deduction_at BIGINT
);

CREATE TABLE bets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id           TEXT NOT NULL,
  creator_name         TEXT NOT NULL,
  title                TEXT NOT NULL,
  description          TEXT,
  status               TEXT DEFAULT 'pending' NOT NULL,
  outcomes             TEXT[] NOT NULL,
  total_pot            INTEGER DEFAULT 0 NOT NULL,
  winner_outcome_index INTEGER,
  invited_user_ids     TEXT[] DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  resolved_at          TIMESTAMPTZ
);

CREATE TABLE bet_participants (
  bet_id        UUID REFERENCES bets(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL,
  user_name     TEXT NOT NULL,
  outcome_index INTEGER NOT NULL,
  stake         INTEGER NOT NULL,
  PRIMARY KEY (bet_id, user_id)
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  bet_id     UUID,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  user_name    TEXT NOT NULL,
  type         TEXT NOT NULL,
  bet_id       UUID,
  bet_title    TEXT,
  amount       INTEGER,
  outcome_name TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE feature_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  user_name   TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT DEFAULT '',
  status      TEXT DEFAULT 'pending',
  upvotes     TEXT[] DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO system_settings (key, value) VALUES
  ('challengeMode', '{"isActive": false, "activatedAt": null, "challengerBalance": 0}');

CREATE INDEX idx_bets_status     ON bets(status);
CREATE INDEX idx_bets_created    ON bets(created_at DESC);
CREATE INDEX idx_notif_user      ON notifications(user_id, created_at DESC);
CREATE INDEX idx_activity_time   ON activities(created_at DESC);
CREATE INDEX idx_users_name_lower ON users(display_name_lower);

-- ─── VinoReveal Schema ────────────────────────────────────────────────────────
\c vinoreveal

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id    TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  created_by  TEXT NOT NULL,
  status      TEXT DEFAULT 'active',
  summary     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE session_participants (
  session_id   UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL,
  display_name TEXT NOT NULL,
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE wines (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name          TEXT,
  label         TEXT NOT NULL,
  grape_variety TEXT,
  price         NUMERIC,
  vintage       INTEGER,
  region        TEXT,
  revealed      BOOLEAN DEFAULT false,
  analysis      TEXT,
  research      TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ratings (
  id               TEXT PRIMARY KEY,
  wine_id          UUID REFERENCES wines(id) ON DELETE CASCADE,
  user_id          TEXT NOT NULL,
  score            INTEGER,
  comment          TEXT,
  guessed_grape    TEXT,
  guessed_price    NUMERIC,
  guessed_vintage  INTEGER,
  guessed_region   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL,
  anonymous_name TEXT NOT NULL,
  content        TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_short   ON sessions(short_id);
CREATE INDEX idx_wines_session    ON wines(session_id);
CREATE INDEX idx_ratings_wine     ON ratings(wine_id);
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
