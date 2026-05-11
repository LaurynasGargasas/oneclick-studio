-- User-saved landing-page presets.  Distinct from the 5 built-in presets
-- bundled with the app — those live in code under
-- src/components/landing/presets/html/.
CREATE TABLE IF NOT EXISTS landing_presets (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  css_family      TEXT,              -- "advertorial" | "ten-reasons" | "ranking" | NULL
  html            TEXT NOT NULL,
  thumbnail_src   TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_landing_presets_updated
  ON landing_presets(updated_at DESC);
