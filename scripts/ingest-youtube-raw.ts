import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import {
  YOUTUBE_STRATEGIES,
  type YouTubeStrategyConfig,
} from '../config/sources';
import {
  type IngestionRunContext,
  type IngestionSource,
  type IngestionStatus,
  type RawYouTubeVideoPayload,
} from '../lib/ingestion/types';

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
  strategy: YouTubeStrategyConfig,
): Promise<YouTubeVideoItem[]> {
  const apiKey = process.env.YOUTUBE_API_KEY!;
  const maxResults = Math.min(strategy.maxVideosPerRun, 50);

  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('key', apiKey);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('order', 'viewCount');
  searchUrl.searchParams.set('q', strategy.query);
  searchUrl.searchParams.set('maxResults', String(maxResults));

  console.log(`[${strategy.name}] Searching YouTube for: ${strategy.query}`);
  const searchJson = await fetchJson<YouTubeSearchResponse>(
    searchUrl.toString(),
  );
  const videoIds = (searchJson.items ?? [])
    .map((item) => item.id.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) {
    console.log(`[${strategy.name}] No videoIds found from search.`);
    return [];
  }

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('key', apiKey);
  videosUrl.searchParams.set('part', 'snippet,statistics');
  videosUrl.searchParams.set('id', videoIds.join(','));

  console.log(`[${strategy.name}] Fetching details for ${videoIds.length} videos`);
  const videosJson = await fetchJson<YouTubeVideosResponse>(
    videosUrl.toString(),
  );

  return videosJson.items ?? [];
}

function filterVideosForStrategy(
  videos: YouTubeVideoItem[],
  strategy: YouTubeStrategyConfig,
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
  strategy: YouTubeStrategyConfig,
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

  for (const strategy of YOUTUBE_STRATEGIES) {
    const runCtx = await startIngestionRun('youtube', strategy.name);

    try {
      console.log(
        `[${strategy.name}] Starting ingestion for query "${strategy.query}"`,
      );

      const videos = await fetchYouTubeVideosForStrategy(strategy);
      console.log(`[${strategy.name}] Fetched ${videos.length} videos from API`);

      const filtered = filterVideosForStrategy(videos, strategy);
      console.log(
        `[${strategy.name}] Filtered to ${filtered.length} videos after minViews checks`,
      );

      const inserted = await upsertRawYouTubeVideos(strategy, filtered);
      console.log(
        `[${strategy.name}] Upserted ${inserted} raw YouTube videos successfully.`,
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
