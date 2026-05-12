-- v0.1.7 — persist the user's preferred image count for the Character
-- Creator (1–4 images per generation).  Defaults to "4" to preserve the
-- pre-v0.1.7 behavior of generating a 2x2 grid each click.  Stored as a
-- string for simplicity; parsed/clamped to 1..=4 at use time.
INSERT OR IGNORE INTO settings (key, value) VALUES ('character_count', '4');
