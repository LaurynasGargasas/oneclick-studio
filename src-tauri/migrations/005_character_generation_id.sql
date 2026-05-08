-- The Character Creator now fires 4 separate single-image jobs per click
-- (for diversity), so each image has its own batch_id (= Higgsfield job-set id).
-- We add `generation_id` to group those 4 images together as one user-facing
-- "generation" in the History view.
ALTER TABLE characters ADD COLUMN generation_id TEXT;
CREATE INDEX IF NOT EXISTS idx_characters_generation ON characters (generation_id);
