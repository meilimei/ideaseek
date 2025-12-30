import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { promoteRedditPostToIdea } from '@/lib/server/adminReddit';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  paramsPromise: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  const params =
    'params' in paramsPromise && paramsPromise.params instanceof Promise
      ? await paramsPromise.params
      : (paramsPromise as { params: { id: string } }).params;

  const supabase = await createServerSupabaseClient();
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for promotion:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('Failed to load profile for promotion:', profileError.message);
  }

  const isAdmin =
    (profile?.role ?? '').toLowerCase().trim() === 'admin';

  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const postId = params?.id;
  if (!postId) {
    return NextResponse.json({ error: 'Missing reddit post id' }, { status: 400 });
  }

  try {
    const result = await promoteRedditPostToIdea({
      postId,
      adminUserId: user.id,
    });

    return NextResponse.json({
      ideaId: result.ideaId,
      created: result.created,
      jobId: result.jobId ?? null,
    });
  } catch (err) {
    console.error('Failed to promote reddit post:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
