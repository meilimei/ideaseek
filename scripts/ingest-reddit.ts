// scripts/ingest-reddit.ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { supabaseServiceClient } from '../lib/supabaseServiceClient';
import { recordJobOutputs } from './lib/jobOutputs';
import { type IdeaForInsert } from './ingest-utils';

// 1. 加载 .env.local（注意路径）
const envPathUsed = path.resolve(process.cwd(), '.env.local');
const envResult = dotenv.config({ path: envPathUsed });
const loadedCount = envResult.parsed ? Object.keys(envResult.parsed).length : 0;

const adminJobIdRaw = process.env.ADMIN_JOB_ID?.trim();
const jobId = adminJobIdRaw && /^\d+$/.test(adminJobIdRaw) ? Number(adminJobIdRaw) : null;
const ownerId = process.env.ADMIN_JOB_CREATED_BY?.trim() || null;
const sha = process.env.GITHUB_SHA?.slice(0, 7) ?? '-';
console.log(`ADMIN_JOB_ID: ${adminJobIdRaw ?? 'none'} sha=${sha}`);
console.log(`ADMIN_JOB_CREATED_BY: ${ownerId ?? 'none'}`);
console.log(`[reddit][debug] marker=ingest-reddit.ts loaded ${new Date().toISOString()}`);
const RUN_FILE =
  typeof import.meta !== 'undefined' && import.meta.url
    ? fileURLToPath(import.meta.url)
    : '';
console.log(
  `[env] reddit_user_agent_present=${process.env.REDDIT_USER_AGENT ? '1' : '0'} envPath=${envPathUsed} loadedKeys=${loadedCount}`,
);
type RedditFetchMode = 'auto' | 'fallback-only';
const fetchMode: RedditFetchMode =
  process.env.REDDIT_FETCH_MODE === 'fallback-only'
    ? 'fallback-only'
    : process.env.REDDIT_FETCH_MODE === 'auto'
      ? 'auto'
      : process.env.GITHUB_ACTIONS === 'true'
        ? 'fallback-only'
        : 'auto';
console.log(`[reddit] fetchMode=${fetchMode}`);
console.log(
  `[env] apify_token_present=${process.env.APIFY_TOKEN ? '1' : '0'}`,
);

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

// 2. DeepSeek 客户端
if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY in .env.local');
}

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

// Reddit 相关类型（简单定义）
type RedditPost = {
  id: string;
  title: string;
  selftext: string;
  score: number;
  num_comments: number;
  url: string;
  subreddit: string;
  created_utc?: number;
  created_at_ms?: number | null;
};

