import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { enqueueIdeaEnrich } from '@/lib/enrich';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const IDEA_ENRICH_JOB_TYPE = 'idea_enrich';

type JobRow = {
  id: string | number;
  job_type: string | null;
  status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  next_run_at: string | null;
  locked_at: string | null;
  locked_by: string | null;
  strategy_id: string | null;
  source: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown> | null;
  log: string | null;
  error: string | null;
};

type RelatedIdea = {
  id: string;
  title: string | null;
  status: string | null;
  tags: string[] | null;
  score_overall: number | null;
  enriched_at: string | null;
};

type TargetIdea = {
  id: string;
  title: string | null;
  status: string | null;
  score_overall: number | null;
  enriched_at: string | null;
};

type RelatedIdeaLink = {
  idea_id: string | number | null;
  relation_type: string | null;
  created_at: string | null;
  ideas?: RelatedIdea | RelatedIdea[] | null;
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

function asIdea(link: RelatedIdeaLink): RelatedIdea | null {
  const raw = link.ideas;
  if (Array.isArray(raw)) {
    return raw[0] ?? null;
  }
  if (raw && typeof raw === 'object') {
    return raw as RelatedIdea;
  }
  return null;
}

function getIdeaIdFromPayload(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const direct = payload['idea_id'];
  if (typeof direct === 'string' || typeof direct === 'number') {
    return String(direct);
  }
  const alternate = payload['ideaId'];
  if (typeof alternate === 'string' || typeof alternate === 'number') {
    return String(alternate);
  }
  return null;
}

async function rerunEnrich(ideaId: string, rerunOf: number) {
  'use server';

  const result = await enqueueIdeaEnrich({
    ideaId,
    force: false,
    rerunOf,
    triggeredBy: 'dashboard-rerun',
  });

  if (!result.ok && result.reason === 'already_pending') {
    return redirect(`/dashboard/jobs/${result.pendingJobId}`);
  }
  if (!result.ok && result.reason === 'quota_exceeded_daily') {
    return redirect('/dashboard/jobs?error=quota_enrich');
  }
  if (!result.ok && result.reason === 'quota_exceeded_monthly') {
    return redirect('/dashboard/jobs?error=quota_enrich_month');
  }

  return redirect(`/dashboard/jobs/${result.jobId}`);
}

async function forceRerunEnrich(ideaId: string, rerunOf: number) {
  'use server';

  const result = await enqueueIdeaEnrich({
    ideaId,
    force: true,
    rerunOf,
    triggeredBy: 'dashboard-force-rerun',
  });

  if (!result.ok && result.reason === 'quota_exceeded_daily') {
    return redirect('/dashboard/jobs?error=quota_enrich');
  }
  if (!result.ok && result.reason === 'quota_exceeded_monthly') {
    return redirect('/dashboard/jobs?error=quota_enrich_month');
  }

  return redirect(`/dashboard/jobs/${result.jobId}`);
}

// Manual test: open /dashboard/jobs, click a row, and verify metadata, payload, and log render.
export default async function DashboardJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const jobId = Number(id);
  if (Number.isNaN(jobId)) {
    return notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard job detail:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data: job, error: jobError } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, created_at, started_at, finished_at, error, log, payload, attempts, max_attempts, next_run_at, locked_at, locked_by, strategy_id, source, dedupe_key',
    )
    .eq('id', jobId)
    .eq('created_by', user.id)
    .maybeSingle();

  if (jobError || !job) {
    return notFound();
  }

  let targetIdea: TargetIdea | null = null;
  const payloadIdeaId = getIdeaIdFromPayload(job.payload ?? null);
  if (job.job_type === IDEA_ENRICH_JOB_TYPE && payloadIdeaId) {
    const { data: targetIdeaRow, error: targetIdeaError } = await supabase
      .from('ideas')
      .select('id, title, status, score_overall, enriched_at')
      .eq('id', payloadIdeaId)
      .maybeSingle();

    if (targetIdeaError) {
      console.error('Failed to load target idea:', targetIdeaError.message);
    } else if (targetIdeaRow) {
      targetIdea = targetIdeaRow as TargetIdea;
    }
  }

  const { data: links, error: linksError } = await supabase
    .from('admin_job_ideas')
    .select(
      'idea_id, relation_type, created_at, ideas:ideas(id, title, status, tags, score_overall, enriched_at)',
    )
    .eq('job_id', job.id)
    .eq('relation_type', 'output')
    .order('created_at', { ascending: true });

  if (linksError) {
    console.error('Failed to load related ideas:', linksError.message);
  }

  const related = (links ?? []) as RelatedIdeaLink[];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/jobs">Back to Jobs</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">Job #{job.id}</h1>
          <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
            {job.job_type ?? 'unknown'}
          </Badge>
          <StatusBadge status={job.status} />
          <span className="text-xs text-muted-foreground">
            Attempts: {job.attempts ?? 0} / {job.max_attempts ?? 3}
          </span>
        </div>
        {job.job_type === IDEA_ENRICH_JOB_TYPE && payloadIdeaId && (
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <form action={rerunEnrich.bind(null, payloadIdeaId, jobId)}>
                <Button type="submit" size="sm">
                  Re-run job
                </Button>
              </form>
              <form action={forceRerunEnrich.bind(null, payloadIdeaId, jobId)}>
                <Button type="submit" variant="outline" size="sm">
                  Force re-run
                </Button>
              </form>
            </div>
            <div className="text-xs text-muted-foreground lg:text-right">
              Re-run prevents duplicates if a queued/running job already exists. Force re-run always enqueues a new job for audit.
            </div>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Metadata</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Created at
              </div>
              <div className="text-foreground">{formatRelative(job.created_at)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Started at
              </div>
              <div className="text-foreground">{formatRelative(job.started_at)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Finished at
              </div>
              <div className="text-foreground">{formatRelative(job.finished_at)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Attempts
              </div>
              <div className="text-foreground">
                {job.attempts ?? 0} / {job.max_attempts ?? 3}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Next run
              </div>
              <div className="text-foreground">{formatRelative(job.next_run_at)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Locked at
              </div>
              <div className="text-foreground">{formatRelative(job.locked_at)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Locked by
              </div>
              <div className="text-foreground">{job.locked_by ?? '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Strategy
              </div>
              <div className="text-foreground">{job.strategy_id ?? '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Source
              </div>
              <div className="text-foreground">{job.source ?? '—'}</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Dedupe key
              </div>
              <div className="text-foreground">{job.dedupe_key ?? '—'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {job.job_type === IDEA_ENRICH_JOB_TYPE && payloadIdeaId && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Target Idea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {!targetIdea ? (
              <div>Idea not found.</div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/dashboard/ideas/${targetIdea.id}?job=${job.id}`}
                      className="block truncate text-sm font-semibold text-foreground hover:underline"
                      title={targetIdea.title ?? targetIdea.id}
                    >
                      {targetIdea.title ?? targetIdea.id.slice(0, 8)}
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Score:{' '}
                        {targetIdea.score_overall != null
                          ? Number(targetIdea.score_overall).toFixed(2)
                          : '—'}
                      </span>
                      <span>Enriched: {formatRelative(targetIdea.enriched_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {targetIdea.status && <StatusBadge status={targetIdea.status} />}
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/dashboard/ideas/${targetIdea.id}?job=${job.id}`}>
                        View idea
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Outputs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {related.length === 0 ? (
            <div>No outputs recorded.</div>
          ) : (
            related.map((link) => {
              const idea = asIdea(link);
              const ideaId =
                typeof link.idea_id === 'string' || typeof link.idea_id === 'number'
                  ? String(link.idea_id)
                  : idea?.id;
              if (!ideaId) return null;
              const label = idea?.title?.trim() || ideaId.slice(0, 8);
              const tags = idea?.tags ?? [];
              const visibleTags = tags.slice(0, 6);
              const overflowCount = Math.max(0, tags.length - visibleTags.length);
              return (
                <div
                  key={`${ideaId}-${link.created_at ?? 'link'}`}
                  className="rounded-xl border border-border/60 bg-card/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/dashboard/ideas/${ideaId}?job=${job.id}`}
                        className="block truncate text-sm font-semibold text-foreground hover:underline"
                        title={label}
                      >
                        {label}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2">
                      {idea?.status && (
                        <Badge variant="secondary" className="capitalize">
                          {idea.status}
                        </Badge>
                      )}
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/ideas/${ideaId}?job=${job.id}`}>View idea</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      Score:{' '}
                      {idea?.score_overall != null
                        ? Number(idea.score_overall).toFixed(2)
                        : '—'}
                    </span>
                    <span>Enriched: {formatRelative(idea?.enriched_at ?? null)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {visibleTags.map((tag) => (
                      <Badge key={tag} variant="outline" className="capitalize">
                        {tag}
                      </Badge>
                    ))}
                    {overflowCount > 0 && (
                      <span className="text-xs text-muted-foreground">+{overflowCount}</span>
                    )}
                    {tags.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="max-h-80 overflow-auto whitespace-pre font-mono text-xs text-muted-foreground">
            {JSON.stringify(job.payload ?? {}, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {job.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              {job.error}
            </div>
          )}
          {job.log?.trim() ? (
            <pre className="max-h-96 overflow-auto whitespace-pre font-mono text-xs text-muted-foreground">
              {job.log}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground">No log recorded.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
