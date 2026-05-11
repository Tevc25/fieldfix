-- FieldFix SQLite schema
-- Shared across all three server variants (Node, Bun, Deno)
-- Each variant maintains its own copy of the database file

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,               -- UUID v4
  client_id   TEXT NOT NULL UNIQUE,           -- UUID generated client-side; prevents duplicates on retry
  title       TEXT NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  category    TEXT NOT NULL CHECK (category IN (
                'pothole',
                'broken_streetlight',
                'graffiti',
                'illegal_dumping',
                'damaged_sign',
                'other'
              )),
  description TEXT NOT NULL CHECK (length(description) BETWEEN 10 AND 2000),
  lat         REAL NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng         REAL NOT NULL CHECK (lng BETWEEN -180 AND 180),
  address     TEXT,
  photo_url   TEXT,
  status      TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN (
                'submitted',
                'in_review',
                'resolved',
                'rejected'
              )),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_reports_status    ON reports (status);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON reports (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_location  ON reports (lat, lng);

-- ---------------------------------------------------------------------------
-- status_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS status_history (
  id          TEXT PRIMARY KEY,
  report_id   TEXT NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
  status      TEXT NOT NULL CHECK (status IN (
                'submitted',
                'in_review',
                'resolved',
                'rejected'
              )),
  note        TEXT,
  changed_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_history_report ON status_history (report_id);

-- ---------------------------------------------------------------------------
-- subscriptions (Web Push / VAPID)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint_hash TEXT PRIMARY KEY,   -- SHA-256(endpoint) hex — used as stable identifier
  endpoint      TEXT NOT NULL UNIQUE,
  p256dh        TEXT NOT NULL,
  auth          TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current on every reports UPDATE
-- ---------------------------------------------------------------------------
CREATE TRIGGER IF NOT EXISTS reports_updated_at
  AFTER UPDATE ON reports
  FOR EACH ROW
BEGIN
  UPDATE reports SET updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  WHERE id = NEW.id;
END;
