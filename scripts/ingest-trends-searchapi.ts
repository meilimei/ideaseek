// scripts/ingest-trends-searchapi.ts
// Fetches trending topics via SearchApi.io's Google Trends endpoint and logs the count.

import path from 'node:path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { supabaseServiceClient as supabaseService } from '../lib/supabaseServiceClient';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const ownerId = process.env.ADMIN_JOB_CREATED_BY?.trim() || null;

const SEARCHAPI_TRENDS_SOURCE_URL =
  'https://trends.google.com/trending?geo=US&hl=en&hours=24';

export type IdeaForInsert = {
  title: string;
  one_liner?: string | null;
  description?: string | null;
  tags?: string[] | null;
  difficulty?: number | null;
  market_size?: string | null;
  demand_strength?: string | null;
  pain_points?: string[] | null;
  target_users?: string | null;
  market_stage?: string | null;
  competition?: string | null;
  monetization?: string[] | null;
  key_risks?: string[] | null;
  next_steps?: string | null;
  source_type?: string | null;
  source_url?: string | null;
};

type SkipReason = 'source_url' | 'title';

function escapeLikePattern(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => (typeof v === 'string' ? v : null))
    .filter((v): v is string => Boolean(v));
  return cleaned.length > 0 ? cleaned : null;
}

