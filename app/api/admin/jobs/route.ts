import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import {
  createAdminJob,
  listAdminJobs,
  normalizeAdminJobType,
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
    const strategyId = body?.strategyId ?? body?.strategy_id;
    const source = body?.source ?? null;
    const jobTypeRaw = (body?.job_type ?? body?.type) as string | undefined;
    const jobType: AdminJobType | null = normalizeAdminJobType(jobTypeRaw, source);
    const payload = (body?.payload as Record<string, unknown>) ?? {};

    if (!jobType) {
      return NextResponse.json(
        { error: 'Missing or unsupported job_type' },
        { status: 400 },
      );
    }
    if (strategyId !== undefined && strategyId !== null && typeof strategyId !== 'string') {
      return NextResponse.json(
        { error: 'strategyId must be a string if provided' },
        { status: 400 },
      );
    }

    const jobId = await createAdminJob(jobType, {
      payload,
      strategyId: strategyId ?? null,
      source,
      createdBy: auth.user.id,
    });

    return NextResponse.json({ ok: true, jobId });
  } catch (err) {
    console.error('Failed to create admin job:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
