import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type BulkMode = 'preview' | 'archive' | 'delete';

type BulkRequest = {
  mode?: BulkMode;
  email?: string;
  confirmDelete?: string;
  confirmEmail?: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function resolveUserId(email: string) {
  const { data, error } = await supabase
    .schema('auth')
    .from('users')
    .select('id, email')
    .eq('email', email)
    .limit(2);
  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.length !== 1) {
    return null;
  }
  return data[0]?.id ?? null;
}

async function fetchIdeaIds(userId: string) {
  const ids: string[] = [];
  const batchSize = 1000;
  let from = 0;
  while (true) {
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from('ideas')
      .select('id')
      .eq('created_by', userId)
      .range(from, to);
    if (error) {
      throw new Error(error.message);
    }
    const batch = (data ?? [])
      .map((row) => row.id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    ids.push(...batch);
    if (!data || data.length < batchSize) break;
    from += batchSize;
  }
  return ids;
}

async function countByIdeaIds(
  table: string,
  column: string,
  ids: string[],
): Promise<number> {
  if (ids.length === 0) return 0;
  const batchSize = 1000;
  let total = 0;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .in(column, batch);
    if (error) {
      throw new Error(error.message);
    }
    total += count ?? 0;
  }
  return total;
}

async function unlinkRawRedditPosts(ideaIds: string[]) {
  if (ideaIds.length === 0) return 0;
  const batchSize = 1000;
  let total = 0;
  for (let i = 0; i < ideaIds.length; i += batchSize) {
    const batch = ideaIds.slice(i, i + batchSize);
    const { data, error } = await supabase
      .from('raw_reddit_posts')
      .update({ promoted_idea_id: null })
      .in('promoted_idea_id', batch)
      .select('id');
    if (error) {
      throw new Error(error.message);
    }
    total += data?.length ?? 0;
  }
  return total;
}

async function deleteIdeas(ideaIds: string[]) {
  if (ideaIds.length === 0) return 0;
  const batchSize = 1000;
  let total = 0;
  for (let i = 0; i < ideaIds.length; i += batchSize) {
    const batch = ideaIds.slice(i, i + batchSize);
    const { data, error } = await supabase.from('ideas').delete().in('id', batch).select('id');
    if (error) {
      throw new Error(error.message);
    }
    total += data?.length ?? 0;
  }
  return total;
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: BulkRequest | null = null;
  try {
    body = (await request.json()) as BulkRequest;
  } catch {
    body = null;
  }

  const mode = body?.mode;
  if (!mode || !['preview', 'archive', 'delete'].includes(mode)) {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }

  const rawEmail = body?.email;
  if (!rawEmail || typeof rawEmail !== 'string') {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }
  const email = normalizeEmail(rawEmail);
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  try {
    const userId = await resolveUserId(email);
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (mode === 'preview') {
      const ideaIds = await fetchIdeaIds(userId);
      const ideaCount = ideaIds.length;
      const [adminJobIdeas, ideaEvidence, savedIdeas, rawRedditPosts] = await Promise.all([
        countByIdeaIds('admin_job_ideas', 'idea_id', ideaIds),
        countByIdeaIds('idea_evidence', 'idea_id', ideaIds),
        countByIdeaIds('saved_ideas', 'idea_id', ideaIds),
        countByIdeaIds('raw_reddit_posts', 'promoted_idea_id', ideaIds),
      ]);

      return NextResponse.json({
        userId,
        email,
        ideaCount,
        adminJobIdeas,
        ideaEvidence,
        savedIdeas,
        rawRedditPosts,
      });
    }

    if (mode === 'archive') {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('ideas')
        .update({ archived_at: nowIso, visibility: 'private' })
        .eq('created_by', userId)
        .select('id');
      if (error) {
        throw new Error(error.message);
      }
      return NextResponse.json({
        ok: true,
        mode,
        email,
        archivedIdeas: data?.length ?? 0,
      });
    }

    const confirmDelete = typeof body?.confirmDelete === 'string' ? body.confirmDelete : '';
    const confirmEmail = typeof body?.confirmEmail === 'string' ? body.confirmEmail : '';
    if (confirmDelete.trim() !== 'DELETE') {
      return NextResponse.json({ error: 'Confirm DELETE to proceed.' }, { status: 400 });
    }
    if (normalizeEmail(confirmEmail) !== email) {
      return NextResponse.json({ error: 'Confirm email does not match.' }, { status: 400 });
    }

    const ideaIds = await fetchIdeaIds(userId);
    const unlinkedRawPosts = await unlinkRawRedditPosts(ideaIds);
    const deletedIdeas = await deleteIdeas(ideaIds);

    return NextResponse.json({
      ok: true,
      mode,
      email,
      deletedIdeas,
      unlinkedRawPosts,
    });
  } catch (err) {
    console.error('Bulk ideas action failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to process request' },
      { status: 500 },
    );
  }
}
