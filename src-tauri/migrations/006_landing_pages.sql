-- Landing Pages
-- One row per landing page authored inside a Project.  doc_json holds the
-- entire section tree (the source of truth — see src/lib/landingTypes.ts).
-- Image / gif / video file paths for drag-dropped media are stored inside
-- the slots inside doc_json; we don't keep a separate assets table at this
-- stage.  Orphan cleanup is a future concern.

CREATE TABLE IF NOT EXISTS landing_pages (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  preset_id       TEXT NOT NULL,
  doc_json        TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_landing_pages_project
  ON landing_pages(project_id, updated_at DESC);
