-- Migration 0001: Course Trust Data Layer schema (per docs/HANDOFF-data-layer.md §4).
-- D1 is SQLite under the hood; this is plain SQL, no ORM.

CREATE TABLE courses (
  id TEXT PRIMARY KEY,            -- existing `code`, e.g. TX-1140
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  lat REAL, lng REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('content_file','pdga','udisc','osm','parks_dept','review','user_report','monitor','onsite')),
  url TEXT,
  trust REAL NOT NULL CHECK (trust BETWEEN 0 AND 1)
);

CREATE TABLE observations (
  id TEXT PRIMARY KEY,            -- ULID (or deterministic id; see seed script)
  course_id TEXT NOT NULL REFERENCES courses(id),
  field TEXT NOT NULL,            -- see field registry (worker/src/fields.ts)
  value TEXT NOT NULL,            -- JSON-encoded
  source_id TEXT NOT NULL REFERENCES sources(id),
  observed_at TEXT NOT NULL,      -- when it was true on the ground
  ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
  locked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_obs_course_field ON observations(course_id, field, observed_at DESC);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES courses(id),
  field TEXT NOT NULL,
  claimed_value TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE TABLE course_snapshot (
  course_id TEXT PRIMARY KEY REFERENCES courses(id),
  status TEXT NOT NULL,           -- active | partial | unplayable | removed | unverified
  holes_playable INTEGER,
  last_verified TEXT,
  freshness_days INTEGER,
  fields_json TEXT NOT NULL,
  conflicts_json TEXT NOT NULL,
  rubric_json TEXT,
  rating_recent REAL,
  rating_alltime REAL,
  ratings_to_reviews REAL,
  disc_loss_risk TEXT,            -- low | medium | high (resolver §6; exported as discLossRisk)
  flags_json TEXT NOT NULL,
  changelog_json TEXT NOT NULL,
  built_at TEXT NOT NULL
);
