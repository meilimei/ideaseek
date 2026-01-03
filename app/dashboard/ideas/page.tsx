import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, GlassCard, AdminSelect } from '@/components/admin/primitives';
import { assertPlan, getUserPlan } from '@/lib/plan';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import IdeasBulkClient from './IdeasBulkClient';

export const dynamic = 'force-dynamic';

type JobRow = {
  id: string | number;
  job_type: string | null;
  created_at: string | null;
};

type IdeaRow = {
  id: string;
  title: string | null;
  status: string | null;
  review_state: string | null;
  tags: string[] | null;
  score_overall: number | null;
  enriched_at: string | null;
  created_at: string | null;
};

type IdeaOutputMeta = {
  outputCount: number;
  latestJobId: string;
  latestProducedAt: string | null;
};

const IDEA_ENRICH_JOB_TYPE = 'idea_enrich';

type IdeaListItem = {
  idea: IdeaRow;
  meta: IdeaOutputMeta;
  source: 'reddit' | 'youtube' | 'trends' | 'other';
  producedAtMs: number;
  createdAtMs: number;
};

type EnrichJob = {
  id: string | number;
  status: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
};

function ideaIdFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const direct = payload['idea_id'];
  if (typeof direct === 'string') return direct;
  const alternate = payload['ideaId'];
  if (typeof alternate === 'string') return alternate;
  return null;
}

function sourceFromJobType(jobType: string | null | undefined) {
  if (!jobType) return 'other';
  const normalized = jobType.toLowerCase().replace(/_/g, '-');
  if (normalized.includes('reddit')) return 'reddit';
  if (normalized.includes('youtube')) return 'youtube';
  if (normalized.includes('trends') || normalized.includes('google-trends')) return 'trends';
  return 'other';
}

async function enqueueEnrichNext(_: FormData) {
  'use server';

  const supabase = await createServerSupabaseClient();
  const { data: actionUser, error: actionUserError } = await supabase.auth.getUser();

  if (actionUserError) {
    console.error('Failed to get user for enrich batch:', actionUserError.message);
  }

  if (!actionUser?.user) {
    return redirect('/login');
  }

  const plan = await getUserPlan({ supabase, userId: actionUser.user.id });
  try {
    assertPlan(plan, 'pro', 'Upgrade to Pro to run ingestion jobs.');
  } catch {
    return redirect('/dashboard/ideas?enrichDenied=1');
  }

  const { data: jobRows } = await supabase
    .from('admin_jobs')
    .select('id, created_at')
    .eq('created_by', actionUser.user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  const jobIds = (jobRows ?? [])
    .map((job) => job.id)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));

  if (jobIds.length === 0) {
    return redirect('/dashboard/ideas?enrichQueued=0');
  }

  const { data: outputLinks } = await supabase
    .from('admin_job_ideas')
    .select('job_id, idea_id, created_at')
    .in('job_id', jobIds)
    .eq('relation_type', 'output')
    .order('created_at', { ascending: false });

  const outputs = (outputLinks ?? []) as Array<{
    job_id: string | number | null;
    idea_id: string | number | null;
    created_at: string | null;
  }>;

  if (outputs.length === 0) {
    return redirect('/dashboard/ideas?enrichQueued=0');
  }

  const latestByIdea = new Map<string, { producedAt: string | null }>();
  for (const link of outputs) {
    const ideaId =
      typeof link.idea_id === 'string' || typeof link.idea_id === 'number'
        ? String(link.idea_id)
        : null;
    if (!ideaId) continue;
    if (!latestByIdea.has(ideaId)) {
      latestByIdea.set(ideaId, { producedAt: link.created_at ?? null });
    }
  }

  const ideaIds = Array.from(latestByIdea.keys());
  const { data: ideaRows } = await supabase
    .from('ideas')
    .select('id, enriched_at, created_at')
    .in('id', ideaIds);

  const candidates = (ideaRows ?? [])
    .filter((idea) => idea.enriched_at == null)
    .map((idea) => {
      const meta = latestByIdea.get(idea.id);
      const producedAtMs = meta?.producedAt ? new Date(meta.producedAt).getTime() : 0;
      const createdAtMs = idea.created_at ? new Date(idea.created_at).getTime() : 0;
      return { id: idea.id, sortKey: producedAtMs || createdAtMs };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 200);

  const { data: pending } = await supabase
    .from('admin_jobs')
    .select('id, status, payload, created_at')
    .eq('created_by', actionUser.user.id)
    .eq('job_type', IDEA_ENRICH_JOB_TYPE)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1000);

  const pendingIdeaIds = new Set<string>();
  for (const job of (pending ?? []) as Array<{ payload?: Record<string, unknown> | null }>) {
    const ideaId = (job.payload as any)?.idea_id;
    if (ideaId) pendingIdeaIds.add(String(ideaId));
  }

  const toEnqueue = candidates
    .filter((idea) => !pendingIdeaIds.has(String(idea.id)))
    .slice(0, 20);

  if (toEnqueue.length === 0) {
    return redirect('/dashboard/jobs?enrichQueued=0&reason=already_pending');
  }

  const rows = toEnqueue.map((idea) => ({
    job_type: IDEA_ENRICH_JOB_TYPE,
    status: 'queued',
    attempts: 0,
    max_attempts: 3,
    created_by: actionUser.user.id,
    payload: { idea_id: idea.id, triggeredBy: 'dashboard-batch' },
  }));

  const { data: inserted, error: insertError } = await supabase
    .from('admin_jobs')
    .insert(rows)
    .select('id');

  if (insertError) {
    console.error('Failed to enqueue enrich batch:', insertError.message);
  }

  const queuedCount = inserted?.length ?? 0;
  return redirect(`/dashboard/jobs?enrichQueued=${queuedCount}`);
}

