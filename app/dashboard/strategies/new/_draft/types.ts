export type StrategyDraft = {
  strategyId?: string;
  name?: string;
  source?: 'reddit' | 'youtube' | 'trends';
  track?: string;
  description?: string;
  subreddits?: string[];
  keywords?: string[];
  sort?: 'top' | 'new';
  timeRange?: 'day' | 'week' | 'month';
  limit?: number;
  signals?: {
    minUpvotes?: number;
    minComments?: number;
    maxAgeDays?: number;
  };
  cron?: string;
  active?: boolean;
};
