import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import {
  createAdminJob,
  listAdminJobs,
  runAdminJob,
  type AdminJobType,
} from '@/lib/server/adminJobs';

export async function GET() {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const jobs = await listAdminJobs(50);
    return NextResponse.json({ jobs });
  } catch (err) {
    console.error('Failed to list admin jobs:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const jobType = body?.job_type as AdminJobType | undefined;
    const payload = (body?.payload as Record<string, unknown>) ?? {};

    if (!jobType) {
      return NextResponse.json({ error: 'Missing job_type' }, { status: 400 });
    }

    const jobId = await createAdminJob(jobType, payload);
    try {
      await runAdminJob(jobId, jobType);
    } catch (err) {
      console.error(`[admin job ${jobId}] failed:`, err);
    }

    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error('Failed to create admin job:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