type RedditListingChild = {
  data: {
    id: string;
    title: string;
    selftext?: string;
    score?: number;
    num_comments?: number;
    permalink?: string;
    subreddit: string;
    created_utc?: number;
    created?: number;
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
  created_utc?: number;
  created?: number;
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

function sanitizeEnglishArray(values: unknown): string[] | undefined {
  if (!Array.isArray(values)) return undefined;
  const cleaned = values
    .map((v) => sanitizeEnglishText(v))
    .filter((v): v is string => Boolean(v));
  return cleaned.length > 0 ? cleaned : undefined;
}

function normalizePainPatterns(raw: string[]): string[] {
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    const normalized = normalizeSmartPunctuation(entry);
    const parts = normalized.split('/');
    for (const part of parts) {
      const cleaned = part
        .toLowerCase()
        .replace(/\.\.\./g, '')
        .replace(/[^a-z0-9'\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length < 4) continue;
      seen.add(cleaned);
    }
  }
  return Array.from(seen);
}

function parseMaybeJson<T = any>(value: any): T | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && !Array.isArray(value)) return value as T;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function coerceStringArray(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => String(v));
  }
  if (typeof input === 'string') {
    const s = input.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v));
    } catch {
      // fall through to split
    }
    return s
      .split(/[\n,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeSubreddit(value: string) {
  return value.replace(/^\/?r\//i, '').trim();
}

type SkipReason = 'source_url' | 'title';

function escapeLikePattern(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

async function insertIdeasWithIds(ideas: IdeaForInsert[]): Promise<string[]> {
  if (ideas.length === 0) {
    console.log('No ideas to insert.');
    return [];
  }

  const uniqueIdeas: IdeaForInsert[] = [];
  const skipped: { title: string; source_url?: string | null; reason: SkipReason }[] = [];

  for (const idea of ideas) {
    if (idea.source_type === 'reddit' && idea.source_url) {
      const { data: existing, error } = await supabaseServiceClient
        .from('ideas')
        .select('id')
        .eq('source_type', 'reddit')
        .eq('source_url', idea.source_url)
        .maybeSingle();

      if (error) {
        console.warn(
          `Dedup check (source_url) failed for ${idea.source_url}, inserting anyway:`,
          error.message,
        );
      } else if (existing) {
        skipped.push({ title: idea.title, source_url: idea.source_url, reason: 'source_url' });
        continue;
      }
    }

    const titlePattern = escapeLikePattern(idea.title);
    const { data: existingTitle, error: titleError } = await supabaseServiceClient
      .from('ideas')
      .select('id')
      .ilike('title', titlePattern)
      .limit(1)
      .maybeSingle();

    if (titleError) {
      console.warn(
        `Dedup check (title) failed for "${idea.title}", inserting anyway:`,
        titleError.message,
      );
    } else if (existingTitle) {
      skipped.push({ title: idea.title, reason: 'title' });
      continue;
    }

    uniqueIdeas.push(idea);
  }

  if (uniqueIdeas.length === 0) {
    console.log(
      `All ${ideas.length} ideas were skipped (duplicates by source_url/title).`,
    );
    if (skipped.length > 0) {
      console.log(
        'Skipped titles:',
        skipped.slice(0, 10).map((s) => `${s.title} (${s.reason})`),
      );
    }
    return [];
  }

  const rowsToInsert = ownerId
    ? uniqueIdeas.map((idea) => ({ ...idea, created_by: ownerId }))
    : uniqueIdeas;

  const { data, error } = await supabaseServiceClient
    .from('ideas')
    .insert(rowsToInsert)
    .select('id, title');

  if (error) {
    console.error('Error inserting ideas:', error);
    return [];
  }

  const insertedIds = (data ?? [])
    .map((row) => row.id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

  console.log(`Inserted ${data?.length ?? 0} idea(s).`);
  if (data && data.length > 0) {
    console.log('Inserted titles:', data.slice(0, 10).map((row) => row.title));
  }
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} duplicate(s) by source_url/title.`,
      skipped.slice(0, 10).map((s) => `${s.title} (${s.reason})`),
    );
  }

  return insertedIds;
}

// 一些简单的关键词，用来筛选“有痛点味道”的帖子
const PAIN_KEYWORDS = [
  'any idea how to',
  'how do i',
  'struggle with',
  'problem',
  'issue',
  'stuck with',
  'pain',
  'can’t figure out',
];
const DEFAULT_KEYWORDS = PAIN_KEYWORDS;

const DEFAULT_SUBREDDITS = [
  'startups',
  'Entrepreneur',
  'IndieHackers',
  'SaaS',
];

type RedditSort = 'top' | 'hot' | 'new';
type RedditTimeRange = 'day' | 'week' | 'month';

const REDDIT_BASE_URLS = [
  'https://api.reddit.com',
  'https://old.reddit.com',
  'https://www.reddit.com',
];

type SubredditFetchError = {
  subreddit: string;
  status?: number;
  message: string;
};

function getErrorStatus(err: unknown): number | undefined {
  return typeof err === 'object' && err && 'status' in err
    ? (err as { status?: number }).status
    : undefined;
}

async function markAdminJobFailed(message: string) {
  if (!jobId) return;
  const nowIso = new Date().toISOString();
  const { error } = await supabaseServiceClient
    .from('admin_jobs')
    .update({ status: 'error', error: message, log: message, finished_at: nowIso })
    .eq('id', jobId);
  if (error) {
    console.error('Failed to update admin_jobs status:', error.message);
  }
}

async function loadStrategyConfig(strategyId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseServiceClient
    .from('ingest_strategies')
    .select('config')
    .eq('id', strategyId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load strategy config:', error.message);
    return null;
  }

  return (data?.config as unknown) ?? null;
}

async function loadJobPayload(jobId: number): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabaseServiceClient
    .from('admin_jobs')
    .select('payload')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load job payload:', error.message);
    return null;
  }

  const payload = data?.payload;
  const parsedPayload = parseMaybeJson<Record<string, unknown>>(payload) ?? payload;
  return parsedPayload && typeof parsedPayload === 'object' && !Array.isArray(parsedPayload)
    ? (parsedPayload as Record<string, unknown>)
    : null;
}

async function fetchRedditListingJson(
  sub: string,
  sort: RedditSort,
  perSubreddit: number,
  timeRange: RedditTimeRange,
): Promise<{ json: RedditListingResponse; baseUrl: string }> {
  let lastError: unknown;
  for (const baseUrl of REDDIT_BASE_URLS) {
    const url = `${baseUrl}/r/${sub}/${sort}.json?limit=${perSubreddit}&raw_json=1&t=${timeRange}`;
    try {
      if (!fetchMarkerLogged) {
        console.log(
          `[reddit][debug] marker=ACTIVE file=${RUN_FILE} cwd=${process.cwd()}`,
        );
        fetchMarkerLogged = true;
      }
      console.log(`Fetching ${url}`);
      const json = await fetchJsonWithRetry<RedditListingResponse>(url);
      console.log(`Using ${baseUrl} for r/${sub}`);
      return { json, baseUrl };
    } catch (err) {
      lastError = err;
      const status = getErrorStatus(err);
      const shouldFallback =
        status === 403 || status === 429 || (typeof status === 'number' && status >= 500);
      if (!shouldFallback) {
        throw err;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch listing for r/${sub}`);
}

const FETCH_TIMEOUT_MS = 15_000;
const FETCH_RETRIES = 2;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let cachedRedditHeaders: Record<string, string> | null = null;
let warnedMissingUserAgent = false;
let fetchMarkerLogged = false;

function buildRedditHeaders() {
  if (cachedRedditHeaders) return cachedRedditHeaders;
  const userAgent = process.env.REDDIT_USER_AGENT?.trim();
  if (!userAgent) {
    if (!warnedMissingUserAgent) {
      console.warn(
        'Missing REDDIT_USER_AGENT. Set it to avoid 403 and anonymous blocks. Continuing without it.',
      );
      warnedMissingUserAgent = true;
    }
    cachedRedditHeaders = {
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    return cachedRedditHeaders;
  }
  cachedRedditHeaders = {
    'User-Agent': userAgent,
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  return cachedRedditHeaders;
}

function toEpochMs(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(parsed)) return null;
  return parsed < 1e12 ? parsed * 1000 : parsed;
}

function toEpochMsAny(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return toEpochMs(value);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const num = Number(trimmed);
    if (Number.isFinite(num)) return toEpochMs(num);
    const iso = Date.parse(trimmed);
    return Number.isFinite(iso) ? iso : null;
  }
  return null;
}

function isRedditUrl(url: string) {
  try {
    const host = new URL(url).host;
    return (
      host.endsWith('reddit.com') ||
      host === 'api.reddit.com' ||
      host === 'old.reddit.com' ||
      host === 'www.reddit.com'
    );
  } catch {
    return false;
  }
}

type RedditSignals = {
  minUpvotes: number;
  minComments: number;
  maxAgeDays: number;
};

type SignalsBreakdown = {
  total: number;
  kept: number;
  dropped_total: number;
  dropped_low_upvotes: number;
  dropped_low_comments: number;
  dropped_too_old: number;
  dropped_missing_time: number;
};

function parseSignals(config: Record<string, unknown> | null | undefined): RedditSignals {
  const rawSignals = (config?.signals ?? {}) as Record<string, unknown>;
  const minUpvotes = Number(rawSignals.minUpvotes);
  const minComments = Number(rawSignals.minComments);
  const maxAgeDays = Number(rawSignals.maxAgeDays);
  return {
    minUpvotes: Number.isFinite(minUpvotes) ? minUpvotes : 10,
    minComments: Number.isFinite(minComments) ? minComments : 5,
    maxAgeDays: Number.isFinite(maxAgeDays) ? maxAgeDays : 7,
  };
}

function applySignalsFilter(
  posts: RedditPost[],
  signals: RedditSignals,
): { filtered: RedditPost[]; breakdown: SignalsBreakdown } {
  const nowMs = Date.now();
  const filtered: RedditPost[] = [];
  let debugTimeLogs = 0;
  const breakdown: SignalsBreakdown = {
    total: posts.length,
    kept: 0,
    dropped_total: 0,
    dropped_low_upvotes: 0,
    dropped_low_comments: 0,
    dropped_too_old: 0,
    dropped_missing_time: 0,
  };

  for (const post of posts) {
    const score = post.score ?? 0;
    const comments = post.num_comments ?? 0;
    const rawCreated = post.created_utc;
    const createdAtMs = post.created_at_ms ?? toEpochMs(rawCreated);
    if (!createdAtMs || !Number.isFinite(createdAtMs) || createdAtMs <= 0) {
      breakdown.dropped_missing_time += 1;
      breakdown.dropped_total += 1;
      continue;
    }
    const ageDays = (nowMs - createdAtMs) / 86400000;
    if (process.env.DEBUG_REDDIT_TIME === '1' && debugTimeLogs < 3) {
      console.log(
        `DEBUG time: id=${post.id} raw=${rawCreated ?? 'n/a'} createdMs=${createdAtMs} ageDays=${ageDays.toFixed(2)}`,
      );
      debugTimeLogs += 1;
    }
    if (ageDays > signals.maxAgeDays) {
      breakdown.dropped_too_old += 1;
      breakdown.dropped_total += 1;
      continue;
    }
    if (score < signals.minUpvotes) {
      breakdown.dropped_low_upvotes += 1;
      breakdown.dropped_total += 1;
      continue;
    }
    if (comments < signals.minComments) {
      breakdown.dropped_low_comments += 1;
      breakdown.dropped_total += 1;
      continue;
    }
    filtered.push(post);
  }

  breakdown.kept = filtered.length;
  return { filtered, breakdown };
}

async function fetchJsonWithRetry<T = unknown>(
  url: string,
  options: RequestInit = {},
  retries = FETCH_RETRIES,
): Promise<T> {
  let lastError: unknown;
  const headers = isRedditUrl(url)
    ? buildRedditHeaders()
    : {
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...headers,
          ...(options.headers ?? {}),
        },
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const status = res.status;
        // If 403 on primary host, try old.reddit.com once.
        if (
          status === 403 &&
          typeof url === 'string' &&
          url.includes('reddit.com') &&
          !url.includes('old.reddit.com')
        ) {
          clearTimeout(timeout);
          const retryUrl = new URL(url);
          retryUrl.host = 'old.reddit.com';
          const resOld = await fetch(retryUrl.toString(), {
            ...options,
            signal: controller.signal,
            headers: {
              ...headers,
              ...(options.headers ?? {}),
            },
          });
          if (resOld.ok) {
            clearTimeout(timeout);
            return (await resOld.json()) as T;
          }
          const errorOld = new Error(`HTTP ${resOld.status}`);
          (errorOld as Error & { status?: number }).status = resOld.status;
          throw errorOld;
        }

        const error = new Error(`HTTP ${status}`);
        (error as Error & { status?: number }).status = status;
        throw error;
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
        const status = getErrorStatus(err);
        if (status === 403) {
          const delays = [2000, 5000, 10000];
          await sleep(delays[attempt] ?? 10000);
        } else {
          const baseDelay = 500 * (attempt + 1);
          const extraDelay = status === 429 ? 400 * attempt : 0;
          await sleep(baseDelay + extraDelay);
        }
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function fetchRedditPostsViaApify(
  subreddits: string[],
  perSubreddit: number,
  sort: RedditSort,
  timeRange: RedditTimeRange,
): Promise<{ posts: RedditPost[]; errors: SubredditFetchError[] }> {
  const token = process.env.APIFY_TOKEN?.trim();
  const errors: SubredditFetchError[] = [];
  if (!token) {
    return {
      posts: [],
      errors: [{ subreddit: 'apify', status: 0, message: 'Missing APIFY_TOKEN' }],
    };
  }

  const rawActor =
    (process.env.APIFY_REDDIT_ACTOR?.trim() || 'trudax~reddit-scraper-lite').trim();
  const actorId = rawActor.includes('/') ? rawActor.replace('/', '~') : rawActor;

  function clipJson(v: any, max = 700) {
    try {
      const s = typeof v === 'string' ? v : JSON.stringify(v);
      return s.length > max ? s.slice(0, max) + '…' : s;
    } catch {
      return String(v);
    }
  }

  async function apifyStartRun(actorIdIn: string, tokenIn: string, input: Record<string, unknown>) {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${actorIdIn}/runs?token=${encodeURIComponent(tokenIn)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errType = (json as any)?.error?.type;
      if (errType === 'actor-is-not-rented') {
        throw new Error(
          `Apify actor is not rented: ${actorIdIn}. Rent it, or set APIFY_REDDIT_ACTOR=trudax~reddit-scraper-lite.`,
        );
      }
      throw new Error(`Apify start failed ${res.status}: ${clipJson(json)}`);
    }
    const runId = (json as any)?.data?.id ?? (json as any)?.id;
    if (!runId) throw new Error(`Apify start did not return run id: ${clipJson(json)}`);
    return runId as string;
  }

  async function apifyGetRun(tokenIn: string, runId: string) {
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${encodeURIComponent(tokenIn)}`,
      { method: 'GET' },
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Apify run get failed ${res.status}: ${clipJson(json)}`);
    }
    return json as any;
  }

  function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function apifyPollRun(tokenIn: string, runId: string, maxMs = 12 * 60_000, intervalMs = 5_000) {
    const started = Date.now();
    let lastStatus = '';
    while (Date.now() - started < maxMs) {
      const run = await apifyGetRun(tokenIn, runId);
      const status =
        run?.data?.status ?? run?.status ?? '';
      if (status && status !== lastStatus) {
        console.log(`[apify][poll] runId=${runId} status=${status}`);
        lastStatus = status;
      }
      if (status === 'SUCCEEDED') return run;
      if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
        throw new Error(`Apify run ended: status=${status} runId=${runId}`);
      }
      await sleep(intervalMs);
    }
    throw new Error(`Apify run polling timeout (client-side) runId=${runId}`);
  }

  async function apifyGetDatasetItems(tokenIn: string, datasetId: string) {
    const res = await fetch(
      `https://api.apify.com/v2/datasets/${datasetId}/items?token=${encodeURIComponent(tokenIn)}&clean=1&format=json`,
      { method: 'GET' },
    );
    const json = await res.json().catch(() => ([]));
    if (!res.ok) {
      throw new Error(`Apify dataset items failed ${res.status}: ${clipJson(json)}`);
    }
    if (!Array.isArray(json)) return [];
    return json as any[];
  }

  // Build ONE run for all subreddits (avoid 5 separate runs / timeouts)
  const startUrls = subreddits.map((sub) => ({
    url: `https://www.reddit.com/r/${sub}/${sort}/?t=${timeRange}`,
  }));

  const input: Record<string, unknown> = {
    startUrls,
    maxItems: subreddits.length * perSubreddit,
    maxPostCount: perSubreddit,
    skipComments: true,
    // Do NOT set sort/time here; we encode them in the URL already to avoid invalid-input.
    proxy: { useApifyProxy: true },
  };

  console.log(
    `[apify][run] actor=${actorId} subCount=${subreddits.length} maxItems=${input.maxItems}`,
  );

  try {
    const runId = await apifyStartRun(actorId, token, input);
    console.log(`[apify][run] started runId=${runId}`);
    const run = await apifyPollRun(token, runId);

    const datasetId =
      run?.data?.defaultDatasetId ??
      run?.defaultDatasetId ??
      run?.data?.output?.defaultDatasetId;

    if (!datasetId) {
      throw new Error(`Apify run missing defaultDatasetId: ${clipJson(run)}`);
    }

    const items = await apifyGetDatasetItems(token, String(datasetId));
    const posts: RedditPost[] = [];

    for (const item of items) {
      const createdMs = toEpochMsAny(
        (item as any)?.createdAt ??
          (item as any)?.createdUtc ??
          (item as any)?.created_utc ??
          (item as any)?.created,
      );

      const url =
        (item as any)?.url ??
        (item as any)?.postUrl ??
        ((item as any)?.permalink ? `https://www.reddit.com${(item as any).permalink}` : '');

      const subredditName =
        (item as any)?.subreddit ??
        (item as any)?.subredditName ??
        (typeof url === 'string' && url.includes('/r/')
          ? url.split('/r/')[1]?.split('/')[0]
          : '');

      posts.push({
        id: String((item as any)?.id ?? (item as any)?.postId ?? (item as any)?.redditId ?? ''),
        title: String((item as any)?.title ?? ''),
        selftext: String((item as any)?.text ?? (item as any)?.body ?? (item as any)?.selftext ?? ''),
        score: Number((item as any)?.score ?? (item as any)?.upVotes ?? (item as any)?.upvotes ?? 0),
        num_comments: Number(
          (item as any)?.numComments ??
            (item as any)?.numberOfComments ??
            (item as any)?.commentsCount ??
            0,
        ),
        url: String(url ?? ''),
        subreddit: String(subredditName || ''),
        created_utc: createdMs ? Math.floor(createdMs / 1000) : undefined,
        created_at_ms: createdMs ?? null,
      });
    }

    return { posts, errors: [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push({ subreddit: 'apify', status: 0, message: msg });
    return { posts: [], errors };
  }
}

// ============ 第一步：抓 Reddit 帖子 ============

async function fetchRedditPosts(
  subreddits = DEFAULT_SUBREDDITS,
  perSubreddit = 25,
  sort: RedditSort = 'top',
  timeRange: RedditTimeRange = 'day',
  timeRangeSeconds = 86400,
  maxAgeDays = 7,
  mode: RedditFetchMode = 'auto',
): Promise<{ posts: RedditPost[]; errors: SubredditFetchError[] }> {
  const fetchOneSubreddit = async (sub: string) => {
    const posts: RedditPost[] = [];
    let listingStatus: number | undefined;
    let listingMessage = '';
    if (mode !== 'fallback-only') {
      try {
        const { json } = await fetchRedditListingJson(sub, sort, perSubreddit, timeRange);
        const children: RedditListingChild[] = json.data?.children ?? [];

        for (const child of children) {
          const d = child.data;
          const createdAtMs = toEpochMs(d.created_utc ?? d.created);
          const post: RedditPost = {
            id: d.id,
            title: d.title,
            selftext: d.selftext ?? '',
            score: d.score ?? 0,
            num_comments: d.num_comments ?? 0,
            url: `https://www.reddit.com${d.permalink}`,
            subreddit: d.subreddit,
            created_utc: d.created_utc,
            created_at_ms: createdAtMs,
          };
          posts.push(post);
        }
        return { posts };
      } catch (err) {
        console.warn(
          `Reddit listing fetch failed for r/${sub}, trying fallback:`,
          err instanceof Error ? err.message : err,
        );
        listingStatus = getErrorStatus(err);
        listingMessage = err instanceof Error ? err.message : String(err);
      }
    }

    // Fallback: use Pushshift mirror (api.pullpush.io) when direct Reddit fetch fails/blocked
    const fallbackSortType = 'created_utc';
    const nowSeconds = Math.floor(Date.now() / 1000);
    const minWindow = Math.max(timeRangeSeconds, maxAgeDays * 86400, 7 * 86400);
    const after = Math.max(0, nowSeconds - minWindow);
    const fallbackUrl = `https://api.pullpush.io/reddit/search/submission/?subreddit=${encodeURIComponent(sub)}&sort=desc&sort_type=${fallbackSortType}&after=${after}&before=${nowSeconds}&size=${perSubreddit}`;
    console.log(`Fallback pullpush: r/${sub} after=${after} size=${perSubreddit}`);
    try {
      const json = await fetchJsonWithRetry<PullpushResponse>(fallbackUrl);
      const data: PullpushPost[] = Array.isArray(json.data) ? json.data : [];

      for (const d of data) {
        const createdAtMs = toEpochMs(d.created_utc ?? d.created);
        const post: RedditPost = {
          id: d.id,
          title: d.title ?? '',
          selftext: d.selftext ?? '',
          score: d.score ?? 0,
          num_comments: d.num_comments ?? 0,
          url: d.permalink
            ? `https://www.reddit.com${d.permalink}`
            : d.full_link ?? d.url ?? '',
          subreddit: d.subreddit ?? sub,
          created_utc: d.created_utc,
          created_at_ms: createdAtMs,
        };
        posts.push(post);
      }
      if (posts.length === 0) {
        const after2 = Math.max(0, nowSeconds - 30 * 86400);
        const fallbackUrl2 = `https://api.pullpush.io/reddit/search/submission/?subreddit=${encodeURIComponent(sub)}&sort=desc&sort_type=${fallbackSortType}&after=${after2}&before=${nowSeconds}&size=${perSubreddit}`;
        console.log(`Fallback pullpush retry: r/${sub} after=${after2} size=${perSubreddit}`);
        const json2 = await fetchJsonWithRetry<PullpushResponse>(fallbackUrl2);
        const data2: PullpushPost[] = Array.isArray(json2.data) ? json2.data : [];
        for (const d of data2) {
          const createdAtMs = toEpochMs(d.created_utc ?? d.created);
          const post: RedditPost = {
            id: d.id,
            title: d.title ?? '',
            selftext: d.selftext ?? '',
            score: d.score ?? 0,
            num_comments: d.num_comments ?? 0,
            url: d.permalink
              ? `https://www.reddit.com${d.permalink}`
              : d.full_link ?? d.url ?? '',
            subreddit: d.subreddit ?? sub,
            created_utc: d.created_utc,
            created_at_ms: createdAtMs,
          };
          posts.push(post);
        }
        if (posts.length === 0) {
          return {
            posts,
            error: {
              subreddit: sub,
              status: 0,
              message: `pullpush returned 0 results (after=${after}, after2=${after2})`,
            },
          };
        }
      }
    } catch (fallbackErr) {
      const fallbackMessage =
        fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      const status = getErrorStatus(fallbackErr) ?? listingStatus;
      console.error(
        `Fallback fetch failed for r/${sub}:`,
        fallbackMessage,
      );
      return {
        posts: [],
        error: {
          subreddit: sub,
          status,
          message: fallbackMessage || listingMessage,
        },
      };
    }

    return { posts };
  };

  const all: RedditPost[] = [];
  const errors: SubredditFetchError[] = [];
  for (let i = 0; i < subreddits.length; i += 1) {
    const sub = subreddits[i];
    try {
      const result = await fetchOneSubreddit(sub);
      all.push(...result.posts);
      if (result.error) {
        errors.push(result.error);
      }
    } catch (err) {
      console.error('Subreddit fetch failed:', err instanceof Error ? err.message : err);
      errors.push({
        subreddit: sub,
        status: getErrorStatus(err),
        message: err instanceof Error ? err.message : String(err),
      });
    }
    if (i < subreddits.length - 1) {
      const jitterMs = 600 + Math.floor(Math.random() * 601);
      await sleep(jitterMs);
    }
  }

  return { posts: all, errors };
}

// 简单过滤：分数 + 关键词
function filterPainfulPosts(posts: RedditPost[], keywords: string[]): RedditPost[] {
  const minScore = 10; // 可以调
  return posts.filter((p) => {
    const text = (p.title + ' ' + p.selftext).toLowerCase();
    if (p.score < minScore) return false;

    return keywords.some((kw) => text.includes(kw));
  });
}

// ============ 第二步：调用 DeepSeek，把帖子变成机会 JSON ============

async function generateIdeasFromPosts(
  posts: RedditPost[],
  countPerBatch = 3
): Promise<IdeaForInsert[]> {
  if (posts.length === 0) return [];

  // 避免 prompt 太长，先截一小部分
  const limited = posts.slice(0, 10);
  const representativeUrl = limited[0]?.url ?? undefined;

  const snippets = limited
    .map(
      (p) =>
        `Subreddit: r/${p.subreddit}\nTitle: ${p.title}\nText: ${p.selftext.slice(
          0,
          400
        )}\nScore: ${p.score}, Comments: ${p.num_comments}\nURL: ${p.url}`
    )
    .join('\n\n---\n\n');

  const prompt = `
You are a senior startup opportunity analyst who extracts product opportunities from real user pain points.

Below are Reddit discussions from startup / SaaS / indie dev communities. Please:
1) Identify recurring problems or pain points.
2) Summarize them into 1-${countPerBatch} potential product opportunities.
3) Provide a structured analysis for each opportunity using the exact schema below.

Output JSON only, strictly parsable by JSON.parse, with English content only (no Chinese). Use the following shape:
{
  "ideas": [
    {
      "title": "Concise product opportunity title (English)",
      "one_liner": "One-sentence value prop (English)",
      "description": "2-4 sentences on the problem, solution, and core functionality (English)",
      "tags": ["SaaS", "DevTools", "B2B"],
      "difficulty": 1-10,
      "market_size": "S" | "M" | "L",
      "demand_strength": "weak" | "medium" | "strong",
      "pain_points": ["Specific pain point 1", "Specific pain point 2"],
      "target_users": "Target user persona (English)",
      "market_stage": "emerging" | "growing" | "mature",
      "competition": "Brief note on existing competitors (English)",
      "monetization": ["Subscription $X/month", "One-time fee", "Other revenue ideas"],
      "key_risks": ["Key risk 1", "Key risk 2"],
      "next_steps": "2-3 actionable next steps (English)"
    }
  ]
}

Only output the JSON object and keep every field in English.

Here are the raw Reddit snippets:

${snippets}
`;

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          'You are a precise JSON generator that outputs only valid JSON objects.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.9,
    max_tokens: 2000,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';

  type DeepSeekIdeasResponse = {
    ideas?: Array<Partial<IdeaForInsert>>;
  };

  let parsed: DeepSeekIdeasResponse;
  try {
    parsed = JSON.parse(content) as DeepSeekIdeasResponse;
  } catch (err) {
    console.error('Failed to parse DeepSeek JSON:', err, content);
    return [];
  }

  if (!parsed || !Array.isArray(parsed.ideas)) {
    console.error('DeepSeek response missing ideas[]:', parsed);
    return [];
  }

  const ideas: IdeaForInsert[] = parsed.ideas.map((raw) => ({
    title: sanitizeEnglishText(raw.title) ?? '',
    one_liner: sanitizeEnglishText(raw.one_liner),
    description: sanitizeEnglishText(raw.description),
    tags: sanitizeEnglishArray(raw.tags),
    difficulty: raw.difficulty ?? undefined,
    market_size: raw.market_size ?? undefined,
    demand_strength: raw.demand_strength ?? undefined,
    pain_points: sanitizeEnglishArray(raw.pain_points),
    target_users: sanitizeEnglishText(raw.target_users),
    market_stage: sanitizeEnglishText(raw.market_stage),
    competition: sanitizeEnglishText(raw.competition),
    monetization: sanitizeEnglishArray(raw.monetization),
    key_risks: sanitizeEnglishArray(raw.key_risks),
    next_steps: sanitizeEnglishText(raw.next_steps),
    source_type: 'reddit',
    source_url:
      sanitizeEnglishText(raw.source_url) ??
      (representativeUrl ? sanitizeEnglishText(representativeUrl) : undefined),
  }));

  return ideas;
}

// ============ 第三步：插入 Supabase ideas 表 ============

// ============ 主流程 ============

async function main() {
  console.log('--- Ingest Reddit → DeepSeek → Supabase ---');

  ensureEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

  let envStrategyConfig: Record<string, unknown> | null = null;
  const strategyConfigRaw = process.env.INGEST_STRATEGY_CONFIG;
  if (strategyConfigRaw) {
    try {
      let parsed: unknown = JSON.parse(strategyConfigRaw);
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          // keep string as-is
        }
      }
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    envStrategyConfig = parsed as Record<string, unknown>;
  }
    } catch (err) {
      console.warn(
        'Failed to parse INGEST_STRATEGY_CONFIG, using defaults:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  const jobPayload = jobId ? await loadJobPayload(jobId) : null;
  const payloadCfgCandidate =
    parseMaybeJson<Record<string, unknown>>((jobPayload as any)?.config) ??
    (jobPayload as any)?.config;
  const jobConfig =
    payloadCfgCandidate && typeof payloadCfgCandidate === 'object' && !Array.isArray(payloadCfgCandidate)
      ? (payloadCfgCandidate as Record<string, unknown>)
      : ((jobPayload as any) ?? null);
  const payloadStrategyId =
    (typeof (jobPayload as any)?.strategyId === 'string'
      ? (jobPayload as any)?.strategyId
      : typeof (jobPayload as any)?.strategyKey === 'string'
        ? (jobPayload as any)?.strategyKey
        : typeof (jobPayload as any)?.strategy_id === 'string'
          ? (jobPayload as any)?.strategy_id
          : typeof (jobPayload as any)?.strategy_key === 'string'
            ? (jobPayload as any)?.strategy_key
            : '')?.trim() || '';

  const strategyId =
    payloadStrategyId ||
    (process.env.INGEST_STRATEGY_ID?.trim() || '');

  const dbStrategyConfigRaw = strategyId ? await loadStrategyConfig(strategyId) : null;
  const dbStrategyConfig =
    parseMaybeJson<Record<string, unknown>>(dbStrategyConfigRaw) ??
    (dbStrategyConfigRaw && typeof dbStrategyConfigRaw === 'object' && !Array.isArray(dbStrategyConfigRaw)
      ? (dbStrategyConfigRaw as Record<string, unknown>)
      : null);
  const cfg = {
    ...(dbStrategyConfig ?? {}),
    ...(envStrategyConfig ?? {}),
    ...(jobConfig ?? {}),
  } as Record<string, unknown>;
  if (strategyId && !dbStrategyConfigRaw) {
    console.warn(`No strategy config found in DB for ${strategyId}, using env/defaults.`);
  }

  const payloadProviderRaw =
    typeof (jobPayload as any)?.fetchProvider === 'string'
      ? String((jobPayload as any)?.fetchProvider).trim()
      : typeof (jobPayload as any)?.redditProvider === 'string'
        ? String((jobPayload as any)?.redditProvider).trim()
        : '';
  const payloadConfigProviderRaw =
    typeof (payloadCfgCandidate as any)?.fetchProvider === 'string'
      ? String((payloadCfgCandidate as any)?.fetchProvider).trim()
      : '';
  const cfgProviderRaw =
    typeof (cfg as any)?.fetchProvider === 'string'
      ? String((cfg as any)?.fetchProvider).trim()
      : '';
  const strategyProviderRaw =
    typeof (dbStrategyConfig as any)?.fetchProvider === 'string'
      ? String((dbStrategyConfig as any)?.fetchProvider).trim()
      : typeof (envStrategyConfig as any)?.fetchProvider === 'string'
        ? String((envStrategyConfig as any)?.fetchProvider).trim()
        : '';
  const fetchProviderRaw =
    payloadProviderRaw ||
    payloadConfigProviderRaw ||
    cfgProviderRaw ||
    strategyProviderRaw ||
    'reddit';
  const fetchProvider = fetchProviderRaw.toLowerCase() === 'apify' ? 'apify' : 'reddit';
  console.log(`[reddit][provider] jobId=${jobId ?? 'none'} fetchProvider=${fetchProvider}`);
  const cfgTrack = typeof cfg.track === 'string' ? cfg.track.trim() : '';
  const rawSubs = (cfg as any)?.subreddits;
  const explicitSubreddits = coerceStringArray(rawSubs)
    .map(normalizeSubreddit)
    .filter(Boolean);
  const cfgKeywords = Array.isArray(cfg.keywords)
    ? cfg.keywords
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    : null;
  const cfgSortRaw = typeof cfg.sort === 'string' ? cfg.sort.toLowerCase() : '';
  const cfgSort: RedditSort =
    cfgSortRaw === 'top' || cfgSortRaw === 'hot' || cfgSortRaw === 'new'
      ? cfgSortRaw
      : 'top';
  const cfgTimeRangeRaw =
    typeof cfg.timeRange === 'string' ? cfg.timeRange.toLowerCase() : '';
  const cfgTimeRange: RedditTimeRange =
    cfgTimeRangeRaw === 'day' || cfgTimeRangeRaw === 'week' || cfgTimeRangeRaw === 'month'
      ? cfgTimeRangeRaw
      : 'day';
  const cfgLimitRaw = Number(cfg.limit);
  const cfgLimit = Number.isFinite(cfgLimitRaw) ? cfgLimitRaw : 25;
  const timeRangeSeconds =
    cfgTimeRange === 'day'
      ? 86400
      : cfgTimeRange === 'week'
        ? 7 * 86400
        : 30 * 86400;
  let subredditsSource: 'explicit' | 'track' | 'default' = 'default';
  let subreddits: string[] = [];
  if (explicitSubreddits.length > 0) {
    subreddits = explicitSubreddits;
    subredditsSource = 'explicit';
  } else {
    const trackSubs = coerceStringArray(null); // placeholder if track mapping added later
    const normalizedTrackSubs = trackSubs.map(normalizeSubreddit).filter(Boolean);
    if (normalizedTrackSubs.length > 0) {
      subreddits = normalizedTrackSubs;
      subredditsSource = 'track';
    } else {
      subreddits = DEFAULT_SUBREDDITS;
      subredditsSource = 'default';
    }
  }
  console.log(`Track: ${cfgTrack || '-'}`);
  const configSourceLabel = jobConfig
    ? 'job.payload'
    : dbStrategyConfig
      ? 'strategy.config'
      : 'none';
  console.log(
    `[reddit] fetchProvider=${fetchProvider} (payload=${payloadProviderRaw || '-'} payloadConfig=${payloadConfigProviderRaw || '-'} cfg=${cfgProviderRaw || '-'} strategy=${strategyProviderRaw || '-'})`,
  );
  console.log(
    `[reddit][cfg] jobId=${jobId ?? 'none'} strategyId=${strategyId || '-'} payloadStrategyId=${payloadStrategyId || '-'} ` +
      `jobHasConfig=${jobConfig ? '1' : '0'} dbHasConfig=${dbStrategyConfig ? '1' : '0'} rawSubsType=${Array.isArray(rawSubs) ? 'array' : typeof rawSubs} subs=${explicitSubreddits.join(
        ',',
      )}`,
  );
  console.log(
    `[reddit] resolved subreddits source=${subredditsSource} track=${cfgTrack || '-'} subs=${subreddits.join(
      ',',
    )}`,
  );
  const rawKeywords = cfgKeywords?.length ? cfgKeywords : DEFAULT_KEYWORDS;
  const keywords = normalizePainPatterns(rawKeywords);
  console.log(`Keywords: ${rawKeywords.length}`);
  console.log(`Sort: ${cfgSort} timeRange: ${cfgTimeRange} limit: ${cfgLimit}`);

  const signals = parseSignals(cfg);
  console.log(
    `Signals: minUpvotes=${signals.minUpvotes} minComments=${signals.minComments} maxAgeDays=${signals.maxAgeDays}` +
      ` | strategyId=${strategyId || '-'} | cfgSubs=${explicitSubreddits.join(',') || '-'}` +
      ` | subsUsed=${subreddits.join(',') || '-'} | subredditsSource=${subredditsSource} | source=${configSourceLabel}`,
  );

  let posts: RedditPost[] = [];
  let errors: SubredditFetchError[] = [];
  if (fetchProvider === 'apify') {
    if (!process.env.APIFY_TOKEN) {
      const msg = 'APIFY_TOKEN is required for fetchProvider=apify';
      console.error(msg);
      await markAdminJobFailed(msg);
      process.exit(1);
    }
    for (const sub of subreddits) {
      console.log(`[apify] sub=${sub} maxItems=${cfgLimit} sort=${cfgSort} time=${cfgTimeRange}`);
    }
    ({ posts, errors } = await fetchRedditPostsViaApify(
      subreddits,
      cfgLimit,
      cfgSort,
      cfgTimeRange,
    ));
  } else {
    ({ posts, errors } = await fetchRedditPosts(
      subreddits,
      cfgLimit,
      cfgSort,
      cfgTimeRange,
      timeRangeSeconds,
      signals.maxAgeDays,
      fetchMode,
    ));
  }
  let timeSample = '';
  if (posts.length > 0) {
    const p = posts[0];
    const createdMs = p.created_at_ms ?? toEpochMs(p.created_utc);
    const ageDays = createdMs ? (Date.now() - createdMs) / 86400000 : null;
    timeSample = ` sample(raw=${p.created_utc ?? 'n/a'} createdMs=${createdMs ?? 'n/a'} ageDays=${ageDays !== null ? ageDays.toFixed(2) : 'n/a'})`;
  }
  console.log(`Fetched ${posts.length} posts (provider=${fetchProvider})${timeSample}`);
  if (posts.length === 0 && errors.length > 0) {
    const summary = errors
      .map((err) => {
        const status = err.status ? `HTTP ${err.status}` : 'error';
        const message = err.message ? ` ${err.message}` : '';
        return `${err.subreddit}: ${status}${message}`;
      })
      .join('; ');
    console.error(`Fetch failures: ${summary}`);
    await markAdminJobFailed(`Reddit fetch failed: ${summary}`);
    process.exit(1);
    return;
  }
  if (posts.length === 0) {
    console.log(
      'No posts fetched (likely HTTP 403). Configure REDDIT_USER_AGENT or enable OAuth.',
    );
    return;
  }
  if (process.env.DEBUG_REDDIT === '1') {
    let shown = 0;
    for (const post of posts) {
      const createdAtMs = post.created_at_ms ?? toEpochMs(post.created_utc);
      if (!createdAtMs) continue;
      const ageDays = (Date.now() - createdAtMs) / 86400000;
      const title =
        post.title.length > 80 ? `${post.title.slice(0, 77)}...` : post.title;
      console.log(
        `DEBUG prefilter: r/${post.subreddit} "${title}" ${new Date(createdAtMs).toISOString()} ageDays=${ageDays.toFixed(1)}`,
      );
      shown += 1;
      if (shown >= 3) break;
    }
  }

  const { filtered: signalFiltered, breakdown } = applySignalsFilter(posts, signals);
  console.log(`After signals filter: ${signalFiltered.length}`);
  console.log(
    `Signals breakdown (exclusive): total=${breakdown.total} kept=${breakdown.kept} dropped=${breakdown.dropped_total} ` +
      `[missing_time=${breakdown.dropped_missing_time} too_old=${breakdown.dropped_too_old} ` +
      `low_upvotes=${breakdown.dropped_low_upvotes} low_comments=${breakdown.dropped_low_comments}]`,
  );

  console.log(
    `[reddit] painPatterns=${keywords.length} sample=${keywords.slice(0, 6).join(' | ')}`,
  );
  const filtered = filterPainfulPosts(signalFiltered, keywords);
  console.log(`After pain filter: ${filtered.length}`);

  if (filtered.length === 0) {
    console.log('No qualified posts found, exit.');
    return;
  }

  const ideas = await generateIdeasFromPosts(filtered, 5);
  console.log(`Generated ${ideas.length} ideas from DeepSeek.`);

  const insertedIds = await insertIdeasWithIds(ideas);
  if (insertedIds.length > 0) {
    await recordJobOutputs({
      supabase: supabaseServiceClient,
      jobId,
      jobCreatedBy: ownerId,
      ideaIds: insertedIds,
    });
    if (jobId) {
      console.log(`Linked ${insertedIds.length} output idea(s) to job ${jobId}`);
    }
  }

  console.log('Done.');
}

// 直接执行
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
