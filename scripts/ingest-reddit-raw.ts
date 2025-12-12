import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  REDDIT_STRATEGIES,
  type RedditStrategyConfig,
} from '../config/sources';
import {
  type IngestionRunContext,
  type IngestionSource,
  type IngestionStatus,
  type RawRedditPostPayload,
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

ensureEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type RedditListingChild = {
  data: {
    id: string;
    title: string;
    selftext?: string;
    score?: number;
    num_comments?: number;
    permalink?: string;
    subreddit: string;
    author?: string;
  };
};

type RedditListingResponse = {
  data?: {
    children?: RedditListingChild[];
  };
};

type PullpushPost = {
  id: string;
  title?: string;
  selftext?: string;
  score?: number;
  num_comments?: number;
  permalink?: string;
  full_link?: string;
  url?: string;
  subreddit?: string;
  author?: string;
  created_utc?: number;
};

type PullpushResponse = {
  data?: PullpushPost[];
};

function normalizeSmartPunctuation(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...');
}

function sanitizeEnglishText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = normalizeSmartPunctuation(value);
  const asciiOnly = normalized.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '');
  const collapsed = asciiOnly.replace(/\s+/g, ' ').trim();
  return collapsed || undefined;
}

const REDDIT_HEADERS = {
  'User-Agent': 'ideasignal-bot/0.1 by meilimei',
  Accept: 'application/json',
};

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options: RequestInit = {},
  retries = FETCH_RETRIES,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...REDDIT_HEADERS,
          ...(options.headers ?? {}),
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
      clearTimeout(timeout);
      const isLastAttempt = attempt === retries;
      console.warn(
        `Fetch attempt ${attempt + 1}/${retries + 1} failed for ${url}:`,
        err instanceof Error ? err.message : err,
      );
      if (!isLastAttempt) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchRedditPostsForStrategy(
  strategy: RedditStrategyConfig,
  perSubreddit = 25,
): Promise<RawRedditPostPayload[]> {
  const collected: RawRedditPostPayload[] = [];

  for (const sub of strategy.subreddits) {
    const redditUrl = `https://www.reddit.com/r/${sub}/top.json?limit=${perSubreddit}&t=day&raw_json=1`;
    console.log(`[${strategy.name}] Fetching ${redditUrl}`);

    try {
      const json = await fetchJsonWithRetry<RedditListingResponse>(redditUrl);
      const children: RedditListingChild[] = json.data?.children ?? [];

      for (const child of children) {
        const d = child.data;
        collected.push({
          id: d.id,
          title: d.title,
          selftext: d.selftext ?? '',
          url: d.permalink ? `https://www.reddit.com${d.permalink}` : undefined,
          score: d.score ?? 0,
          num_comments: d.num_comments ?? 0,
          created_utc: undefined,
          subreddit: d.subreddit,
          author: d.author,
        });
      }
      continue;
    } catch (err) {
      console.warn(
        `[${strategy.name}] Primary fetch failed for r/${sub}, trying fallback:`,
        err instanceof Error ? err.message : err,
      );
    }

    const fallbackUrl = `https://api.pullpush.io/reddit/search/submission/?subreddit=${encodeURIComponent(sub)}&sort=desc&sort_type=score&t=day&size=${perSubreddit}`;
    try {
      const json = await fetchJsonWithRetry<PullpushResponse>(fallbackUrl);
      const data: PullpushPost[] = Array.isArray(json.data) ? json.data : [];

      for (const d of data) {
        collected.push({
          id: d.id,
          title: d.title ?? '',
          selftext: d.selftext ?? '',
          url: d.permalink
            ? `https://www.reddit.com${d.permalink}`
            : d.full_link ?? d.url ?? undefined,
          score: d.score ?? 0,
          num_comments: d.num_comments ?? 0,
          created_utc: d.created_utc,
          subreddit: d.subreddit ?? sub,
          author: d.author,
        });
      }
    } catch (fallbackErr) {
      console.error(
        `[${strategy.name}] Fallback fetch failed for r/${sub}:`,
        fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
      );
    }
  }

  return collected;
}

function filterPostsForStrategy(
  posts: RawRedditPostPayload[],
  strategy: RedditStrategyConfig,
): RawRedditPostPayload[] {
  const minScore = strategy.minScore ?? 0;
  const keywords = (strategy.keywords ?? []).map((kw) =>
    kw.toLowerCase(),
  );

  return posts.filter((post) => {
    if ((post.score ?? 0) < minScore) return false;

    if (keywords.length === 0) return true;

    const combined =
      sanitizeEnglishText(`${post.title ?? ''} ${post.selftext ?? ''}`) ?? '';
    const lc = combined.toLowerCase();
    return keywords.some((kw) => lc.includes(kw));
  });
}

async function upsertRawRedditPosts(
  strategy: RedditStrategyConfig,
  posts: RawRedditPostPayload[],
): Promise<number> {
  if (posts.length === 0) return 0;

  const rows = posts.map((post) => ({
    source_post_id: post.id,
    subreddit: post.subreddit,
    title: post.title,
    url: post.url ?? null,
    author: post.author ?? null,
    score: post.score ?? null,
    num_comments: post.num_comments ?? null,
    created_utc: post.created_utc
      ? new Date(post.created_utc * 1000).toISOString()
      : null,
    strategy_name: strategy.name,
    raw_payload: post,
  }));

  const { error } = await supabase
    .from('raw_reddit_posts')
    .upsert(rows, { onConflict: 'source_post_id' });

  if (error) {
    console.error('Failed to upsert raw_reddit_posts:', error);
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

  if (error) {
    console.error('Failed to start ingestion run:', error);
  }

  return {
    id: data?.id ?? null,
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

  const updateData: Record<string, unknown> = {
    status,
    finished_at: new Date().toISOString(),
  };

  if (typeof counts.raw === 'number') {
    updateData.raw_count = counts.raw;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('ingestion_runs')
    .update(updateData)
    .eq('id', ctx.id);

  if (error) {
    console.error('Failed to finish ingestion run:', error);
  }
}

async function main() {
  console.log('--- Ingest Reddit raw → Supabase.raw_reddit_posts ---');

  for (const strategy of REDDIT_STRATEGIES) {
    const ctx = await startIngestionRun('reddit', strategy.name);
    try {
      const fetched = await fetchRedditPostsForStrategy(strategy);
      console.log(
        `[${strategy.name}] Fetched ${fetched.length} posts across ${strategy.subreddits.length} subreddits.`,
      );

      const filtered = filterPostsForStrategy(fetched, strategy);
      console.log(
        `[${strategy.name}] Filtered to ${filtered.length} posts after score/keyword checks.`,
      );

      const rawInserted = await upsertRawRedditPosts(strategy, filtered);
      await finishIngestionRun(ctx, 'success', { raw: rawInserted });
      console.log(
        `[${strategy.name}] Upserted ${rawInserted} raw posts successfully.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[${strategy.name}] Error during ingestion:`, message);
      await finishIngestionRun(ctx, 'error', { raw: 0 }, message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