async function bulkUpdateIdeaState(input: { ids: string[]; to: 'new' | 'reviewed' | 'archived' }) {
  'use server';

  const supabase = await createServerSupabaseClient();
  const { data: actionUser, error: actionUserError } = await supabase.auth.getUser();

  if (actionUserError) {
    console.error('Failed to get user for bulk idea update:', actionUserError.message);
  }

  if (!actionUser?.user) {
    return redirect('/login');
  }

  const rawIds = Array.isArray(input?.ids) ? input.ids : [];
  const ids = Array.from(
    new Set(
      rawIds
        .map((id) => String(id).trim())
        .filter(Boolean),
    ),
  );

  if (ids.length < 1 || ids.length > 200) {
    return { ok: false, updated: 0 };
  }

  const nowIso = new Date().toISOString();
  let patch: Record<string, string | null> = {};

  if (input.to === 'reviewed') {
    patch = { review_state: 'reviewed', reviewed_at: nowIso, archived_at: null };
  } else if (input.to === 'archived') {
    patch = { review_state: 'archived', archived_at: nowIso };
  } else if (input.to === 'new') {
    patch = { review_state: 'new', archived_at: null };
  } else {
    return { ok: false, updated: 0 };
  }

  const { data, error } = await supabase
    .from('ideas')
    .update(patch)
    .in('id', ids)
    .eq('created_by', actionUser.user.id)
    .select('id');

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/dashboard/ideas');
  return { ok: true, updated: data?.length ?? 0 };
}

