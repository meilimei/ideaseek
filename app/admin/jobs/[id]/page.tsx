import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getAdminJob } from '@/lib/server/adminJobs';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import ReRunJobButton from './ReRunJobButton';
import { rerunIdeaEnrich } from './actions';

export const dynamic = 'force-dynamic';

type AdminJob = {
  id: string;
  job_type: string;
  status: string;
  payload: Record<string, unknown> | null;
  error: string | null;
  log: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
};

type RelatedIdea = {
  id: string;
  title: string | null;
  status: string | null;
  score_overall: number | null;
  tags: string[] | null;
  enriched_at: string | null;
};

type RelatedIdeaDisplay = RelatedIdea & {
  relationTypes: string[];
};

function RotateCcwIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 2v6h6" />
      <path d="M3 8a9 9 0 1 0 3-7.7L3 8" />
    </svg>
  );
}

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

function shortId(value: string) {
  return value.slice(0, 8);
}

const ideaDetailHref = (ideaId: string) => `/ideas/${ideaId}`;

function extractWorker(payload: Record<string, unknown> | null) {
  if (!payload) return null;
  const raw =
    (payload as Record<string, unknown>).worker ??
    (payload as Record<string, unknown>).worker_id ??
    (payload as Record<string, unknown>).locked_by;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  const job = (await getAdminJob(id)) as AdminJob | null;
  if (!job) {
    return (
      <div className="space-y-3">
        <div className="text-sm text-gray-700">Job not found.</div>
        <Link href="/admin/jobs" className="text-indigo-600 hover:underline">
          Back to jobs
        </Link>
      </div>
    );
  }

  const payload = job.payload ?? {};
  const ideaId =
    typeof (payload as Record<string, unknown>).idea_id === 'string'
      ? ((payload as Record<string, unknown>).idea_id as string)
      : typeof (payload as Record<string, unknown>).ideaId === 'string'
        ? ((payload as Record<string, unknown>).ideaId as string)
        : null;

  const { data: linksData } = await supabase
    .from('admin_job_ideas')
    .select('idea_id, relation_type, created_at')
    .eq('job_id', job.id);

  const relationByIdeaId = new Map<string, Set<string>>();
  const relatedIdeaIds = Array.from(
    new Set(
      (linksData ?? [])
        .map((link) =>
          typeof link.idea_id === 'string'
            ? link.idea_id
            : link.idea_id != null
              ? String(link.idea_id)
              : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  );
  for (const link of linksData ?? []) {
    const ideaId =
      typeof link.idea_id === 'string'
        ? link.idea_id
        : link.idea_id != null
          ? String(link.idea_id)
          : null;
    if (!ideaId) continue;
    const set = relationByIdeaId.get(ideaId) ?? new Set<string>();
    if (typeof link.relation_type === 'string' && link.relation_type.trim()) {
      set.add(link.relation_type.trim());
    }
    relationByIdeaId.set(ideaId, set);
  }

  let relatedIdeas: RelatedIdeaDisplay[] = [];
  if (relatedIdeaIds.length > 0) {
    const { data: ideasData } = await supabase
      .from('ideas')
      .select('id, title, status, score_overall, tags, enriched_at')
      .in('id', relatedIdeaIds);
    relatedIdeas = (ideasData ?? []).map((idea) => ({
      ...(idea as RelatedIdea),
      relationTypes: Array.from(relationByIdeaId.get(idea.id) ?? []),
    }));
    relatedIdeas.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  }

  let idea: {
    id: string;
    tags: string[] | null;
    score_overall: number | null;
    score_detail: unknown;
    enriched_at: string | null;
    status: string | null;
  } | null = null;
  let ideaLoadError: string | null = null;

  if (job.job_type === 'idea_enrich' && ideaId) {
    const { data, error } = await supabase
      .from('ideas')
      .select('id, tags, score_overall, score_detail, enriched_at, status')
      .eq('id', ideaId)
      .maybeSingle();
    if (error) {
      ideaLoadError = error.message;
    } else {
      idea = data as typeof idea;
    }
  }

  const worker = extractWorker(payload as Record<string, unknown>);
  const attemptsLabel = `${job.attempts ?? 0} / ${job.max_attempts ?? 3}`;
  const isRerunDisabled = job.status === 'running' || job.status === 'queued';
  const rerunDisabledReason =
    job.status === 'running'
      ? 'Disabled while job is running'
      : job.status === 'queued'
        ? 'Disabled while job is queued'
        : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="sticky top-0 z-20 rounded-2xl border border-border/60 bg-background/80 px-4 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">Job #{job.id}</h1>
                <Badge variant="secondary" className="uppercase text-[11px] tracking-wide">
                  {job.job_type}
                </Badge>
                <StatusBadge status={job.status} />
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href="/admin/jobs">Back</Link>
                  </Button>
                  {job.job_type === 'idea_enrich' ? (
                    <form action={rerunIdeaEnrich.bind(null, job.id)}>
                      <Button
                        type="submit"
                        size="sm"
                        variant="default"
                        className="gap-2"
                        disabled={isRerunDisabled}
                        aria-disabled={isRerunDisabled}
                        title={rerunDisabledReason ?? undefined}
                      >
                        <RotateCcwIcon className="h-4 w-4" />
                        Re-run job
                      </Button>
                    </form>
                  ) : (
                    <div
                      className={isRerunDisabled ? 'pointer-events-none opacity-60' : undefined}
                      aria-disabled={isRerunDisabled}
                      title={rerunDisabledReason ?? undefined}
                    >
                      <ReRunJobButton jobType={job.job_type} payload={job.payload} />
                    </div>
                  )}
                </div>
                {rerunDisabledReason && (
                  <span className="text-xs text-muted-foreground">{rerunDisabledReason}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span title={job.created_at ?? undefined}>
                Created: {formatRelative(job.created_at)}
              </span>
              <span title={job.started_at ?? undefined}>
                Started: {formatRelative(job.started_at)}
              </span>
              <span title={job.finished_at ?? undefined}>
                Finished: {formatRelative(job.finished_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2 lg:pl-1">
            <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Related Ideas</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {relatedIdeas.length} total
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {relatedIdeas.length === 0 ? (
                <div className="text-sm text-muted-foreground">No related ideas recorded.</div>
              ) : (
                relatedIdeas.map((related) => {
                  const tags = related.tags ?? [];
                  const visibleTags = tags.slice(0, 6);
                  const overflowCount = Math.max(0, tags.length - visibleTags.length);
                  return (
                    <div
                      key={related.id}
                      className="rounded-xl border border-border/60 bg-background/40 p-4"
                    >
                      <div className="space-y-2">
                        <Link
                          href={ideaDetailHref(related.id)}
                          className="text-sm font-semibold text-foreground hover:underline"
                        >
                          {related.title ?? shortId(related.id)}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {related.relationTypes.map((type) => (
                            <Badge key={type} variant="outline" className="uppercase text-[10px]">
                              {type}
                            </Badge>
                          ))}
                          {related.status && (
                            <Badge variant="secondary" className="capitalize">
                              {related.status}
                            </Badge>
                          )}
                          <span>
                            Score:{' '}
                            {related.score_overall != null
                              ? Number(related.score_overall).toFixed(2)
                              : '—'}
                          </span>
                          <span>Enriched: {formatRelative(related.enriched_at)}</span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {visibleTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="capitalize">
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

          {job.job_type === 'idea_enrich' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Enrichment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {!ideaId && <div>No idea_id in payload.</div>}
                {ideaLoadError && (
                  <div className="text-sm text-destructive">
                    Failed to load idea: {ideaLoadError}
                  </div>
                )}
                {idea && (
                  <div className="space-y-2">
                    <div>
                      Idea ID:{' '}
                      <Link href={ideaDetailHref(idea.id)} className="text-primary hover:underline">
                        {idea.id}
                      </Link>
                    </div>
                    <div>Status: {idea.status ?? '—'}</div>
                    <div>Tags: {idea.tags?.join(', ') || '—'}</div>
                    <div>Score overall: {idea.score_overall ?? '—'}</div>
                    <div>Enriched at: {formatRelative(idea.enriched_at)}</div>
                    <details className="rounded-md border border-border/60 bg-background/50 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-foreground">
                        Score detail
                      </summary>
                      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {JSON.stringify(idea.score_detail ?? {}, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.status === 'error' && job.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {job.error}
                </div>
              )}
              {job.log ? (
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                  {job.log}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">No log output yet.</div>
              )}
            </CardContent>
          </Card>
          </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Job Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <dt>Status</dt>
                  <dd>
                    <StatusBadge status={job.status} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Type</dt>
                  <dd className="text-foreground">{job.job_type}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Attempts</dt>
                  <dd className="text-foreground">{attemptsLabel}</dd>
                </div>
                {worker && (
                  <div className="flex items-center justify-between gap-3">
                    <dt>Worker</dt>
                    <dd className="text-foreground">{worker}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <dt>Created</dt>
                  <dd className="text-foreground">{formatRelative(job.created_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Started</dt>
                  <dd className="text-foreground">{formatRelative(job.started_at)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Finished</dt>
                  <dd className="text-foreground">{formatRelative(job.finished_at)}</dd>
                </div>
              </dl>
              {job.error && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {job.error}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Payload</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground">
                {JSON.stringify(job.payload ?? {}, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  </div>
  );
}
