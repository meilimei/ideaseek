-- Ensure featured column exists for ideas
ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

UPDATE ideas
SET featured = false
WHERE featured IS NULL;

CREATE INDEX IF NOT EXISTS idx_ideas_featured ON ideas (featured);
