ALTER TABLE raw_trends_snapshots
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_raw_trends_snapshots_deleted_at
  ON raw_trends_snapshots (is_deleted, deleted_at DESC);
