import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  type IngestionRunContext,
  type IngestionSource,
  type IngestionStatus,
  type RawYouTubeVideoPayload,
} from '../lib/ingestion/types';
import {
  getEnabledStrategiesOrDefault,
  type StrategyWithConfig,
} from '../lib/server/ingestStrategies';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

function ensureEnv(keys: string[]) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(
        ', ',
      )}. Populate them in .env.local before running.`,
    );
  }
}

ensureEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'YOUTUBE_API_KEY',
]);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type YoutubeConfig = {
  queries: string[];
  regionCode?: string;
  maxResults?: number;
  minViews?: number;
};

const DEFAULT_YOUTUBE_PIPELINES: Array<{
  strategyKey: string;
  name: string;
  config: YoutubeConfig;
}> = [
  {
    strategyKey: 'ai-tools-search',
    name: 'ai-tools-search',
    config: {
      queries: ['ai tools for creators'],
      regionCode: 'US',
      maxResults: 40,
      minViews: 1000,
    },
  },
  {
    strategyKey: 'saas-ideas-search',
    name: 'saas-ideas-search',
    config: {
      queries: ['saas ideas for developers'],
      regionCode: 'US',
      maxResults: 40,
      minViews: 500,
    },
  },
];

type YouTubeIngestStrategy = {
  id: string | null;
  strategyKey: string;
  name: string;
  queries: string[];
  regionCode?: string;
  maxResults: number;
  minViews: number;
};

async function fetchJson<T = any>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return (await res.json()) as T;
}

type YouTubeSearchItem = {
  id: { videoId?: string };
};

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
};

type YouTubeVideoItem = RawYouTubeVideoPayload;

type YouTubeVideosResponse = {
  items?: YouTubeVideoItem[];
};

async function fetchYouTubeVideosForStrategy(
  strategy: YouTubeIngestStrategy,
): Promise<YouTubeVideoItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY!;
  const maxResults = Math.min(strategy.maxResults, 50);
  const collected: YouTubeVideoItem[] = [];
  const seen = new Set<string>();

  for (const query of strategy.queries) {
    const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
    searchUrl.searchParams.set('key', apiKey);
    searchUrl.searchParams.set('part', 'snippet');
    searchUrl.searchParams.set('type', 'video');
    searchUrl.searchParams.set('order', 'viewCount');
    searchUrl.searchParams.set('q', query);
    searchUrl.searchParams.set('maxResults', String(maxResults));
    if (strategy.regionCode) {
      searchUrl.searchParams.set('regionCode', strategy.regionCode);
    }

    console.log(`[${strategy.strategyKey}] Searching YouTube for: ${query}`);
    const searchJson = await fetchJson<YouTubeSearchResponse>(
      searchUrl.toString(),
    );
    const videoIds = (searchJson.items ?? [])
      .map((item) => item.id.videoId)
      .filter((id): id is string => Boolean(id));

    if (videoIds.length === 0) {
      console.log(`[${strategy.strategyKey}] No videoIds found from search.`);
      continue;
    }

    const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
    videosUrl.searchParams.set('key', apiKey);
    videosUrl.searchParams.set('part', 'snippet,statistics');
    videosUrl.searchParams.set('id', videoIds.join(','));

    console.log(
      `[${strategy.strategyKey}] Fetching details for ${videoIds.length} videos`,
    );
    const videosJson = await fetchJson<YouTubeVideosResponse>(
      videosUrl.toString(),
    );

    for (const item of videosJson.items ?? []) {
      if (item.id && !seen.has(item.id)) {
        seen.add(item.id);
        collected.push(item);
      }
    }
  }

  return collected;
}

function filterVideosForStrategy(
  videos: YouTubeVideoItem[],
  strategy: YouTubeIngestStrategy,
): YouTubeVideoItem[] {
  const minViews = strategy.minViews;
  return videos.filter((video) => {
    const views = video.statistics?.viewCount
      ? parseInt(video.statistics.viewCount, 10)
      : 0;
    if (views < minViews) return false;
    const title = video.snippet?.title ?? '';
    return Boolean(title.trim());
  });
}

async function upsertRawYouTubeVideos(
  strategy: YouTubeIngestStrategy,
  videos: YouTubeVideoItem[],
): Promise<number> {
  if (videos.length === 0) return 0;

  const rows = videos.map((video) => {
    const stats = video.statistics ?? {};
    const views = stats.viewCount ? parseInt(stats.viewCount, 10) : null;
    const likes = stats.likeCount ? parseInt(stats.likeCount, 10) : null;
    const comments = stats.commentCount
      ? parseInt(stats.commentCount, 10)
      : null;

    return {
      video_id: video.id,
      channel_id: video.snippet.channelId,
      channel_title: video.snippet.channelTitle ?? null,
      title: video.snippet.title,
      description: video.snippet.description ?? null,
      url: `https://www.youtube.com/watch?v=${video.id}`,
      published_at: video.snippet.publishedAt ?? null,
      view_count: views,
      like_count: likes,
      comment_count: comments,
      strategy_name: strategy.name,
      ingest_strategy_id: strategy.id ?? null,
      raw_payload: video as RawYouTubeVideoPayload,
    };
  });

  const { error } = await supabase
    .from('raw_youtube_videos')
    .upsert(rows, { onConflict: 'video_id' });

  if (error) {
    console.error(
      `[${strategy.name}] Failed to upsert raw_youtube_videos:`,
      error.message,
    );
    throw error;
  }

  return rows.length;
}

