-- v0.1.7 — persist the user's preferred aspect ratio for the Character
-- Creator so it survives app restarts.  Defaults to "9:16" (hero-shot
-- portrait, matching the Soul V2 endpoint default in character.rs).
INSERT OR IGNORE INTO settings (key, value) VALUES ('character_aspect_ratio', '9:16');
