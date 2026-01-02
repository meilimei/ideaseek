import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  createAdminJob,
  listAdminJobs,
  normalizeAdminJobType,
  type AdminJobType,
} from '@/lib/server/adminJobs';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { assertPlan, getUserPlan, planDeniedResponse } from '@/lib/plan';
import { assertDailyQuota, getDailyUsageCount, recordUsageEvent } from '@/lib/quota';

const INGEST_JOB_TYPES = new Set<AdminJobType>([
  'reddit-ingest',
  'youtube-ingest',
  'trends-ingest',
  'google-trends-ingest',
]);

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
    const jobIds = jobs.map((job) => String(job.id)).filter(Boolean);

    let relatedIdeasByJob = new Map<string, { id: string; title: string | null; status: string | null }[]>();
    let relatedIdeaCounts = new Map<string, number>();

    if (jobIds.length > 0) {
      const { data: links, error: linksError } = await supabase
        .from('admin_job_ideas')
        .select('job_id, idea_id, relation_type')
        .in('job_id', jobIds);

      if (!linksError && links) {
        const ideaIds = Array.from(
          new Set(
            links
              .map((link) => link.idea_id)
              .filter((value): value is string => typeof value === 'string' && value.length > 0),
          ),
        );

        let ideasById = new Map<string, { id: string; title: string | null; status: string | null }>();
        if (ideaIds.length > 0) {
          const { data: ideas, error: ideasError } = await supabase
            .from('ideas')
            .select('id, title, status')
            .in('id', ideaIds);

          if (!ideasError && ideas) {
            ideasById = new Map(
              ideas.map((idea) => [
                idea.id,
                {
                  id: idea.id,
                  title: idea.title ?? null,
                  status: idea.status ?? null,
                },
              ]),
            );
          }
        }

        for (const link of links) {
          const jobId = String(link.job_id);
          const ideaId =
            typeof link.idea_id === 'string'
              ? link.idea_id
              : link.idea_id != null
                ? String(link.idea_id)
                : null;
          if (!jobId || !ideaId) continue;
          relatedIdeaCounts.set(jobId, (relatedIdeaCounts.get(jobId) ?? 0) + 1);
          const idea = ideasById.get(ideaId);
          if (!idea) continue;
          const list = relatedIdeasByJob.get(jobId) ?? [];
          list.push(idea);
          relatedIdeasByJob.set(jobId, list);
        }

        for (const [jobId, list] of relatedIdeasByJob.entries()) {
          list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
          relatedIdeasByJob.set(jobId, list);
        }
      }
    }

    const jobsWithIdeas = jobs.map((job) => {
      const jobKey = String(job.id);
      const relatedIdeas = relatedIdeasByJob.get(jobKey) ?? [];
      const relatedIdeasCount = relatedIdeaCounts.get(jobKey) ?? relatedIdeas.length;
      return {
        ...job,
        relatedIdeas: relatedIdeas.slice(0, 2),
        relatedIdeasCount,
      };
    });

    return NextResponse.json({ jobs: jobsWithIdeas });
  } catch (err) {
    console.error('Failed to list admin jobs:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for job enqueue:', userError.message);
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

    if (plan !== 'admin' && jobType && INGEST_JOB_TYPES.has(jobType)) {
      try {
        const used = await getDailyUsageCount(supabase, user.id, 'ingest');
        assertDailyQuota(plan, 'ingest', used);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const code = (err as { code?: string }).code;
        if (code === 'quota_exceeded' || message === 'quota_exceeded') {
          return NextResponse.json(
            { error: 'quota_exceeded', message: 'Daily ingest quota exceeded.' },
            { status: 403 },
          );
        }
        throw err;
      }
    }

    const jobId = await createAdminJob(jobType, {
      payload,
      strategyId: strategyId ?? null,
      source,
      createdBy: user.id,
    });

    if (jobType && INGEST_JOB_TYPES.has(jobType)) {
      await recordUsageEvent(supabase, {
        userId: user.id,
        eventType: 'ingest',
        jobId: typeof jobId === 'number' ? jobId : Number.parseInt(String(jobId), 10),
        meta: {
          job_type: jobType,
          triggeredBy: payload?.triggeredBy ?? 'dashboard',
        },
      });
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
