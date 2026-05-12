-- Seed an empty `anthropic_api_key` row in settings so the UI has a
-- canonical place to write to.  The key is set via the Settings page;
-- the API client reads it from this row each call (no caching).
INSERT OR IGNORE INTO settings (key, value) VALUES ('anthropic_api_key', '');
