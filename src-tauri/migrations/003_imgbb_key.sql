-- Add imgbb API key for public image hosting (used to bypass BytePlus content moderation)
INSERT OR IGNORE INTO settings (key, value) VALUES ('imgbb_api_key', '');
