import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type SnapshotRow = {
  id: number;
  snapshot_key: string | null;
  strategy_name: string | null;
  keyword: string | null;
  geo: string | null;
  timeframe: string | null;
  source: string | null;
  processed: boolean | null;
  processed_at: string | null;
  last_error: string | null;
  created_at: string | null;
};

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.max(
    1,
    Math.min(100, parseInt(url.searchParams.get('pageSize') || '25', 10)),
  );
  const strategy = url.searchParams.get('strategy') || undefined;
  const keyword = url.searchParams.get('keyword') || undefined;
  const processed = url.searchParams.get('processed') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;

  let query = supabase
    .from('raw_trends_snapshots')
    .select(
      'id, snapshot_key, strategy_name, keyword, geo, timeframe, source, processed, processed_at, last_error, created_at',
      { count: 'exact' },
    );

  if (strategy) {
    query = query.ilike('strategy_name', `%${strategy}%`);
  }
  if (keyword) {
    query = query.ilike('keyword', `%${keyword}%`);
  }
  if (processed === 'processed') {
    query = query.eq('processed', true);
  } else if (processed === 'unprocessed') {
    query = query.or('processed.is.null,processed.eq.false');
  }
  if (startDate) {
    query = query.gte('created_at', startDate);
  }
  if (endDate) {
    query = query.lte('created_at', endDate);
  }

  query = query.order('created_at', { ascending: false, nullsLast: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch raw_trends_snapshots:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data ?? []) as SnapshotRow[],
    page,
    pageSize,
    total: count ?? 0,
  });
}
