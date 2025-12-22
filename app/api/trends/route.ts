import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type TrendCard = {
  id: string;
  slug: string;
  title: string;
  source_primary: string;
  keyword?: string;
  summary?: string | null;
  geo?: string | null;
  timeframe?: string | null;
  latest_value?: number | null;
  peak_value?: number | null;
  avg_value?: number | null;
  growth_pct?: number | null;
  sparkline?: number[] | null;
  updated_at?: string | null;
  tags?: string[] | null;
  score?: number | null;
  status?: string | null;
  enriched_at?: string | null;
  volume_display: string | null;
  growth_display: string | null;
  growth_label: string | null;
  categories: string[];
  overall_score: number | null;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || '';
  const sort = url.searchParams.get('sort') || 'recent';
  const source = url.searchParams.get('source') || 'all';
  const savedOnly = url.searchParams.get('saved') === '1';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.max(
    1,
    Math.min(50, parseInt(url.searchParams.get('pageSize') || '12', 10)),
  );

  const supabaseAuth = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const userId = user?.id ?? null;

  let savedCount: number | undefined;
  if (userId) {
    const { count: bookmarksCount } = await supabaseService
      .from('trend_bookmarks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (typeof bookmarksCount === 'number') savedCount = bookmarksCount;
  }

  let query = supabaseService
    .from('trends')
    .select(
      'id, slug, title, keyword, summary, geo, timeframe, latest_value, peak_value, avg_value, growth_pct, sparkline, updated_at, tags, score, status, enriched_at, source_primary, volume_display, growth_display, growth_label, categories, overall_score, last_seen, growth_rate, volume_score',
      { count: 'exact' },
    )
    .eq('is_public', true);

  if (q.trim()) {
    query = query.ilike('title', `%${q.trim()}%`);
  }

  if (source !== 'all') {
    query = query.eq('source_primary', source);
  }

  if (savedOnly) {
    if (!userId) {
      return NextResponse.json({
        trends: [],
        total: 0,
        page,
        pageSize,
        bookmarkedIds: [],
        savedCount: savedCount ?? 0,
        requireAuth: true,
      });
    }
    const { data: bookmarks, error: bookmarkError } = await supabaseService
      .from('trend_bookmarks')
      .select('trend_id')
      .eq('user_id', userId);
    if (bookmarkError) {
      console.error('Failed to load bookmarks:', bookmarkError);
      return NextResponse.json(
        { error: 'Failed to load trends' },
        { status: 500 },
      );
    }
    const ids = (bookmarks ?? []).map((b) => b.trend_id as string);
    if (ids.length === 0) {
      return NextResponse.json({
        trends: [],
        total: 0,
        page,
        pageSize,
        bookmarkedIds: [],
        savedCount: savedCount ?? 0,
      });
    }
    query = query.in('id', ids);
  }

  if (sort === 'growth') {
    query = query.order('growth_rate', { ascending: false, nullsFirst: false });
  } else if (sort === 'volume') {
    query = query.order('volume_score', {
      ascending: false,
      nullsFirst: false,
    });
  } else if (sort === 'score') {
    query = query.order('overall_score', {
      ascending: false,
      nullsFirst: false,
    });
  } else {
    query = query
      .order('last_seen', { ascending: false, nullsFirst: false })
      .order('overall_score', { ascending: false, nullsFirst: false });
  }

  query = query.order('updated_at', { ascending: false, nullsFirst: false });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to load trends:', error);
    return NextResponse.json(
      { error: 'Failed to load trends' },
      { status: 500 },
    );
  }

  const trends: TrendCard[] =
    data?.map((t) => ({
      id: t.id as string,
      slug: t.slug as string,
      title: t.title as string,
      source_primary: t.source_primary as string,
      keyword: t.keyword as string | undefined,
      summary: (t.summary as string | null) ?? null,
      geo: (t.geo as string | null) ?? null,
      timeframe: (t.timeframe as string | null) ?? null,
      latest_value: (t.latest_value as number | null) ?? null,
      peak_value: (t.peak_value as number | null) ?? null,
      avg_value: (t.avg_value as number | null) ?? null,
      growth_pct: (t.growth_pct as number | null) ?? null,
      sparkline: (t.sparkline as number[] | null) ?? null,
      updated_at: (t.updated_at as string | null) ?? null,
      tags: (t.tags as string[] | null) ?? null,
      score: (t.score as number | null) ?? null,
      status: (t.status as string | null) ?? null,
      enriched_at: (t.enriched_at as string | null) ?? null,
      volume_display: (t.volume_display as string | null) ?? null,
      growth_display: (t.growth_display as string | null) ?? null,
      growth_label: (t.growth_label as string | null) ?? null,
      categories: (t.categories as string[] | null) ?? [],
      overall_score: (t.overall_score as number | null) ?? null,
    })) ?? [];

  let bookmarkedIds: string[] = [];
  if (userId && trends.length > 0) {
    const ids = trends.map((t) => t.id);
    const { data: bookmarks } = await supabaseService
      .from('trend_bookmarks')
      .select('trend_id')
      .eq('user_id', userId)
      .in('trend_id', ids);
    bookmarkedIds = (bookmarks ?? []).map((b) => b.trend_id as string);
  }

  return NextResponse.json({
    trends,
    total: count ?? 0,
    page,
    pageSize,
    bookmarkedIds,
    savedCount: savedCount ?? 0,
  });
}
