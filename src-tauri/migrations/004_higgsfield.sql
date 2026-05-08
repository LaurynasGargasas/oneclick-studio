-- Higgsfield (Soul 2.0) credentials for the Character Creator
INSERT OR IGNORE INTO settings (key, value) VALUES ('higgsfield_api_key', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('higgsfield_api_secret', '');

-- Local history of generated character batches.
-- One row per individual image (4 per generation).
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  batch_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  options_json TEXT NOT NULL,    -- snapshot of selected options
  image_url TEXT,                -- remote Higgsfield CDN url
  status TEXT NOT NULL,          -- queued | in_progress | completed | failed | nsfw
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_characters_batch ON characters (batch_id);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON characters (created_at DESC);
