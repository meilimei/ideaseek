-- 1) raw_reddit_posts additions
ALTER TABLE raw_reddit_posts
ADD COLUMN IF NOT EXISTS is_deleted boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS selected_for_idea boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS admin_note text;

-- 2) raw_trends_snapshots additions
ALTER TABLE raw_trends_snapshots
ADD COLUMN IF NOT EXISTS processed_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error text;

-- 3) ideas additions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'idea_status'
  ) THEN
    CREATE TYPE idea_status AS ENUM ('published', 'draft', 'archived');
  END IF;
END$$;

ALTER TABLE ideas
ADD COLUMN IF NOT EXISTS status idea_status DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS pinned boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS updated_at timestamptz;
