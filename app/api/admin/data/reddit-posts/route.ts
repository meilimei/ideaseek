import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type RawRedditPost = {
  id: number;
  source_post_id: string;
  subreddit: string | null;
  title: string | null;
  url: string | null;
  score: number | null;
  num_comments: number | null;
  selftext: string | null;
  created_utc: string | null;
  is_deleted: boolean;
  selected_for_idea: boolean;
  admin_note: string | null;
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
  const subreddit = url.searchParams.get('subreddit') || undefined;
  const q = url.searchParams.get('q') || undefined;
  const minScoreParam = url.searchParams.get('minScore');
  const minScore =
    typeof minScoreParam === 'string' && minScoreParam.length > 0
      ? Number(minScoreParam)
      : undefined;
  const selected = url.searchParams.get('selected');
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

  let query = supabase
    .from('raw_reddit_posts')
    .select(
      'id, source_post_id, subreddit, title, url, score, num_comments, selftext, created_utc, is_deleted, selected_for_idea, admin_note',
      { count: 'exact' },
    );

  if (!includeDeleted) {
    query = query.eq('is_deleted', false);
  }

  if (subreddit) {
    query = query.ilike('subreddit', subreddit);
  }

  if (typeof minScore === 'number' && !Number.isNaN(minScore)) {
    query = query.gte('score', minScore);
  }

  if (selected === 'true') {
    query = query.eq('selected_for_idea', true);
  } else if (selected === 'false') {
    query = query.eq('selected_for_idea', false);
  }

  if (q && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`;
    query = query.or(`title.ilike.${pattern},selftext.ilike.${pattern}`);
  }

  query = query.order('created_utc', { ascending: false, nullsLast: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    console.error('Failed to fetch raw_reddit_posts:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    items: (data ?? []) as RawRedditPost[],
    page,
    pageSize,
    total: count ?? 0,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = body?.id as number | undefined;
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof body.selected_for_idea === 'boolean') {
      updates.selected_for_idea = body.selected_for_idea;
    }
    if (typeof body.is_deleted === 'boolean') {
      updates.is_deleted = body.is_deleted;
    }
    if (typeof body.admin_note === 'string') {
      updates.admin_note = body.admin_note;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('raw_reddit_posts')
      .update(updates)
      .eq('id', id)
      .select(
        'id, source_post_id, subreddit, title, url, score, num_comments, selftext, created_utc, is_deleted, selected_for_idea, admin_note',
      )
      .single();

    if (error) {
      console.error('Failed to update raw_reddit_posts:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(data as RawRedditPost);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('PATCH /admin/data/reddit-posts error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
