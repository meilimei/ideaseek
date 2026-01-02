import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard, AdminSelect } from '@/components/admin/primitives';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { assertPlan, getUserPlan } from '@/lib/plan';
import { createServerSupabaseClient } from '@/lib/supabase/server';

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

function formatRelative(isoDate: string | null | undefined) {
  if (!isoDate) return '—';
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '—';

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (Math.abs(diffSeconds) < 30) return 'just now';

  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: 'year', seconds: 60 * 60 * 24 * 365 },
    { unit: 'month', seconds: 60 * 60 * 24 * 30 },
    { unit: 'week', seconds: 60 * 60 * 24 * 7 },
    { unit: 'day', seconds: 60 * 60 * 24 },
    { unit: 'hour', seconds: 60 * 60 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 },
  ];

  for (const { unit, seconds } of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === 'second') {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return 'just now';
}

function ideaIdFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const direct = payload['idea_id'];
  if (typeof direct === 'string') return direct;
  const alternate = payload['ideaId'];
  if (typeof alternate === 'string') return alternate;
  return null;
}

function enrichBadgeFor(idea: IdeaRow, job?: EnrichJob | null) {
  if (idea.enriched_at) {
    return {
      label: 'Enriched',
      className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    };
  }
  if (!job) {
    return { label: 'Not queued', className: 'bg-secondary/40 text-foreground border-border/50' };
  }
  const status = (job.status ?? '').toLowerCase();
  if (status === 'queued') {
    return { label: 'Queued', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }
  if (status === 'running') {
    return { label: 'Running', className: 'bg-blue-500/15 text-blue-200 border-blue-500/30' };
  }
  if (status === 'success') {
    return { label: 'Done', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' };
  }
  if (status === 'error') {
    return { label: 'Error', className: 'bg-rose-500/15 text-rose-200 border-rose-500/30' };
  }
  return { label: 'Not queued', className: 'bg-secondary/40 text-foreground border-border/50' };
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

export default async function DashboardIdeasPage({
  searchParams,
}: {
  searchParams?: { source?: string; enriched?: string; sort?: string };
}) {
  const sourceParam =
    typeof searchParams?.source === 'string' ? searchParams.source : 'all';
  const enrichedParam =
    typeof searchParams?.enriched === 'string' ? searchParams.enriched : 'all';
  const sortParam =
    typeof searchParams?.sort === 'string' ? searchParams.sort : 'newest';

  const sourceFilter =
    sourceParam === 'reddit' || sourceParam === 'youtube' || sourceParam === 'trends'
      ? sourceParam
      : 'all';
  const enrichedFilter =
    enrichedParam === 'yes' || enrichedParam === 'no' ? enrichedParam : 'all';
  const sortFilter = sortParam === 'score' ? 'score' : 'newest';

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

  const { data: ideasData, error: ideasError } = await supabase
    .from('ideas')
    .select('id, title, status, tags, score_overall, enriched_at, created_at')
    .in('id', ideaIds);

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
        return (b.producedAtMs || b.createdAtMs) - (a.producedAtMs || a.createdAtMs);
      }
      if (aScore == null) return 1;
      if (bScore == null) return -1;
      if (bScore !== aScore) return bScore - aScore;
      return (b.producedAtMs || b.createdAtMs) - (a.producedAtMs || a.createdAtMs);
    }
    return (b.producedAtMs || b.createdAtMs) - (a.producedAtMs || a.createdAtMs);
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
        <CardBody className="space-y-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
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
                <option value="newest">Newest</option>
                <option value="score">Highest score</option>
              </AdminSelect>
            </div>
            <Button type="submit" size="sm" variant="secondary" className="h-10">
              Apply
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{filtered.length} results</span>
            <div className="flex flex-wrap items-center gap-3">
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
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Idea</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Enrich</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Produced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filtered.map((row) => {
                const { idea, meta } = row;
                const tags = idea.tags ?? [];
                const visibleTags = tags.slice(0, 6);
                const overflowCount = Math.max(0, tags.length - visibleTags.length);
                const title = idea.title?.trim() || idea.id.slice(0, 8);
                const enrichJob = latestEnrichJobByIdeaId.get(idea.id) ?? null;
                const enrichBadge = enrichBadgeFor(idea, enrichJob);
                return (
                  <tr key={idea.id} className="align-top">
                    <td className="px-3 py-3">
                      <Link
                        href={`/dashboard/ideas/${idea.id}?job=${meta.latestJobId}`}
                        className="text-sm font-semibold text-foreground hover:underline"
                      >
                        {title}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {idea.status ? (
                        <StatusBadge status={idea.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {enrichJob ? (
                        <Link href={`/dashboard/jobs/${enrichJob.id}`} className="hover:underline">
                          <Badge className={enrichBadge.className}>{enrichBadge.label}</Badge>
                        </Link>
                      ) : (
                        <Badge className={enrichBadge.className}>{enrichBadge.label}</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {idea.score_overall != null
                        ? Number(idea.score_overall).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {visibleTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="capitalize">
                            {tag}
                          </Badge>
                        ))}
                        {overflowCount > 0 && (
                          <span className="text-xs text-muted-foreground">
                            +{overflowCount}
                          </span>
                        )}
                        {tags.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/dashboard/jobs/${meta.latestJobId}`}
                          className="text-xs text-primary hover:underline"
                        >
                          Produced by Job #{meta.latestJobId}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          Produced {formatRelative(meta.latestProducedAt)}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={6}>
                    No ideas match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </DataTable>
        </CardBody>
      </GlassCard>
    </div>
  );
}
