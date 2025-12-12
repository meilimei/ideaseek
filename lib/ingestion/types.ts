export type IngestionSource = 'reddit' | 'youtube' | 'trends';

export type IngestionStatus = 'running' | 'success' | 'error' | 'partial';

export type RawRedditPostPayload = {
  id: string; // reddit post id
  title: string;
  selftext?: string; // body text for text posts
  url?: string; // external url (for link posts)
  score?: number;
  num_comments?: number;
  created_utc?: number; // unix timestamp in seconds
  subreddit: string;
  author?: string;
  [key: string]: any; // allow extra fields
};

export type RawYouTubeVideoPayload = {
  id: string;
  snippet: {
    channelId: string;
    channelTitle?: string;
    title: string;
    description?: string;
    publishedAt?: string;
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
  [key: string]: any;
};

export type IngestionRunContext = {
  id: number | null; // ingestion_runs.id after inserting
  source: IngestionSource;
  strategyName: string;
  startedAt: Date;
};