export async function insertIdeas(ideas: IdeaForInsert[]): Promise<void> {
  if (ideas.length === 0) {
    console.log('No ideas to insert.');
    return;
  }

  const uniqueIdeas: IdeaForInsert[] = [];
  const skipped: {
    title: string;
    source_url?: string | null;
    reason: SkipReason;
  }[] = [];

  for (const idea of ideas) {
    if (idea.source_url) {
      let sourceQuery = supabaseService
        .from('ideas')
        .select('id')
        .eq('source_url', idea.source_url)
        .maybeSingle();

      if (idea.source_type) {
        sourceQuery = supabaseService
          .from('ideas')
          .select('id')
          .eq('source_type', idea.source_type)
          .eq('source_url', idea.source_url)
          .maybeSingle();
      }

      const { data: existing, error } = await sourceQuery;

      if (error) {
        console.warn(
          `Dedup check failed for ${idea.source_url}, inserting anyway:`,
          error.message,
        );
      } else if (existing) {
        skipped.push({
          title: idea.title,
          source_url: idea.source_url,
          reason: 'source_url',
        });
        continue;
      }
    }

    const titlePattern = escapeLikePattern(idea.title);
    const { data: existingTitle, error: titleError } = await supabaseService
      .from('ideas')
      .select('id')
      .ilike('title', titlePattern)
      .limit(1)
      .maybeSingle();

    if (titleError) {
      console.warn(
        `Title dedup check failed for "${idea.title}", inserting anyway:`,
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
    return;
  }

  const rowsToInsert = ownerId
    ? uniqueIdeas.map((idea) => ({ ...idea, created_by: ownerId }))
    : uniqueIdeas;

  const { data, error } = await supabaseService
    .from('ideas')
    .insert(rowsToInsert)
    .select('id, title, source_url');

  if (error) {
    console.error('Error inserting ideas:', error);
    return;
  }

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
}

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

ensureEnv(['SEARCHAPI_KEY', 'DEEPSEEK_API_KEY']);

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

export type SearchApiTrend = {
  query: string;
  search_volume?: number;
  keywords?: string[];
  location?: string;
  categories?: string[];
};

type SearchApiResponse = {
  trends?: Array<{
    query?: string;
    search_volume?: number;
    keywords?: string[];
    location?: string;
    categories?: string[];
  }>;
};

async function fetchTrendingNow(geo = 'US'): Promise<SearchApiTrend[]> {
  const url = `https://www.searchapi.io/api/v1/search?engine=google_trends_trending_now&geo=${encodeURIComponent(
    geo,
  )}`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.SEARCHAPI_KEY}`,
    },
  });

  if (!res.ok) {
    console.warn(
      `Trending-now request failed (${res.status}): ${res.statusText}`,
    );
    return [];
  }

  let json: SearchApiResponse;
  try {
    json = (await res.json()) as SearchApiResponse;
  } catch (err) {
    console.warn(
      'Failed to parse SearchApi trending response:',
      err instanceof Error ? err.message : err,
    );
    return [];
  }

  const trends = Array.isArray(json.trends) ? json.trends : [];
  return trends.map((t) => ({
    query: t.query ?? '',
    search_volume: t.search_volume,
    keywords: t.keywords,
    location: t.location,
    categories: t.categories,
  }));
}

async function generateIdeasFromSearchTrends(
  trends: SearchApiTrend[],
  countPerBatch = 5,
): Promise<IdeaForInsert[]> {
  if (trends.length === 0) return [];

  const limited = trends.slice(0, 10);
  const snippets = limited
    .map((t, idx) => {
      const parts = [
        `#${idx + 1} ${t.query}`,
        t.search_volume ? `search_volume: ${t.search_volume}` : null,
        t.categories && t.categories.length > 0
          ? `categories: ${t.categories.join(', ')}`
          : null,
        t.keywords && t.keywords.length > 0
          ? `keywords: ${t.keywords.slice(0, 3).join(', ')}`
          : null,
      ].filter(Boolean);
      return parts.join(' | ');
    })
    .join('\n');

  const prompt = `
你是创业机会分析师，下面是美国地区的 Google Trends “trending now” 查询。请根据这些趋势推断 1-${countPerBatch} 个产品/创业机会，并按以下 JSON 结构返回（必须是严格可解析的 JSON，仅输出对象本身）：
{
  "ideas": [
    {
      "title": "string",
      "one_liner": "string",
      "description": "string",
      "tags": ["string"],
      "difficulty": 1-10,
      "market_size": "S" | "M" | "L",
      "demand_strength": "weak" | "medium" | "strong",
      "pain_points": ["string"],
      "target_users": "string",
      "market_stage": "emerging" | "growing" | "mature",
      "competition": "string",
      "monetization": ["string"],
      "key_risks": ["string"],
      "next_steps": "string"
    }
  ]
}

Trends input (US):
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
    temperature: 0.8,
    max_tokens: 1800,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';

  type DeepSeekIdeasResponse = {
    ideas?: Array<Record<string, unknown>>;
  };

  let parsed: DeepSeekIdeasResponse;
  try {
    parsed = JSON.parse(content) as DeepSeekIdeasResponse;
  } catch (err) {
    console.error('Failed to parse DeepSeek JSON (search trends):', err, content);
    return [];
  }

  if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
    console.error('DeepSeek search trends response missing ideas[]:', parsed);
    return [];
  }

  return parsed.ideas.map((raw) => ({
    title: asString((raw as Record<string, unknown>).title) ?? 'Untitled',
    one_liner: asString((raw as Record<string, unknown>).one_liner),
    description: asString((raw as Record<string, unknown>).description),
    tags: asStringArray((raw as Record<string, unknown>).tags),
    difficulty:
      typeof (raw as Record<string, unknown>).difficulty === 'number'
        ? ((raw as Record<string, unknown>).difficulty as number)
        : null,
    market_size: asString((raw as Record<string, unknown>).market_size),
    demand_strength: asString((raw as Record<string, unknown>).demand_strength),
    pain_points: asStringArray((raw as Record<string, unknown>).pain_points),
    target_users: asString((raw as Record<string, unknown>).target_users),
    market_stage: asString((raw as Record<string, unknown>).market_stage),
    competition: asString((raw as Record<string, unknown>).competition),
    monetization: asStringArray((raw as Record<string, unknown>).monetization),
    key_risks: asStringArray((raw as Record<string, unknown>).key_risks),
    next_steps: asString((raw as Record<string, unknown>).next_steps),
    source_type: 'trends',
    source_url: SEARCHAPI_TRENDS_SOURCE_URL,
  }));
}

async function main() {
  console.log('--- Ingest Google Trends (SearchApi) → DeepSeek → Supabase ---');

  const trends = await fetchTrendingNow('US');
  console.log(`Fetched ${trends.length} trending topics from SearchApi.io.`);

  if (trends.length === 0) {
    console.log('No trends found, exiting.');
    return;
  }

  const ideas = await generateIdeasFromSearchTrends(trends, 5);
  console.log(`Generated ${ideas.length} ideas from trends.`);

  await insertIdeas(ideas);

  console.log('Done (trends-searchapi).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
