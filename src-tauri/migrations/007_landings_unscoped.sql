-- Decouple landing pages from projects.  The landings module is now its
-- own top-level concept (separate sidebar item) instead of being scoped
-- under a Project.  We rebuild the table without project_id.

CREATE TABLE IF NOT EXISTS landing_pages_new (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  preset_id       TEXT NOT NULL,
  doc_json        TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO landing_pages_new (id, name, preset_id, doc_json, created_at, updated_at)
  SELECT id, name, preset_id, doc_json, created_at, updated_at FROM landing_pages;

DROP TABLE landing_pages;
ALTER TABLE landing_pages_new RENAME TO landing_pages;

CREATE INDEX IF NOT EXISTS idx_landing_pages_updated
  ON landing_pages(updated_at DESC);
