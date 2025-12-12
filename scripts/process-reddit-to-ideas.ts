import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { insertIdeas, type IdeaForInsert } from './ingest-utils';
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

ensureEnv([
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEEPSEEK_API_KEY',
]);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

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

type DbRawRedditPost = {
  id: number;
  source_post_id: string;
  subreddit: string;
  title: string;
  url: string | null;
  author: string | null;
  score: number | null;
  num_comments: number | null;
  created_utc: string | null;
  strategy_name: string | null;
  raw_payload: RawRedditPostPayload;
};

async function loadUnprocessedRawPosts(
  limit = 40,
): Promise<DbRawRedditPost[]> {
  const { data, error } = await supabase
    .from('raw_reddit_posts')
    .select(
      'id, source_post_id, subreddit, title, url, author, score, num_comments, created_utc, strategy_name, raw_payload',
    )
    .eq('processed', false)
    .order('ingested_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DbRawRedditPost[];
}

async function markRawPostsProcessed(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('raw_reddit_posts')
    .update({
      processed: true,
      last_processed_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;
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

async function generateIdeasFromRawPosts(
  posts: DbRawRedditPost[],
  countPerBatch = 3,
): Promise<IdeaForInsert[]> {
  if (posts.length === 0) return [];

  const limited = posts.slice(0, 10);
  const representative =
    limited.reduce(
      (best, curr) =>
        (best?.score ?? -Infinity) < (curr.score ?? -Infinity) ? curr : best,
      undefined as DbRawRedditPost | undefined,
    ) ?? limited[0];
  const representativeUrl =
    sanitizeEnglishText(representative.url ?? '') ??
    sanitizeEnglishText(representative.raw_payload?.url) ??
    undefined;

  const snippets = limited
    .map((p) => {
      const payload = p.raw_payload || {};
      const body =
        sanitizeEnglishText(
          (payload.selftext as string) ?? (payload.body as string) ?? '',
        ) ?? '';
      return `Subreddit: r/${p.subreddit}
Title: ${p.title}
Text: ${body.slice(0, 400)}
Score: ${p.score ?? 0}, Comments: ${p.num_comments ?? 0}
URL: ${p.url ?? ''}`;
    })
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
      "next_steps": "2-3 actionable next steps (English)",
      "source_url": "Reddit thread URL if relevant"
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
    ideas?: Array<Partial<IdeaForInsert> & { source_url?: string }>;
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

  return parsed.ideas.map((raw) => ({
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
      sanitizeEnglishText((raw as { source_url?: string }).source_url) ??
      representativeUrl,
  }));
}

async function main() {
  console.log('--- Process raw_reddit_posts → ideas ---');

  const runCtx = await startIngestionRun('reddit', 'reddit-raw-to-ideas');

  try {
    const rawPosts = await loadUnprocessedRawPosts(40);
    console.log(`Loaded ${rawPosts.length} unprocessed raw posts.`);

    if (rawPosts.length === 0) {
      await finishIngestionRun(runCtx, 'success', { raw: 0, ideas: 0 });
      console.log('No raw posts to process, exit.');
      return;
    }

    const ideas = await generateIdeasFromRawPosts(rawPosts, 5);
    console.log(`Generated ${ideas.length} ideas from DeepSeek.`);

    if (ideas.length > 0) {
      await insertIdeas(ideas);
    }

    const rawIds = rawPosts.map((p) => p.id);
    await markRawPostsProcessed(rawIds);

    await finishIngestionRun(runCtx, 'success', {
      raw: rawPosts.length,
      ideas: ideas.length,
    });

    console.log('Done processing raw Reddit posts.');
  } catch (err) {
    console.error('Error in processing script:', err);
    await finishIngestionRun(
      runCtx,
      'error',
      { raw: 0, ideas: 0 },
      (err as Error).message,
    );
    throw err;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
