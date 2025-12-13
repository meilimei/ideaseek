// scripts/ingest-reddit.ts
import path from 'node:path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { insertIdeas, type IdeaForInsert } from './ingest-utils';

// 1. 加载 .env.local（注意路径）
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

const DEFAULT_SUBREDDITS = [
  'startups',
  'Entrepreneur',
  'IndieHackers',
  'SaaS',
];

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

// ============ 第一步：抓 Reddit 帖子 ============

async function fetchRedditPosts(
  subreddits = DEFAULT_SUBREDDITS,
  perSubreddit = 25
): Promise<RedditPost[]> {
  const all: RedditPost[] = [];

  for (const sub of subreddits) {
    const redditUrl = `https://www.reddit.com/r/${sub}/top.json?limit=${perSubreddit}&t=day&raw_json=1`;
    console.log(`Fetching ${redditUrl}`);

    try {
      const json = await fetchJsonWithRetry<RedditListingResponse>(redditUrl);
      const children: RedditListingChild[] = json.data?.children ?? [];

      for (const child of children) {
        const d = child.data;
        const post: RedditPost = {
          id: d.id,
          title: d.title,
          selftext: d.selftext ?? '',
          score: d.score ?? 0,
          num_comments: d.num_comments ?? 0,
          url: `https://www.reddit.com${d.permalink}`,
          subreddit: d.subreddit,
        };
        all.push(post);
      }
      continue;
    } catch (err) {
      console.warn(
        `Primary Reddit fetch failed for r/${sub}, trying fallback:`,
        err instanceof Error ? err.message : err,
      );
    }

    // Fallback: use Pushshift mirror (api.pullpush.io) when direct Reddit fetch fails/blocked
    const fallbackUrl = `https://api.pullpush.io/reddit/search/submission/?subreddit=${encodeURIComponent(sub)}&sort=desc&sort_type=score&t=day&size=${perSubreddit}`;
    try {
      const json = await fetchJsonWithRetry<PullpushResponse>(fallbackUrl);
      const data: PullpushPost[] = Array.isArray(json.data) ? json.data : [];

      for (const d of data) {
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
        };
        all.push(post);
      }
    } catch (fallbackErr) {
      console.error(
        `Fallback fetch failed for r/${sub}:`,
        fallbackErr instanceof Error ? fallbackErr.message : fallbackErr,
      );
    }
  }

  return all;
}

// 简单过滤：分数 + 关键词
function filterPainfulPosts(posts: RedditPost[]): RedditPost[] {
  const minScore = 10; // 可以调
  return posts.filter((p) => {
    const text = (p.title + ' ' + p.selftext).toLowerCase();
    if (p.score < minScore) return false;

    return PAIN_KEYWORDS.some((kw) => text.includes(kw));
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

  const posts = await fetchRedditPosts();
  console.log(`Fetched ${posts.length} posts.`);

  const filtered = filterPainfulPosts(posts);
  console.log(`Filtered to ${filtered.length} potentially painful posts.`);

  if (filtered.length === 0) {
    console.log('No qualified posts found, exit.');
    return;
  }

  const ideas = await generateIdeasFromPosts(filtered, 5);
  console.log(`Generated ${ideas.length} ideas from DeepSeek.`);

  await insertIdeas(ideas);

  console.log('Done.');
}

// 直接执行
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
