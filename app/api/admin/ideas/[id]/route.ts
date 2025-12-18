import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { updateIdeaFlags } from '@/lib/server/adminIdeas';

export async function PATCH(
  request: Request,
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

  let body: { action?: string; value?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // ignore
  }

  const { action, value } = body;
  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  try {
    let changes: Record<string, unknown> = {};
    if (action === 'publish') {
      changes = { published: Boolean(value), softDelete: false };
    } else if (action === 'pin') {
      changes = { pinned: Boolean(value) };
    } else if (action === 'feature') {
      changes = { featured: Boolean(value) };
    } else if (action === 'soft_delete') {
      changes = { softDelete: Boolean(value) };
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const updated = await updateIdeaFlags(id, changes, auth.user.id);
    return NextResponse.json(updated);
  } catch (err) {
    console.error('Failed to update idea flags:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
