-- Add model_id to settings so users can configure which Seedance variant to use
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('model_id', 'seedance-1-0-lite-t2v-250528');
