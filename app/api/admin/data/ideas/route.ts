import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type IdeaRow = {
  id: string;
  title: string;
  one_liner: string | null;
  status: string | null;
  source_type: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  pinned: boolean | null;
  featured: boolean | null;
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
  const keyword = url.searchParams.get('q') || undefined;
  const sourceType = url.searchParams.get('source_type') || undefined;
  const status = url.searchParams.get('status') || undefined;
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const createdBy = url.searchParams.get('created_by') || undefined;

  let query = supabase
    .from('ideas')
    .select(
      'id, title, one_liner, status, source_type, created_at, updated_at, deleted_at, pinned, featured',
      { count: 'exact' },
    );

  if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }
  if (keyword && keyword.trim()) {
    const pattern = `%${keyword.trim()}%`;
    query = query.or(`title.ilike.${pattern},one_liner.ilike.${pattern}`);
  }
  if (sourceType) {
    query = query.eq('source_type', sourceType);
  }
  if (status && status !== 'all') {
    query = query.eq('status', status);
  }
  if (createdBy) {
    query = query.eq('created_by', createdBy);
  }

  query = query.order('created_at', { ascending: false, nullsLast: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch ideas:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    items: (data ?? []) as IdeaRow[],
    page,
    pageSize,
    total: count ?? 0,
  });
}
