ALTER TABLE raw_reddit_posts
ADD COLUMN IF NOT EXISTS selftext text;
