import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { insertIdeas, type IdeaForInsert } from './ingest-utils';
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

type DbRawYouTubeVideo = {
  id: number;
  video_id: string;
  channel_id: string | null;
  channel_title: string | null;
  title: string;
  description: string | null;
  url: string | null;
  published_at: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  strategy_name: string | null;
  raw_payload: RawYouTubeVideoPayload;
};

async function loadUnprocessedRawVideos(
  limit = 40,
): Promise<DbRawYouTubeVideo[]> {
  const { data, error } = await supabase
    .from('raw_youtube_videos')
    .select(
      'id, video_id, channel_id, channel_title, title, description, url, published_at, view_count, like_count, comment_count, strategy_name, raw_payload',
    )
    .eq('processed', false)
    .order('ingested_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as DbRawYouTubeVideo[];
}

async function markRawVideosProcessed(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('raw_youtube_videos')
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

async function generateIdeasFromRawVideos(
  videos: DbRawYouTubeVideo[],
  countPerBatch = 3,
): Promise<IdeaForInsert[]> {
  if (videos.length === 0) return [];

  const limited = videos.slice(0, 8);

  const snippets = limited
    .map((v) => {
      const desc =
        v.description ?? v.raw_payload.snippet?.description ?? '';
      const truncatedDesc = desc.slice(0, 400);
      const views = v.view_count ?? 0;
      const url = v.url ?? `https://www.youtube.com/watch?v=${v.video_id}`;

      return `Channel: ${v.channel_title ?? v.raw_payload.snippet?.channelTitle ?? 'Unknown'}
Title: ${v.title}
Description: ${truncatedDesc}
Views: ${views}
URL: ${url}`;
    })
    .join('\n\n---\n\n');

  const prompt = `
You are a senior startup opportunity analyst who extracts product opportunities from real user behavior and content on YouTube.

Below are YouTube videos related to SaaS / AI / creator tools. Please:
1) Identify recurring problems, workflows, or underserved needs implied by these videos.
2) Summarize them into 1-${countPerBatch} potential product opportunities.
3) Provide a structured analysis for each opportunity using the exact schema below.

Output JSON only, strictly parsable by JSON.parse, with English content only (no Chinese). Use the following shape:
{
  "ideas": [
    {
      "title": "Concise product opportunity title (English)",
      "one_liner": "One-sentence value prop (English)",
      "description": "2-4 sentences on the problem, solution, and core functionality (English)",
      "tags": ["SaaS", "DevTools", "AI"],
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

Here are the YouTube video snippets:

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
    ideas?: Array<
      Partial<IdeaForInsert> & {
        source_url?: string;
      }
    >;
  };

  let parsed: DeepSeekIdeasResponse;
  try {
    parsed = JSON.parse(content) as DeepSeekIdeasResponse;
  } catch (err) {
    console.error('Failed to parse DeepSeek JSON (YouTube):', err, content);
    return [];
  }

  if (!parsed || !Array.isArray(parsed.ideas)) {
    console.error('DeepSeek YouTube response missing ideas[]:', parsed);
    return [];
  }

  const representativeUrl =
    limited[0]?.url ??
    (limited[0]
      ? `https://www.youtube.com/watch?v=${limited[0].video_id}`
      : undefined);

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
    source_type: 'youtube',
    source_url:
      sanitizeEnglishText((raw as any).source_url) ??
      (representativeUrl
        ? sanitizeEnglishText(representativeUrl)
        : undefined),
  }));

  return ideas;
}

async function main() {
  console.log('--- Process raw_youtube_videos → ideas ---');

  ensureEnv([
    'NEXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'DEEPSEEK_API_KEY',
  ]);

  const runCtx = await startIngestionRun('youtube', 'youtube-raw-to-ideas');

  try {
    const rawVideos = await loadUnprocessedRawVideos(40);
    console.log(`Loaded ${rawVideos.length} unprocessed raw videos.`);

    if (rawVideos.length === 0) {
      await finishIngestionRun(runCtx, 'success', {
        raw: 0,
        ideas: 0,
      });
      console.log('No raw videos to process, exit.');
      return;
    }

    const ideas = await generateIdeasFromRawVideos(rawVideos, 5);
    console.log(`Generated ${ideas.length} ideas from DeepSeek (YouTube).`);

    if (ideas.length > 0) {
      await insertIdeas(ideas);
    }

    const rawIds = rawVideos.map((v) => v.id);
    await markRawVideosProcessed(rawIds);

    await finishIngestionRun(runCtx, 'success', {
      raw: rawVideos.length,
      ideas: ideas.length,
    });

    console.log('Done processing raw YouTube videos.');
  } catch (err) {
    console.error('Error in YouTube processing script:', err);
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
