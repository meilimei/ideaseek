import { NextResponse } from 'next/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';

type TrendCard = {
  id: string;
  slug: string;
  title: string;
  source_primary: string;
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
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.max(
    1,
    Math.min(50, parseInt(url.searchParams.get('pageSize') || '12', 10)),
  );

  let query = supabaseService
    .from('trends')
    .select(
      'id, slug, title, source_primary, volume_display, growth_display, growth_label, categories, overall_score, last_seen, growth_rate, volume_score',
      { count: 'exact' },
    )
    .eq('is_public', true);

  if (q.trim()) {
    query = query.ilike('title', `%${q.trim()}%`);
  }

  if (source !== 'all') {
    query = query.eq('source_primary', source);
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
      volume_display: (t.volume_display as string | null) ?? null,
      growth_display: (t.growth_display as string | null) ?? null,
      growth_label: (t.growth_label as string | null) ?? null,
      categories: (t.categories as string[] | null) ?? [],
      overall_score: (t.overall_score as number | null) ?? null,
    })) ?? [];

  return NextResponse.json({
    trends,
    total: count ?? 0,
    page,
    pageSize,
  });
}
