import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { getUserPlan } from '@/lib/plan';
import { QUOTAS, getDailyUsageCount, getMonthlyUsageCount } from '@/lib/quota';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RunJobActions from './RunJobActions';

export const dynamic = 'force-dynamic';

const IDEA_ENRICH_JOB_TYPE = 'idea_enrich';
const INGEST_JOB_TYPES = new Set(['reddit-ingest', 'youtube-ingest', 'trends-ingest']);

type JobRow = {
  id: string | number;
  job_type: string | null;
  status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  created_at: string | null;
  next_run_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  started_at: string | null;
  finished_at: string | null;
  payload: Record<string, unknown> | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function formatRelativeTime(value: Date | null) {
  if (!value) return null;
  const diffMs = Date.now() - value.getTime();
  if (!Number.isFinite(diffMs)) return null;
  const seconds = Math.max(0, Math.floor(diffMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatQuotaLimit(limit: number) {
  return limit === Infinity ? '∞' : String(limit);
}

function getJobHint(job: JobRow, now: Date, runnerOnline: boolean): string | null {
  if (job.status === 'queued') {
    if (!runnerOnline) return 'Runner offline';
    if (job.next_run_at) {
      const nextRun = new Date(job.next_run_at);
      if (!Number.isNaN(nextRun.getTime()) && nextRun.getTime() > now.getTime()) {
        return 'Scheduled';
      }
    }
    if (job.created_at) {
      const createdAt = new Date(job.created_at);
      if (!Number.isNaN(createdAt.getTime())) {
        const queuedForMs = now.getTime() - createdAt.getTime();
        if (queuedForMs > 2 * 60_000) return 'Waiting in queue';
      }
    }
    return 'Queued';
  }

  if (job.status === 'running') {
    if (job.locked_at) {
      const lockedAt = new Date(job.locked_at);
      if (!Number.isNaN(lockedAt.getTime())) {
        const lockAgeMs = now.getTime() - lockedAt.getTime();
        if (lockAgeMs > 10 * 60_000) return 'May be stuck (stale lock)';
      }
    }
    return 'Running';
  }

  return null;
}

export default async function DashboardJobsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard jobs:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  const canRun = plan === 'pro' || plan === 'admin';

  let usedIngestDaily = 0;
  let usedEnrichDaily = 0;
  let usedIngestMonthly = 0;
  let usedEnrichMonthly = 0;
  try {
    [
      usedIngestDaily,
      usedEnrichDaily,
      usedIngestMonthly,
      usedEnrichMonthly,
    ] = await Promise.all([
      getDailyUsageCount(supabase, user.id, 'ingest'),
      getDailyUsageCount(supabase, user.id, 'enrich'),
      getMonthlyUsageCount(supabase, user.id, 'ingest'),
      getMonthlyUsageCount(supabase, user.id, 'enrich'),
    ]);
  } catch (err) {
    console.error('Failed to load quota usage:', err);
  }

  const ingestDailyLimit = QUOTAS[plan].ingestPerDay;
  const enrichDailyLimit = QUOTAS[plan].enrichPerDay;
  const ingestMonthlyLimit = QUOTAS[plan].ingestPerMonth;
  const enrichMonthlyLimit = QUOTAS[plan].enrichPerMonth;

  const { data: workers, error: workersError } = await supabase
    .from('admin_workers')
    .select('worker, last_seen_at')
    .order('last_seen_at', { ascending: false })
    .limit(1);

  if (workersError) {
    console.error('Failed to load admin worker heartbeat:', workersError.message);
  }

  const lastSeenRaw = workers?.[0]?.last_seen_at ?? null;
  const lastSeen = lastSeenRaw ? new Date(lastSeenRaw) : null;
  const runnerOnline = lastSeen ? Date.now() - lastSeen.getTime() < 30_000 : false;
  const lastSeenLabel = formatRelativeTime(lastSeen);

  const { data, error } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, created_at, next_run_at, locked_at, locked_by, started_at, finished_at, attempts, max_attempts, payload',
    )
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to load dashboard jobs:', error.message);
  }

  const jobs = (data ?? []) as JobRow[];
  const jobIds = jobs.map((job) => job.id).filter((id) => id !== null && id !== undefined);

  const { data: outputLinks, error: outputLinksError } = await supabase
    .from('admin_job_ideas')
    .select('job_id, idea_id, relation_type')
    .in(
      'job_id',
      jobIds.map((id) => String(id)),
    )
    .eq('relation_type', 'output');

  if (outputLinksError) {
    console.error('Failed to load output counts for dashboard jobs:', outputLinksError.message);
  }

  const outputCountByJobId = new Map<number, number>();
  for (const link of outputLinks ?? []) {
    const jid = Number((link as { job_id?: string | number | null }).job_id);
    if (Number.isNaN(jid)) continue;
    outputCountByJobId.set(jid, (outputCountByJobId.get(jid) ?? 0) + 1);
  }
  void outputCountByJobId;

  const ideaIds = Array.from(
    new Set(
      jobs
        .filter((job) => job.job_type === IDEA_ENRICH_JOB_TYPE)
        .map((job) => (job as { payload?: Record<string, unknown> | null }).payload?.idea_id)
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  );

  const ideaTitleById = new Map<string, string>();
  if (ideaIds.length > 0) {
    const { data: ideas, error: ideasError } = await supabase
      .from('ideas')
      .select('id, title')
      .in('id', ideaIds);

    if (ideasError) {
      console.error('Failed to load idea titles for dashboard jobs:', ideasError.message);
    }

    for (const idea of ideas ?? []) {
      ideaTitleById.set(String(idea.id), idea.title ?? '');
    }
  }
  void ideaTitleById;

  const now = new Date();

  const errorParam = searchParams?.error;
  const errorValue = Array.isArray(errorParam) ? errorParam[0] : errorParam;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">My Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Review ingestion and processing jobs you created.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      {errorValue === 'quota_ingest' && (
        <Alert variant="destructive">
          Daily ingest quota reached.
        </Alert>
      )}
      {errorValue === 'quota_ingest_month' && (
        <Alert variant="destructive">
          Monthly ingest quota reached.
        </Alert>
      )}
      {errorValue === 'quota_enrich' && (
        <Alert variant="destructive">
          Daily enrich quota reached.
        </Alert>
      )}
      {errorValue === 'quota_enrich_month' && (
        <Alert variant="destructive">
          Monthly enrich quota reached.
        </Alert>
      )}

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={runnerOnline ? 'secondary' : 'destructive'}>
            {runnerOnline ? 'Online' : 'Offline'}
          </Badge>
          <span className="text-foreground">
            Runner: {runnerOnline ? 'Online' : 'Offline'}
          </span>
          <span className="text-muted-foreground">
            {runnerOnline
              ? `last seen ${lastSeenLabel ?? 'just now'}`
              : 'start your job runner to process queued jobs'}
          </span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
          <span className="text-foreground">Today usage</span>
          <span>
            Ingest: {usedIngestDaily}/{formatQuotaLimit(ingestDailyLimit)}
          </span>
          <span>
            Enrich: {usedEnrichDaily}/{formatQuotaLimit(enrichDailyLimit)}
          </span>
          <span className="text-foreground">This month</span>
          <span>
            Ingest: {usedIngestMonthly}/{formatQuotaLimit(ingestMonthlyLimit)}
          </span>
          <span>
            Enrich: {usedEnrichMonthly}/{formatQuotaLimit(enrichMonthlyLimit)}
          </span>
        </div>
      </div>

      <RunJobActions canRun={canRun} />

      <GlassCard>
        <CardHeading
          title="Jobs"
          description="Only jobs created by you are listed here."
        />
        <CardBody className="pt-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Reason</th>
                <th className="px-3 py-2 font-medium">Idea</th>
                <th className="px-3 py-2 font-medium">Ideas</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Finished</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {jobs.map((job) => (
                <tr key={String(job.id)} className="align-top">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {String(job.id)}
                  </td>
                  <td className="px-3 py-2 text-sm text-foreground">
                    {job.job_type ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {(() => {
                      const hint = getJobHint(job, now, runnerOnline);
                      if (!hint) return '—';
                      const scheduledLabel =
                        hint === 'Scheduled' ? formatDate(job.next_run_at ?? null) : null;
                      return (
                        <span
                          className="text-xs text-muted-foreground"
                          title={
                            scheduledLabel ? `Scheduled at ${scheduledLabel}` : undefined
                          }
                        >
                          {hint}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {job.job_type === IDEA_ENRICH_JOB_TYPE ? (
                      (() => {
                        const ideaId = String(
                          (job as { payload?: Record<string, unknown> | null }).payload?.idea_id ?? '',
                        );
                        if (!ideaId) return '—';
                        const title = ideaTitleById.get(ideaId) || ideaId.slice(0, 8);
                        return (
                          <Link
                            href={`/dashboard/ideas/${ideaId}?job=${job.id}`}
                            className="block max-w-[260px] truncate text-foreground hover:underline"
                            title={title}
                          >
                            {title}
                          </Link>
                        );
                      })()
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {job.job_type && INGEST_JOB_TYPES.has(job.job_type) ? (
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="text-foreground hover:underline"
                      >
                        {outputCountByJobId.get(Number(job.id)) ?? 0}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {job.attempts ?? 0} / {job.max_attempts ?? 3}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.created_at)}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.started_at)}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.finished_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/jobs/${job.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={11}>
                    No jobs yet.
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
