ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
ADD COLUMN IF NOT EXISTS featured boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ideas_deleted_at ON ideas (deleted_at);
