import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
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
  const snapshotId = Number(id);
  if (!snapshotId) {
    return NextResponse.json({ error: 'Invalid snapshot id' }, { status: 400 });
  }

  // Mark unprocessed and clear errors
  const { error: updErr } = await supabase
    .from('raw_trends_snapshots')
    .update({
      processed: false,
      processed_at: null,
      last_error: null,
    })
    .eq('id', snapshotId);

  if (updErr) {
    console.error('Failed to reset snapshot:', updErr);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  try {
    const jobId = await createAdminJob(
      'process-trends-snapshot',
      { snapshot_id: snapshotId },
      auth.user.id,
    );
    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error('Failed to enqueue reprocess job:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
