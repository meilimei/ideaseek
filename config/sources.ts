export type RedditStrategyConfig = {
  name: string;
  subreddits: string[];
  keywords: string[];
  minScore: number;
  maxPostsPerRun: number;
};

export type YouTubeStrategyConfig = {
  name: string;
  query: string;
  minViews: number;
  maxVideosPerRun: number;
};

export type TrendsStrategyConfig = {
  name: string;
  keywords: string[];
  geo?: string;
  timeframe?: string;
};

export const REDDIT_STRATEGIES: RedditStrategyConfig[] = [
  {
    name: 'indie-saas-painpoints',
    subreddits: ['Entrepreneur', 'IndieHackers', 'SaaS'],
    keywords: ['any idea how to', 'how do I', 'struggle with'],
    minScore: 5,
    maxPostsPerRun: 80,
  },
  {
    name: 'ai-tools-for-creators',
    subreddits: ['ArtificialIntelligence', 'ContentCreators', 'YouTube'],
    keywords: ['recommend tool', 'ai tool', 'workflow', 'automation'],
    minScore: 3,
    maxPostsPerRun: 60,
  },
];

export const YOUTUBE_STRATEGIES: YouTubeStrategyConfig[] = [
  {
    name: 'ai-tools-search',
    query: 'ai tools for creators',
    minViews: 1000,
    maxVideosPerRun: 40,
  },
  {
    name: 'saas-ideas-search',
    query: 'saas ideas for developers',
    minViews: 500,
    maxVideosPerRun: 40,
  },
];

export const TRENDS_STRATEGIES: TrendsStrategyConfig[] = [
  {
    name: 'creator-economy',
    keywords: [
      'picture management software',
      'content scheduler',
      'video editing ai',
    ],
    geo: 'US',
    timeframe: 'today 12-m',
  },
  {
    name: 'ai-developer-tools',
    keywords: ['code assistant', 'ai code review'],
    geo: 'GLOBAL',
    timeframe: 'today 12-m',
  },
];