export default async function DashboardIdeasPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sourceParam =
    typeof searchParams?.source === 'string' ? searchParams.source : 'all';
  const enrichedParam =
    typeof searchParams?.enriched === 'string' ? searchParams.enriched : 'all';
  const sortParam =
    typeof searchParams?.sort === 'string' ? searchParams.sort : 'new';
  const stateRaw =
    typeof searchParams?.state === 'string' ? searchParams.state : 'all';

  const sourceFilter =
    sourceParam === 'reddit' || sourceParam === 'youtube' || sourceParam === 'trends'
      ? sourceParam
      : 'all';
  const enrichedFilter =
    enrichedParam === 'yes' || enrichedParam === 'no' ? enrichedParam : 'all';
  const sortFilter = sortParam === 'score' ? 'score' : 'new';
  const stateFilter = ['all', 'new', 'reviewed', 'archived'].includes(stateRaw)
    ? stateRaw
    : 'all';

  const preservedParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') {
      preservedParams.set(key, value);
    } else if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === 'string') {
          preservedParams.append(key, entry);
        }
      }
    }
  }
  const stateOptions = [
    { value: 'all', label: 'All' },
    { value: 'new', label: 'New' },
    { value: 'reviewed', label: 'Reviewed' },
    { value: 'archived', label: 'Archived' },
  ];

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard ideas:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }


  const { data: jobsData, error: jobsError } = await supabase
    .from('admin_jobs')
    .select('id, job_type, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(200);

  if (jobsError) {
    console.error('Failed to load dashboard jobs for ideas:', jobsError.message);
  }

  const jobs = (jobsData ?? []) as JobRow[];
  if (jobs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">My Ideas</h1>
            <p className="text-sm text-muted-foreground">
              Ideas produced by your ingestion jobs.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/jobs">Back to Jobs</Link>
          </Button>
        </div>
        <GlassCard>
          <CardHeading title="My Ideas" description="No ideas yet." />
          <CardBody className="pt-0 text-sm text-muted-foreground">
            Run an ingest job to generate ideas.
          </CardBody>
        </GlassCard>
      </div>
    );
  }

  const jobIds = jobs
    .map((job) => job.id)
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));

  const { data: linksData, error: linksError } = await supabase
    .from('admin_job_ideas')
    .select('job_id, idea_id, created_at, relation_type')
    .in('job_id', jobIds)
    .eq('relation_type', 'output')
    .order('created_at', { ascending: false });

  if (linksError) {
    console.error('Failed to load job idea links:', linksError.message);
  }

  const links = (linksData ?? []) as Array<{
    job_id: string | number | null;
    idea_id: string | number | null;
    created_at: string | null;
  }>;

  if (links.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-foreground">My Ideas</h1>
            <p className="text-sm text-muted-foreground">
              Ideas produced by your ingestion jobs.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/jobs">Back to Jobs</Link>
          </Button>
        </div>
        <GlassCard>
          <CardHeading title="My Ideas" description="No output ideas recorded." />
          <CardBody className="pt-0 text-sm text-muted-foreground">
            No output ideas recorded for your jobs yet.
          </CardBody>
        </GlassCard>
      </div>
    );
  }

  const ideaMeta = new Map<string, IdeaOutputMeta>();
  for (const link of links) {
    const ideaId =
      typeof link.idea_id === 'string' || typeof link.idea_id === 'number'
        ? String(link.idea_id)
        : null;
    const jobId =
      typeof link.job_id === 'string' || typeof link.job_id === 'number'
        ? String(link.job_id)
        : null;
    if (!ideaId || !jobId) continue;

    const existing = ideaMeta.get(ideaId);
    if (!existing) {
      ideaMeta.set(ideaId, {
        outputCount: 1,
        latestJobId: jobId,
        latestProducedAt: link.created_at ?? null,
      });
    } else {
      existing.outputCount += 1;
    }
  }

  const jobTypeById = new Map<string, string | null>(
    jobs.map((job) => [String(job.id), job.job_type ?? null]),
  );

  const ideaIds = Array.from(ideaMeta.keys());

  let ideasQuery = supabase
    .from('ideas')
    .select('id, title, status, review_state, tags, score_overall, enriched_at, created_at')
    .in('id', ideaIds)
    .eq('created_by', user.id);

  if (stateFilter !== 'all') {
    ideasQuery = ideasQuery.eq('review_state', stateFilter);
  }

  if (sortFilter === 'score') {
    ideasQuery = ideasQuery
      .order('score_overall', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });
  } else {
    ideasQuery = ideasQuery.order('created_at', { ascending: false });
  }

  const { data: ideasData, error: ideasError } = await ideasQuery;

  if (ideasError) {
    console.error('Failed to load ideas for dashboard:', ideasError.message);
  }

  const { data: enrichJobsData, error: enrichJobsError } = await supabase
    .from('admin_jobs')
    .select('id, status, payload, created_at')
    .eq('created_by', user.id)
    .eq('job_type', IDEA_ENRICH_JOB_TYPE)
    .order('created_at', { ascending: false })
    .limit(500);

  if (enrichJobsError) {
    console.error('Failed to load enrich jobs:', enrichJobsError.message);
  }

  const ideaIdSet = new Set(ideaIds);
  const latestEnrichJobByIdeaId = new Map<string, EnrichJob>();
  for (const job of (enrichJobsData ?? []) as EnrichJob[]) {
    const ideaId = ideaIdFromPayload(job.payload ?? null);
    if (!ideaId || !ideaIdSet.has(ideaId)) continue;
    if (!latestEnrichJobByIdeaId.has(ideaId)) {
      latestEnrichJobByIdeaId.set(ideaId, job);
    }
  }

  const ideaById = new Map<string, IdeaRow>(
    (ideasData ?? []).map((idea) => [idea.id, idea as IdeaRow]),
  );

  const ideaList: IdeaListItem[] = ideaIds
    .map((id) => {
      const idea = ideaById.get(id);
      const meta = ideaMeta.get(id);
      if (!idea || !meta) return null;
      const jobType = jobTypeById.get(meta.latestJobId) ?? null;
      const producedAtMs = meta.latestProducedAt
        ? new Date(meta.latestProducedAt).getTime()
        : 0;
      const createdAtMs = idea.created_at ? new Date(idea.created_at).getTime() : 0;
      return {
        idea,
        meta,
        source: sourceFromJobType(jobType),
        producedAtMs,
        createdAtMs,
      };
    })
    .filter(Boolean) as IdeaListItem[];

  let filtered = ideaList;
  if (sourceFilter !== 'all') {
    filtered = filtered.filter((row) => row.source === sourceFilter);
  }
  if (enrichedFilter === 'yes') {
    filtered = filtered.filter((row) => row.idea.enriched_at != null);
  } else if (enrichedFilter === 'no') {
    filtered = filtered.filter((row) => row.idea.enriched_at == null);
  }

  filtered.sort((a, b) => {
    if (sortFilter === 'score') {
      const aScore = a.idea.score_overall;
      const bScore = b.idea.score_overall;
      if (aScore == null && bScore == null) {
        return b.createdAtMs - a.createdAtMs;
      }
      if (aScore == null) return 1;
      if (bScore == null) return -1;
      if (bScore !== aScore) return bScore - aScore;
      return b.createdAtMs - a.createdAtMs;
    }
    return b.createdAtMs - a.createdAtMs;
  });

  const bulkIdeas = filtered.map((row) => {
    const enrichJob = latestEnrichJobByIdeaId.get(row.idea.id) ?? null;
    return {
      id: row.idea.id,
      title: row.idea.title?.trim() || row.idea.id.slice(0, 8),
      review_state: row.idea.review_state ?? 'new',
      status: row.idea.status ?? null,
      tags: row.idea.tags ?? [],
      score_overall: row.idea.score_overall ?? null,
      created_at: row.idea.created_at ?? null,
      enriched_at: row.idea.enriched_at ?? null,
      latest_job_id: row.meta.latestJobId,
      latest_produced_at: row.meta.latestProducedAt,
      enrich_job_id: enrichJob?.id ?? null,
      enrich_job_status: enrichJob?.status ?? null,
    };
  });

  const notEnrichedCount = ideaList.filter((row) => row.idea.enriched_at == null).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">My Ideas</h1>
          <p className="text-sm text-muted-foreground">
            Ideas produced by your ingestion jobs.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/jobs">Back to Jobs</Link>
        </Button>
      </div>

      <GlassCard>
        <CardBody className="p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <form
              method="get"
              className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:col-start-1 lg:row-start-1 lg:grid-cols-4"
            >
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Source</label>
                <AdminSelect name="source" defaultValue={sourceFilter}>
                  <option value="all">All</option>
                  <option value="reddit">Reddit</option>
                  <option value="youtube">YouTube</option>
                  <option value="trends">Trends</option>
                </AdminSelect>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Enriched</label>
                <AdminSelect name="enriched" defaultValue={enrichedFilter}>
                  <option value="all">All</option>
                  <option value="yes">Enriched</option>
                  <option value="no">Not enriched</option>
                </AdminSelect>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground">Sort</label>
                <AdminSelect name="sort" defaultValue={sortFilter}>
                  <option value="new">Newest</option>
                  <option value="score">Score (High -&gt; Low)</option>
                </AdminSelect>
              </div>
              <input type="hidden" name="state" value={stateFilter} />
              <Button type="submit" size="sm" variant="secondary" className="h-10">
                Apply
              </Button>
            </form>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:col-span-2 lg:row-start-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Status</span>
                <div className="flex flex-wrap gap-2">
                  {stateOptions.map((option) => {
                    const params = new URLSearchParams(preservedParams);
                    params.set('state', option.value);
                    const query = params.toString();
                    const href = query ? `?${query}` : '';
                    const isActive = stateFilter === option.value;
                    return (
                      <Button
                        key={option.value}
                        asChild
                        size="sm"
                        variant={isActive ? 'secondary' : 'ghost'}
                      >
                        <Link href={href}>{option.label}</Link>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{filtered.length} results</span>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-end lg:col-start-2 lg:row-start-1">
              <span>Not enriched: {notEnrichedCount}</span>
              <form action={enqueueEnrichNext}>
                <Button
                  type="submit"
                  size="sm"
                  variant="secondary"
                  disabled={notEnrichedCount === 0}
                >
                  Enrich next 20
                </Button>
              </form>
              <span className="text-xs text-muted-foreground">
                Enrich next 20 (skips ideas already queued/running).
              </span>
            </div>
          </div>
        </CardBody>
      </GlassCard>

      <GlassCard>
        <CardHeading
          title="My Ideas"
          description="Ideas linked to your recent ingestion runs."
        />
        <CardBody className="pt-0">
          <IdeasBulkClient
            ideas={bulkIdeas}
            onBulkUpdate={bulkUpdateIdeaState}
          />
        </CardBody>
      </GlassCard>
    </div>
  );
}
