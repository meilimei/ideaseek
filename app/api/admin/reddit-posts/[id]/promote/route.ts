import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { promoteRedditPostToIdea } from '@/lib/server/adminReddit';

export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  try {
    const result = await promoteRedditPostToIdea({
      postId: id,
      adminUserId: auth.user.id,
    });

    return NextResponse.json({ ideaId: result.ideaId, created: result.created });
  } catch (err) {
    console.error('Failed to promote reddit post:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
