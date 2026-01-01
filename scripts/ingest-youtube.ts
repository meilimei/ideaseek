// scripts/ingest-youtube.ts
// Placeholder YouTube ingest script: sets up env, DeepSeek client, and utilities.

import path from 'node:path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { supabaseServiceClient } from '../lib/supabaseServiceClient';
import { type IdeaForInsert } from './ingest-utils';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const adminJobIdRaw = process.env.ADMIN_JOB_ID?.trim();
const adminJobId =
  adminJobIdRaw && /^\d+$/.test(adminJobIdRaw) ? Number(adminJobIdRaw) : adminJobIdRaw;
console.log(`ADMIN_JOB_ID: ${adminJobIdRaw ?? 'none'}`);

if (!process.env.DEEPSEEK_API_KEY) {
  throw new Error('Missing DEEPSEEK_API_KEY in environment (.env.local)');
}

const YOUTUBE_API_KEY = process.env.YT_KEY ?? process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  throw new Error('Missing YT_KEY (or YOUTUBE_API_KEY) in environment (.env.local)');
}

export type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
};

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

type SkipReason = 'source_url' | 'title';

function parseCount(value: unknown): number {
  const num = typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(num) ? num : 0;
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

  const { data, error } = await supabaseServiceClient
    .from('ideas')
    .insert(uniqueIdeas)
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

async function linkOutputIdeas(jobId: string | number, ideaIds: string[]) {
  if (ideaIds.length === 0) return false;
  const rows = ideaIds.map((id) => ({
    job_id: jobId,
    idea_id: id,
    relation_type: 'output',
  }));

  const { error } = await supabaseServiceClient
    .from('admin_job_ideas')
    .upsert(rows, { onConflict: 'job_id,idea_id,relation_type', ignoreDuplicates: true });

  if (error) {
    console.warn('admin_job_ideas link failed', { adminJobIdRaw, err: error });
    const fallback = await supabaseServiceClient.from('admin_job_ideas').insert(rows);
    if (fallback.error) {
      console.warn('admin_job_ideas link failed', { adminJobIdRaw, err: fallback.error });
      return false;
    }
  }
  return true;
}

export async function fetchVideosForTopic(
  topic: string,
  maxResults = 10,
): Promise<YouTubeVideo[]> {
  const searchUrl = new URL('https://www.googleapis.com/youtube/v3/search');
  searchUrl.searchParams.set('key', YOUTUBE_API_KEY);
  searchUrl.searchParams.set('part', 'snippet');
  searchUrl.searchParams.set('type', 'video');
  searchUrl.searchParams.set('q', topic);
  searchUrl.searchParams.set('order', 'viewCount');
  searchUrl.searchParams.set('maxResults', String(maxResults));

  const searchRes = await fetch(searchUrl.toString());
  if (!searchRes.ok) {
    console.warn(
      `YouTube search failed (${searchRes.status}): ${searchRes.statusText}`,
    );
    return [];
  }

  const searchJson = (await searchRes.json()) as {
    items?: Array<{ id?: { videoId?: string } }>;
  };

  const videoIds =
    searchJson.items
      ?.map((item) => item.id?.videoId)
      .filter((id): id is string => Boolean(id)) ?? [];

  if (videoIds.length === 0) {
    return [];
  }

  const videosUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
  videosUrl.searchParams.set('key', YOUTUBE_API_KEY);
  videosUrl.searchParams.set('part', 'snippet,statistics');
  videosUrl.searchParams.set('id', videoIds.join(','));
  videosUrl.searchParams.set('maxResults', String(maxResults));

  const videosRes = await fetch(videosUrl.toString());
  if (!videosRes.ok) {
    console.warn(
      `YouTube videos fetch failed (${videosRes.status}): ${videosRes.statusText}`,
    );
    return [];
  }

  const videosJson = (await videosRes.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        channelTitle?: string;
        publishedAt?: string;
      };
      statistics?: {
        viewCount?: string;
        likeCount?: string;
        commentCount?: string;
      };
    }>;
  };

  return (
    videosJson.items?.map((item) => ({
      id: item.id ?? '',
      title: item.snippet?.title ?? '',
      description: item.snippet?.description ?? '',
      channelTitle: item.snippet?.channelTitle ?? '',
      publishedAt: item.snippet?.publishedAt ?? '',
      viewCount: parseCount(item.statistics?.viewCount),
      likeCount: parseCount(item.statistics?.likeCount),
      commentCount: parseCount(item.statistics?.commentCount),
    })) ?? []
  );
}

export async function generateIdeasFromYoutube(
  topic: string,
  videos: YouTubeVideo[],
  countPerBatch = 5,
): Promise<IdeaForInsert[]> {
  if (videos.length === 0) return [];

  const limited = videos.slice(0, 10);
  const snippets = limited
    .map((v, idx) => {
      return `#${idx + 1} ${v.title}
Channel: ${v.channelTitle}
Published: ${v.publishedAt}
Views: ${v.viewCount}, Likes: ${v.likeCount}, Comments: ${v.commentCount}
Description: ${v.description}`;
    })
    .join('\n\n---\n\n');

  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    topic,
  )}`;

  const prompt = `
You are a startup opportunity analyst. Given YouTube videos for a topic, propose 1-${countPerBatch} product opportunities. Output ONLY valid JSON (parseable) in this shape:
{
  "ideas": [
    {
      "title": "string",
      "one_liner": "string",
      "description": "string",
      "tags": ["..."],
      "difficulty": 1-10,
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

Use English only. Videos:

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
    console.error('Failed to parse DeepSeek JSON (youtube):', err, content);
    return [];
  }

  if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
    console.error('DeepSeek youtube response missing ideas[]:', parsed);
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
    source_type: 'youtube',
    source_url: searchUrl,
  }));
}

async function main() {
  console.log('--- Ingest YouTube → DeepSeek → Supabase ---');
  const topics = [
    'AI tools for developers',
    'personal finance automation',
    'productivity app',
    'small business marketing',
  ];

  for (const topic of topics) {
    console.log(`\nTopic: ${topic}`);

    const videos = await fetchVideosForTopic(topic, 10);
    console.log(`Fetched ${videos.length} videos.`);

    const ideas = await generateIdeasFromYoutube(topic, videos, 3);
    console.log(`Generated ${ideas.length} ideas.`);

    if (ideas.length > 0) {
      const insertedIds = await insertIdeasWithIds(ideas);
      if (adminJobIdRaw && insertedIds.length > 0) {
        const linked = await linkOutputIdeas(adminJobId ?? adminJobIdRaw, insertedIds);
        if (linked) {
          console.log(
            `Linked ${insertedIds.length} output idea(s) to job ${adminJobIdRaw}`,
          );
        }
      }
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