async function startIngestionRun(
  source: IngestionSource,
  strategyName: string,
): Promise<IngestionRunContext> {
  const startedAt = new Date();
  const { data, error } = await supabase
    .from('ingestion_runs')
    .insert({
      source,
      strategy_name: strategyName,
      status: 'running',
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  return {
    id: data.id as number,
    source,
    strategyName,
    startedAt,
  };
}

async function finishIngestionRun(
  ctx: IngestionRunContext,
  status: IngestionStatus,
  counts: { raw?: number; ideas?: number; trends?: number },
  errorMessage?: string,
): Promise<void> {
  if (!ctx.id) return;
  const { error } = await supabase
    .from('ingestion_runs')
    .update({
      status,
      finished_at: new Date().toISOString(),
      raw_count: counts.raw ?? 0,
      idea_count: counts.ideas ?? 0,
      trend_count: counts.trends ?? 0,
      error_message: errorMessage ?? null,
    })
    .eq('id', ctx.id);

  if (error) {
    console.error('Failed to update ingestion_runs:', error);
  }
}

async function main() {
  console.log('--- Ingest YouTube raw → Supabase.raw_youtube_videos ---');

  ensureEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'YOUTUBE_API_KEY',
  ]);

  const strategies: StrategyWithConfig<YoutubeConfig>[] =
    await getEnabledStrategiesOrDefault<YoutubeConfig>(
      'youtube',
      DEFAULT_YOUTUBE_PIPELINES,
    );

  const youtubeStrategies: YouTubeIngestStrategy[] = strategies.map((s) => ({
    id: s.id,
    strategyKey: s.strategyKey,
    name: s.name,
    queries: s.config.queries ?? [],
    regionCode: s.config.regionCode ?? 'US',
    maxResults: s.config.maxResults ?? 25,
    minViews: s.config.minViews ?? 0,
  }));

  for (const strategy of youtubeStrategies) {
    const runCtx = await startIngestionRun('youtube', strategy.name);

    try {
      console.log(
        `[${strategy.strategyKey}] Starting ingestion for ${strategy.queries.length} quer${strategy.queries.length === 1 ? 'y' : 'ies'}`,
      );

      const videos = await fetchYouTubeVideosForStrategy(strategy);
      console.log(
        `[${strategy.strategyKey}] Fetched ${videos.length} videos from API`,
      );

      const filtered = filterVideosForStrategy(videos, strategy);
      console.log(
        `[${strategy.strategyKey}] Filtered to ${filtered.length} videos after minViews checks`,
      );

      const inserted = await upsertRawYouTubeVideos(strategy, filtered);
      console.log(
        `[${strategy.strategyKey}] Upserted ${inserted} raw YouTube videos successfully.`,
      );

      await finishIngestionRun(runCtx, 'success', {
        raw: inserted,
        ideas: 0,
        trends: 0,
      });
    } catch (err) {
      console.error(
        `[${strategy.name}] Error during YouTube ingestion:`,
        err,
      );
      await finishIngestionRun(
        runCtx,
        'error',
        { raw: 0, ideas: 0, trends: 0 },
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log('Done ingesting YouTube raw.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
