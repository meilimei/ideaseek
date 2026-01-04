import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { ChevronDown } from '@/components/ui/icons';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

function formatRelativeTimestamp(value: string | null) {
  if (!value) return { label: '—', title: null };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { label: '—', title: null };
  return { label: formatRelativeTime(date) ?? '—', title: date.toLocaleString() };
}

function formatDuration(startedAt: string | null, finishedAt: string | null) {
  if (!startedAt || !finishedAt) return '—';
  const startMs = new Date(startedAt).getTime();
  const endMs = new Date(finishedAt).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return '—';
  const diffMs = endMs - startMs;
  if (diffMs < 0) return '—';
  if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s`;
  const minutes = Math.floor(diffMs / 60_000);
  const seconds = Math.round((diffMs % 60_000) / 1000);
  if (seconds === 60) return `${minutes + 1}m 0s`;
  return `${minutes}m ${seconds}s`;
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

function isLow(used: number, limit: number): boolean {
  if (!Number.isFinite(limit)) return false;
  if (limit <= 0) return true;
  const remaining = Math.max(0, limit - used);
  return remaining / limit < 0.2;
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
  const showLowWarnings = plan !== 'admin';
  const lowDailyIngest = showLowWarnings && isLow(usedIngestDaily, ingestDailyLimit);
  const lowDailyEnrich = showLowWarnings && isLow(usedEnrichDaily, enrichDailyLimit);
  const lowMonthlyIngest = showLowWarnings && isLow(usedIngestMonthly, ingestMonthlyLimit);
  const lowMonthlyEnrich = showLowWarnings && isLow(usedEnrichMonthly, enrichMonthlyLimit);
  const anyLow =
    lowDailyIngest || lowDailyEnrich || lowMonthlyIngest || lowMonthlyEnrich;

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
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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

      <Card>
        <CardHeader>
          <CardTitle>Controls</CardTitle>
          <CardDescription>Runner status and quick actions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 text-sm lg:grid-cols-2">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={runnerOnline ? 'secondary' : 'destructive'}>
                {runnerOnline ? 'Online' : 'Offline'}
              </Badge>
              <span className="text-foreground">
                Runner:{' '}
                {runnerOnline
                  ? 'Online'
                  : "Offline — queued jobs won't start until runner is running."}
              </span>
            {!runnerOnline && (
              <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span className="inline-flex items-center rounded-full border border-border/60 bg-secondary/30 px-2 py-1 font-mono text-[11px] text-foreground">
                  npx tsx scripts/job-runner.ts --max=3
                </span>
                <CopyButton text="npx tsx scripts/job-runner.ts --max=3" className="shrink-0" />
              </div>
            )}
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

            <div className="rounded-xl border border-border bg-background/5 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-foreground">Usage</span>
                <span>Today / This month</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-border bg-background/5 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Today · Ingest</div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums whitespace-nowrap">
                    {usedIngestDaily} / {formatQuotaLimit(ingestDailyLimit)}
                    {lowDailyIngest && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Low
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/5 px-3 py-2">
                  <div className="text-xs text-muted-foreground">Today · Enrich</div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums whitespace-nowrap">
                    {usedEnrichDaily} / {formatQuotaLimit(enrichDailyLimit)}
                    {lowDailyEnrich && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Low
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/5 px-3 py-2">
                  <div className="text-xs text-muted-foreground">This month · Ingest</div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums whitespace-nowrap">
                    {usedIngestMonthly} / {formatQuotaLimit(ingestMonthlyLimit)}
                    {lowMonthlyIngest && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Low
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-background/5 px-3 py-2">
                  <div className="text-xs text-muted-foreground">This month · Enrich</div>
                  <div className="mt-1 inline-flex items-center gap-2 text-sm font-semibold tabular-nums whitespace-nowrap">
                    {usedEnrichMonthly} / {formatQuotaLimit(enrichMonthlyLimit)}
                    {lowMonthlyEnrich && (
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                        Low
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {showLowWarnings && anyLow && (
              <Alert className="border-border/60 bg-card/40 text-muted-foreground">
                You're running low on quota. Consider spacing runs to avoid hitting limits.
              </Alert>
            )}
          </div>

          <div className="flex h-full flex-col">
            <RunJobActions canRun={canRun} variant="inline" />
          </div>
        </CardContent>
      </Card>

      <GlassCard>
        <CardHeading
          title="Jobs"
          description="Only jobs created by you are listed here."
        />
        <CardBody className="pt-0">
          <div className="relative max-h-[520px] overflow-auto rounded-2xl border border-border/40">
            <div className="overflow-x-auto">
              <DataTable className="min-w-[900px] w-full">
              <thead className="sticky top-0 z-10 border-b border-border/40 bg-background/80 text-left text-xs uppercase tracking-wide text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <tr>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">ID</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium hidden lg:table-cell">Reason</th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">Attempts</th>
                  <th className="px-3 py-2 text-right font-medium">Created</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">Started</th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">Finished</th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">Dur</th>
                  <th className="px-3 py-2 font-medium">Idea</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">Ideas</th>
                  <th className="px-3 py-2 text-right font-medium">Action</th>
                  <th className="px-2 py-2 text-right font-medium w-8">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {jobs.map((job) => (
                  <tr
                    key={String(job.id)}
                    className="group cursor-pointer align-top even:bg-background/5 hover:bg-muted/50"
                  >
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
                      {String(job.id)}
                    </td>
                    <td className="px-3 py-2 text-sm text-foreground">
                      <span className="block max-w-[140px] truncate whitespace-nowrap">
                        {job.job_type ?? '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="[&>div]:px-2 [&>div]:py-0.5 [&>div]:text-[11px]">
                        <StatusBadge status={job.status} />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground hidden lg:table-cell">
                      {(() => {
                        const hint = getJobHint(job, now, runnerOnline);
                        if (!hint) return '—';
                        const scheduledLabel =
                          hint === 'Scheduled' ? formatDate(job.next_run_at ?? null) : null;
                        return (
                          <span
                            className="block max-w-[160px] truncate text-xs text-muted-foreground"
                            title={
                              scheduledLabel ? `Scheduled at ${scheduledLabel}` : undefined
                            }
                          >
                            {hint}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap hidden lg:table-cell">
                      {job.attempts ?? 0} / {job.max_attempts ?? 3}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground whitespace-nowrap tabular-nums">
                      {(() => {
                        const value = formatRelativeTimestamp(job.created_at);
                        if (!value.title) return '—';
                        return <span title={value.title}>{value.label}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground whitespace-nowrap tabular-nums hidden md:table-cell">
                      {(() => {
                        const value = formatRelativeTimestamp(job.started_at);
                        if (!value.title) return '—';
                        return <span title={value.title}>{value.label}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground whitespace-nowrap tabular-nums hidden lg:table-cell">
                      {(() => {
                        const value = formatRelativeTimestamp(job.finished_at);
                        if (!value.title) return '—';
                        return <span title={value.title}>{value.label}</span>;
                      })()}
                    </td>
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground font-mono tabular-nums whitespace-nowrap hidden lg:table-cell">
                      {formatDuration(job.started_at, job.finished_at)}
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
                              className="block max-w-[180px] truncate text-foreground hover:underline md:max-w-[320px]"
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
                    <td className="px-3 py-2 text-right text-sm text-muted-foreground hidden md:table-cell">
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
                    <td className="px-3 py-2 text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/dashboard/jobs/${job.id}`}>View</Link>
                      </Button>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Link
                        href={`/dashboard/jobs/${job.id}`}
                        className="inline-flex items-center justify-end text-muted-foreground transition-colors group-hover:text-foreground"
                        aria-label={`Open job ${job.id}`}
                      >
                        <ChevronDown className="h-4 w-4 -rotate-90" />
                      </Link>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={13}>
                      No jobs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </DataTable>
            </div>
          </div>
        </CardBody>
      </GlassCard>
    </div>
  );
}
