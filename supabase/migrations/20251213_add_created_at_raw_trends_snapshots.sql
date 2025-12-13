-- Add created_at for raw_trends_snapshots if missing
ALTER TABLE raw_trends_snapshots
ADD COLUMN IF NOT EXISTS created_at timestamptz;

-- Backfill created_at from snapshot_key (format: source|geo|timeframe|keyword|YYYY-MM-DD)
UPDATE raw_trends_snapshots
SET created_at =
  ((split_part(snapshot_key, '|', 5))::date)::timestamptz
WHERE created_at IS NULL
  AND snapshot_key LIKE '%|____-__-__';

-- Default any remaining nulls to now()
UPDATE raw_trends_snapshots
SET created_at = NOW()
WHERE created_at IS NULL;

-- Index for recent ordering
CREATE INDEX IF NOT EXISTS idx_raw_trends_snapshots_created_at
ON raw_trends_snapshots (created_at DESC);
