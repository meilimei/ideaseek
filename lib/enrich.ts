'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { assertPlan, getUserPlan } from '@/lib/plan';

const IDEA_ENRICH_JOB_TYPE = 'idea_enrich';

type EnqueueInput = {
  ideaId: string;
  force?: boolean;
  rerunOf?: number | null;
  triggeredBy?: string;
};

export async function enqueueIdeaEnrich(
  input: EnqueueInput,
): Promise<
  | { ok: true; jobId: number }
  | { ok: false; reason: 'already_pending'; pendingJobId: number }
> {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for enqueueIdeaEnrich:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    throw new Error('Unauthorized');
  }

  const ideaId = input.ideaId?.trim();
  if (!ideaId) {
    throw new Error('Missing ideaId');
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  assertPlan(plan, 'pro', 'Upgrade to Pro to run ingestion jobs.');

  if (!input.force) {
    const { data: pending, error: pendingError } = await supabase
      .from('admin_jobs')
      .select('id, status, payload, created_at')
      .eq('created_by', user.id)
      .eq('job_type', IDEA_ENRICH_JOB_TYPE)
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false })
      .limit(200);

    if (pendingError) {
      throw new Error(pendingError.message);
    }

    for (const job of pending ?? []) {
      const payload = (job as { payload?: Record<string, unknown> | null }).payload ?? null;
      const pendingIdeaId =
        typeof payload?.idea_id === 'string'
          ? payload.idea_id
          : typeof payload?.ideaId === 'string'
            ? payload.ideaId
            : null;
      if (pendingIdeaId && pendingIdeaId === ideaId) {
        const pendingJobId =
          typeof job.id === 'number' ? job.id : Number.parseInt(String(job.id), 10);
        return {
          ok: false,
          reason: 'already_pending',
          pendingJobId: pendingJobId || 0,
        };
      }
    }
  }

  const payload = {
    idea_id: ideaId,
    triggeredBy: input.triggeredBy ?? 'dashboard-rerun',
    force: Boolean(input.force),
    rerunOf: input.rerunOf ?? null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('admin_jobs')
    .insert({
      job_type: IDEA_ENRICH_JOB_TYPE,
      status: 'queued',
      attempts: 0,
      max_attempts: 3,
      created_by: user.id,
      payload,
    })
    .select('id')
    .single();

  if (insertError) {
    throw new Error(insertError.message);
  }

  const jobIdRaw = inserted?.id;
  const jobId =
    typeof jobIdRaw === 'number' ? jobIdRaw : Number.parseInt(String(jobIdRaw), 10);
  if (!Number.isFinite(jobId)) {
    throw new Error('Failed to enqueue idea_enrich job');
  }

  return { ok: true, jobId };
}
