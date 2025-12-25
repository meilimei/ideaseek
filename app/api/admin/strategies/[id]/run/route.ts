import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { normalizeAdminJobType, createAdminJob } from '@/lib/server/adminJobs';
import { getStrategyById } from '@/lib/server/adminStrategies';

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
    const strategy = await getStrategyById(id);
    if (!strategy) {
      return NextResponse.json({ error: 'Strategy not found' }, { status: 404 });
    }

    const jobType = normalizeAdminJobType(strategy.source, strategy.source);
    if (!jobType) {
      return NextResponse.json(
        { error: `Unsupported source ${strategy.source}` },
        { status: 400 },
      );
    }

    const jobId = await createAdminJob(jobType, {
      payload: {
        strategyId: strategy.id,
        strategyKey: strategy.id,
        strategyType: strategy.source,
        config: strategy.config ?? {},
        triggeredBy: 'admin',
        userId: auth.user.id,
      },
      strategyId: strategy.id,
      source: strategy.source,
      createdBy: auth.user.id,
      dedupeKey: `${strategy.id}:manual:${Date.now()}`,
    });

    return NextResponse.json({ ok: true, jobId, jobType, strategyId: strategy.id });
  } catch (err) {
    console.error('Failed to run strategy now:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
