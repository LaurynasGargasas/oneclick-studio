-- Pin / favorite a landing page so it surfaces at the top of the list.
ALTER TABLE landing_pages ADD COLUMN starred INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_landing_pages_starred
  ON landing_pages(starred DESC, updated_at DESC);
