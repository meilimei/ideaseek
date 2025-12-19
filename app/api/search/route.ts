import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type IdeaResult = {
  id: string;
  title: string;
  one_liner: string | null;
  tags: string[] | null;
  status: string | null;
  score: number | null;
  created_at: string;
};

type TrendResult = {
  id: string;
  slug: string | null;
  keyword: string | null;
  title: string | null;
  tags: string[] | null;
  status: string | null;
  score: number | null;
  last_snapshot_at: string | null;
};

async function searchIdeas(q: string, limit: number): Promise<IdeaResult[]> {
  let query = supabase
    .from('ideas')
    .select(
      'id, title, one_liner, tags, status, score, created_at',
    )
    .limit(limit);

  if (q) {
    try {
      const { data, error } = await query.textSearch('search_tsv', q, {
        type: 'websearch',
      });
      if (!error && data) return data as IdeaResult[];
    } catch {
      // fall through to ilike
    }

    query = supabase
      .from('ideas')
      .select(
        'id, title, one_liner, tags, status, score, created_at',
      )
      .or(
        `title.ilike.%${q}%,one_liner.ilike.%${q}%,description.ilike.%${q}%`,
      )
      .limit(limit);
  }

  const { data } = await query;
  return (data ?? []) as IdeaResult[];
}

async function searchTrends(q: string, limit: number): Promise<TrendResult[]> {
  let query = supabase
    .from('trends')
    .select(
      'id, slug, keyword, title, tags, status, score, updated_at, last_seen',
    )
    .limit(limit)
    .eq('is_public', true);

  if (q) {
    try {
      const { data, error } = await query.textSearch('search_tsv', q, {
        type: 'websearch',
      });
      if (!error && data) return data as TrendResult[];
    } catch {
      // fallback
    }

    query = supabase
      .from('trends')
      .select(
        'id, slug, keyword, title, tags, status, score, updated_at, last_seen',
      )
      .eq('is_public', true)
      .or(
        `keyword.ilike.%${q}%,title.ilike.%${q}%,summary.ilike.%${q}%`,
      )
      .limit(limit);
  }

  const { data } = await query;
  return (data ?? []) as TrendResult[];
}

export async function GET(request: Request) {
  const started = Date.now();
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type') || 'all';
  const limit = Math.max(
    1,
    Math.min(20, parseInt(url.searchParams.get('limit') || '10', 10)),
  );

  const ideas = type === 'all' || type === 'ideas' ? await searchIdeas(q, limit) : [];
  const trends = type === 'all' || type === 'trends' ? await searchTrends(q, limit) : [];

  return NextResponse.json({
    ideas,
    trends,
    meta: {
      q,
      tookMs: Date.now() - started,
    },
  });
}
