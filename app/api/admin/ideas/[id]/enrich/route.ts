import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createAdminJob } from '@/lib/server/adminJobs';

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
    const jobId = await createAdminJob('idea_enrich', {
      payload: { idea_id: id, triggeredBy: 'admin', userId: auth.user.id },
      createdBy: auth.user.id,
      dedupeKey: `${id}:manual:${Date.now()}`,
    });

    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error('Failed to enqueue idea_enrich:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
