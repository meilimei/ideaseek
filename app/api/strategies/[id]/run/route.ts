import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';
import { createAdminJob, normalizeAdminJobType } from '@/lib/server/adminJobs';
import { assertPlan, getUserPlan, planDeniedResponse } from '@/lib/plan';

type StrategyRow = {
  id: string;
  source: string | null;
  name: string | null;
  config: any;
  created_by: string | null;
};

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy run:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  try {
    assertPlan(plan, 'pro', 'Upgrade to Pro to run ingestion jobs.');
  } catch (err) {
    return planDeniedResponse(err instanceof Error ? err.message : 'Plan denied');
  }

  const { id } = await context.params;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();
  const role =
    typeof profile?.role === 'string' ? profile.role.toLowerCase().trim() : null;
  const isAdmin = role === 'admin';

  let strategy: StrategyRow | null = null;

  if (isAdmin) {
    const { data, error } = await supabaseService
      .from('ingest_strategies')
      .select('id, source, name, config, created_by')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('Failed to load strategy (admin):', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    strategy = (data ?? null) as StrategyRow | null;
  } else {
    const { data, error } = await supabase
      .from('ingest_strategies')
      .select('id, source, name, config, created_by')
      .eq('id', id)
      .eq('created_by', user.id)
      .maybeSingle();
    if (error) {
      console.error('Failed to load strategy:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    strategy = (data ?? null) as StrategyRow | null;
  }

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

  let body: { provider?: string; fetchProvider?: string } = {};
  try {
    body = (await req.json()) as { provider?: string; fetchProvider?: string };
  } catch {
    // ignore parse errors; treat as empty
  }
  const provider =
    typeof body?.fetchProvider === 'string'
      ? body.fetchProvider
      : typeof body?.provider === 'string'
        ? body.provider
        : undefined;

  try {
    const jobId = await createAdminJob(jobType, {
      payload: {
        strategyId: strategy.id,
        strategyKey: strategy.id,
        strategyType: strategy.source,
        config: strategy.config ?? {},
        triggeredBy: 'user',
        userId: user.id,
        ...(provider ? { fetchProvider: provider } : {}),
      },
      strategyId: strategy.id,
      source: strategy.source ?? null,
      createdBy: user.id,
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
