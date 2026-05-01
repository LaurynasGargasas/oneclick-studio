-- Initial schema for Seedance Studio
-- Author: Seedance Studio
-- Description: projects, elements (with images), generations (with element links), settings

------------------------------------------------------------
-- Projects (folders)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  cover_image     TEXT,
  color_accent    TEXT NOT NULL DEFAULT '#00f0ff',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);

------------------------------------------------------------
-- Elements (reusable references)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS elements (
  id              TEXT PRIMARY KEY,
  tag             TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL,
  type            TEXT NOT NULL CHECK(type IN ('character','prop','location','style','other')),
  description     TEXT,
  thumbnail       TEXT,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_elements_tag ON elements(tag);
CREATE INDEX IF NOT EXISTS idx_elements_type ON elements(type);
CREATE INDEX IF NOT EXISTS idx_elements_updated_at ON elements(updated_at DESC);

------------------------------------------------------------
-- Element images (1-9 per element, mirroring the Seedance image cap)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS element_images (
  id              TEXT PRIMARY KEY,
  element_id      TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  file_path       TEXT NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  width           INTEGER,
  height          INTEGER,
  created_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_element_images_element ON element_images(element_id, sort_order);

------------------------------------------------------------
-- Generations
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generations (
  id              TEXT PRIMARY KEY,
  project_id      TEXT REFERENCES projects(id) ON DELETE SET NULL,
  prompt_raw      TEXT NOT NULL,
  prompt_resolved TEXT NOT NULL,
  duration_s      INTEGER NOT NULL,
  resolution      TEXT NOT NULL,
  aspect_ratio    TEXT NOT NULL,
  quality         TEXT NOT NULL,
  seed            INTEGER,
  camera_fixed    INTEGER NOT NULL DEFAULT 0,
  watermark       INTEGER NOT NULL DEFAULT 0,
  audio_enabled   INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL CHECK(status IN ('pending','processing','completed','failed')),
  task_id         TEXT,
  video_path      TEXT,
  thumbnail_path  TEXT,
  error_message   TEXT,
  cost_credits    REAL,
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_project ON generations(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_task_id ON generations(task_id);

------------------------------------------------------------
-- Many-to-many: which elements a generation used
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS generation_elements (
  generation_id   TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
  element_id      TEXT NOT NULL REFERENCES elements(id) ON DELETE CASCADE,
  role            TEXT,
  PRIMARY KEY (generation_id, element_id)
);

------------------------------------------------------------
-- Settings (key/value)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key             TEXT PRIMARY KEY,
  value           TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('api_endpoint', 'https://ark.ap-southeast.bytepluses.com/api/v3'),
  ('api_key', ''),
  ('default_resolution', '720p'),
  ('default_duration', '6'),
  ('default_aspect_ratio', '16:9'),
  ('default_quality', 'standard'),
  ('theme_accent', '#00f0ff'),
  ('animation_intensity', 'full');
