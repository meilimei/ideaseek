// scripts/ingest-trends.ts
// Fetch daily Google Trends topics, ask DeepSeek to synthesize opportunities, and log them.

import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

class TransientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientError';
  }
}

type DailyTrendArticle = { title: string; snippet: string };
const TRENDS_SOURCE_URL =
  'https://trends.google.com/trends/trendingsearches/daily?geo=US';

type DailyTrendTopic = {
  query: string;
  title: string;
  trafficText?: string;
  articles?: DailyTrendArticle[];
};

type DeepSeekIdeasResponse = {
  ideas?: Array<Record<string, unknown>>;
};

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

type TrendArticleRaw = { title?: string; snippet?: string };
type TrendSearchRaw = {
  title?: { query?: string };
  formattedTraffic?: string;
  articles?: TrendArticleRaw[];
};
type TrendsResponse = {
  default?: {
    trendingSearchesDays?: Array<{
      trendingSearches?: TrendSearchRaw[];
    }>;
  };
};

let supabaseClientPromise: Promise<SupabaseClient> | null = null;

async function getSupabaseServiceClient(): Promise<SupabaseClient> {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('../lib/supabaseServiceClient').then(
      (mod) => mod.supabaseServiceClient,
    );
  }
  return supabaseClientPromise;
}

function escapeLikePattern(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

export async function insertIdeas(ideas: IdeaForInsert[]): Promise<void> {
  if (ideas.length === 0) {
    console.log('No ideas to insert.');
    return;
  }

  const supabaseServiceClient = await getSupabaseServiceClient();

  const uniqueIdeas: IdeaForInsert[] = [];
  const skipped: {
    title: string;
    source_url?: string | null;
    reason: SkipReason;
  }[] = [];

  for (const idea of ideas) {
    if (idea.source_url) {
      let sourceQuery = supabaseServiceClient
        .from('ideas')
        .select('id')
        .eq('source_url', idea.source_url)
        .maybeSingle();

      if (idea.source_type) {
        sourceQuery = supabaseServiceClient
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
    const { data: existingTitle, error: titleError } = await supabaseServiceClient
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

  const { data, error } = await supabaseServiceClient
    .from('ideas')
    .insert(uniqueIdeas)
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

async function fetchDailyTrends(geo = 'US'): Promise<DailyTrendTopic[]> {
  const url = new URL('https://trends.google.com/trends/api/dailytrends');
  url.searchParams.set('hl', 'en-US');
  url.searchParams.set('tz', '0');
  url.searchParams.set('geo', geo);
  url.searchParams.set('ns', '15');

  const res = await fetch(url.toString(), {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      Accept: 'application/json,text/plain,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://trends.google.com/',
    },
  });

  const text = await res.text();
  const status = res.status;
  const contentType = res.headers.get('content-type') ?? '';
  const firstSnippet = text.trim().slice(0, 200);

  if (!res.ok || contentType.includes('text/html') || text.trim().startsWith('<')) {
    throw new TransientError(
      `Google Trends returned HTML or non-JSON. status=${status} content-type=${contentType} snippet=${firstSnippet}`,
    );
  }

  let parsed: TrendsResponse;
  try {
    let body = text.trim();
    if (body.startsWith(")]}'")) {
      body = body.replace(/^\)\]\}'\s*\n?/, '');
    }
    parsed = JSON.parse(body) as TrendsResponse;
  } catch (err) {
    throw new Error(
      `Failed to parse Google Trends response: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const days = parsed?.default?.trendingSearchesDays ?? [];
  if (!Array.isArray(days) || days.length === 0) return [];

  const searches = days[0]?.trendingSearches ?? [];
  if (!Array.isArray(searches)) return [];

  return searches.map((s: TrendSearchRaw) => {
    const articles =
      Array.isArray(s.articles) &&
      s.articles.map((a: TrendArticleRaw) => ({
        title: String(a.title ?? ''),
        snippet: String(a.snippet ?? ''),
      }));

    return {
      query: String(s.title?.query ?? ''),
      title: String(s.title?.query ?? ''),
      trafficText: s.formattedTraffic
        ? String(s.formattedTraffic)
        : undefined,
      articles: articles?.slice(0, 5),
    };
  });
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  return null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned = value
    .map((v) => (typeof v === 'string' ? v : null))
    .filter((v): v is string => Boolean(v));
  return cleaned.length > 0 ? cleaned : null;
}

async function generateIdeasFromTrends(
  topics: DailyTrendTopic[],
  countPerBatch = 5,
): Promise<IdeaForInsert[]> {
  if (topics.length === 0) return [];

  const limited = topics.slice(0, 10);

  const snippets = limited
    .map((t, idx) => {
      const articleText =
        t.articles && t.articles.length > 0
          ? t.articles
              .slice(0, 2)
              .map((a) => `- ${a.title}: ${a.snippet}`)
              .join('\n')
          : '(no articles)';
      return `#${idx + 1} Trend: ${t.title}
Traffic: ${t.trafficText ?? 'N/A'}
Articles:
${articleText}`;
    })
    .join('\n\n---\n\n');

  const prompt = `
You are a startup opportunity analyst. Given daily Google Trends topics (US) with related articles, propose 1-${countPerBatch} product opportunities. Output ONLY valid JSON (parseable) in this shape:
{
  "ideas": [
    {
      "title": "string",
      "one_liner": "string",
      "description": "string",
      "tags": ["..."],
      "difficulty": 1-5,
      "market_size": "S" | "M" | "L",
      "demand_strength": "weak" | "medium" | "strong",
      "pain_points": ["..."],
      "target_users": "string",
      "market_stage": "emerging" | "growing" | "mature",
      "competition": "string",
      "monetization": ["..."],
      "key_risks": ["..."],
      "next_steps": "string"
    }
  ]
}

Use English only. Trends input:

${snippets}
`;

  const deepseek = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
  });

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

  let parsedIdeas: DeepSeekIdeasResponse;
  try {
    parsedIdeas = JSON.parse(content) as DeepSeekIdeasResponse;
  } catch (err) {
    console.error('Failed to parse DeepSeek JSON (trends):', err, content);
    return [];
  }

  if (!parsedIdeas.ideas || !Array.isArray(parsedIdeas.ideas)) {
    console.error('DeepSeek trends response missing ideas[]:', parsedIdeas);
    return [];
  }

  return parsedIdeas.ideas.map((raw) => ({
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
    source_url: TRENDS_SOURCE_URL,
  }));
}

async function main() {
  console.log('--- Ingest Google Trends → DeepSeek → Supabase ---');

  const topics = await fetchDailyTrends('US');
  console.log(`Fetched ${topics.length} daily trends.`);

  if (topics.length === 0) {
    console.log('No trends found, exiting.');
    return;
  }

  const ideas = await generateIdeasFromTrends(topics, 5);
  console.log(`Generated ${ideas.length} ideas from trends.`);

  await insertIdeas(ideas);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
