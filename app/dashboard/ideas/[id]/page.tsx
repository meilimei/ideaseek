import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/plan';

export const dynamic = 'force-dynamic';

const IDEA_ENRICH_JOB_TYPE = 'idea_enrich';

const DIM_KEYS = [
  { key: 'pain', label: 'Pain' },
  { key: 'market', label: 'Market' },
  { key: 'urgency', label: 'Urgency' },
  { key: 'willingness_to_pay', label: 'WTP' },
  { key: 'competition', label: 'Competition' },
  { key: 'moat', label: 'Moat' },
];

type IdeaRow = {
  id: string;
  title: string | null;
  summary: string | null;
  one_liner: string | null;
  description: string | null;
  status: string | null;
  tags: string[] | null;
  score_overall: number | null;
  score_detail: Record<string, unknown> | null;
  enriched_at: string | null;
  created_at: string | null;
};

type EvidenceRow = {
  id: string;
  source_type: string | null;
  title: string | null;
  excerpt: string | null;
  url: string | null;
  created_at: string | null;
};

type EnrichSnapshot = {
  before?: {
    tags?: string[];
    score_overall?: number | null;
    score_detail?: unknown;
    status?: string | null;
    enriched_at?: string | null;
  };
  after?: {
    tags?: string[];
    score_overall?: number | null;
    score_detail?: unknown;
    status?: string | null;
    enriched_at?: string | null;
  };
  delta?: {
    tags_added?: string[];
    tags_removed?: string[];
    score_delta?: number | null;
  };
};

type EnrichJob = {
  id: string | number;
  status: string | null;
  created_at: string | null;
  payload: Record<string, unknown> | null;
};

const ArrowLeft = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 12H5" />
    <path d="M12 19l-7-7 7-7" />
  </svg>
);

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

function formatScore(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(2);
}

function deltaBadgeClass(delta: number | null | undefined) {
  if (delta == null) return 'bg-secondary/40 text-foreground border-border/50';
  if (delta > 0) return 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30';
  if (delta < 0) return 'bg-rose-500/15 text-rose-200 border-rose-500/30';
  return 'bg-secondary/40 text-foreground border-border/50';
}

function pickScore(detail: Record<string, unknown> | null | undefined, key: string) {
  const direct = detail?.[key];
  if (typeof direct === 'number' && Number.isFinite(direct)) {
    return Math.max(0, Math.min(100, direct));
  }
  const nested = (detail as { scores?: Record<string, unknown> } | null | undefined)?.scores?.[key];
  if (typeof nested === 'number' && Number.isFinite(nested)) {
    return Math.max(0, Math.min(100, nested));
  }
  return null;
}

export default async function DashboardIdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { id } = await params;
  const jobId = typeof searchParams?.job === 'string' ? searchParams.job : null;

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard idea detail:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select(
      'id, title, summary, one_liner, description, status, tags, score_overall, score_detail, enriched_at, created_at',
    )
    .eq('id', id)
    .maybeSingle();

  if (ideaError || !idea) {
    return notFound();
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  const isAdminPlan = plan === 'admin';

  if (!isAdminPlan) {
    const { data: jobsData, error: jobsError } = await supabase
      .from('admin_jobs')
      .select('id')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (jobsError || !jobsData || jobsData.length === 0) {
      return notFound();
    }

    const jobIds = jobsData.map((job) => String(job.id));
    const { data: links, error: linksError } = await supabase
      .from('admin_job_ideas')
      .select('job_id')
      .eq('idea_id', id)
      .eq('relation_type', 'output')
      .in('job_id', jobIds)
      .limit(1);

    if (linksError || !links || links.length === 0) {
      return notFound();
    }
  }

  const { data: enrichJobs, error: enrichJobError } = await supabase
    .from('admin_jobs')
    .select('id, status, created_at, payload')
    .eq('created_by', user.id)
    .eq('job_type', IDEA_ENRICH_JOB_TYPE)
    .filter('payload->>idea_id', 'eq', id)
    .order('created_at', { ascending: false })
    .limit(1);

  if (enrichJobError) {
    console.error('Failed to load latest enrich job:', enrichJobError.message);
  }

  const enrichJob = (enrichJobs ?? [])[0] as EnrichJob | undefined;
  const enrichSnapshot = (enrichJob?.payload as any)?.enrich as EnrichSnapshot | undefined;
  const beforeScore = enrichSnapshot?.before?.score_overall ?? null;
  const afterScore = enrichSnapshot?.after?.score_overall ?? null;
  const scoreDelta = enrichSnapshot?.delta?.score_delta ?? null;
  const tagsAdded = enrichSnapshot?.delta?.tags_added ?? [];
  const tagsRemoved = enrichSnapshot?.delta?.tags_removed ?? [];
  const hasTagChanges = tagsAdded.length > 0 || tagsRemoved.length > 0;

  const { data: evidenceData, error: evidenceError } = await supabase
    .from('idea_evidence')
    .select('id, source_type, title, excerpt, url, created_at')
    .eq('idea_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (evidenceError) {
    console.error('Failed to load idea evidence:', evidenceError.message);
  }

  const evidence = (evidenceData ?? []) as EvidenceRow[];
  const tags = idea.tags ?? [];
  const scoreDetail = idea.score_detail ?? null;
  const scoreItems = DIM_KEYS.map((dim) => ({
    ...dim,
    value: pickScore(scoreDetail, dim.key),
  })).filter((dim) => dim.value != null);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {jobId && (
            <Link
              href={`/dashboard/jobs/${jobId}`}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Job #{jobId}
            </Link>
          )}
          <Link
            href="/dashboard/ideas"
            className="text-sm text-muted-foreground hover:underline"
          >
            Back to Ideas
          </Link>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/ideas/${idea.id}`}>Open full idea report</Link>
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {idea.title ?? 'Untitled idea'}
          </h1>
          {idea.status ? (
            <StatusBadge status={idea.status} />
          ) : (
            <Badge variant="secondary">unknown</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>
            Score:{' '}
            {idea.score_overall != null ? Number(idea.score_overall).toFixed(2) : '—'}
          </span>
          <span>Enriched: {formatRelative(idea.enriched_at)}</span>
          <span>Created: {formatRelative(idea.created_at)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags</span>}
          {tags.map((tag) => (
            <Badge key={tag} variant="outline" className="capitalize">
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Last enrichment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {enrichSnapshot && enrichJob ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={enrichJob.status} />
                  <Link
                    href={`/dashboard/jobs/${enrichJob.id}`}
                    className="text-xs text-primary hover:underline"
                  >
                    View job
                  </Link>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatRelative(enrichJob.created_at)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span>
                  Score: {formatScore(beforeScore)} → {formatScore(afterScore)}
                </span>
                <Badge className={deltaBadgeClass(scoreDelta)}>
                  {scoreDelta != null
                    ? `${scoreDelta > 0 ? '+' : ''}${scoreDelta.toFixed(2)}`
                    : '—'}
                </Badge>
              </div>
              {hasTagChanges ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Added</div>
                    <div className="flex flex-wrap gap-1">
                      {tagsAdded.map((tag) => (
                        <Badge key={`added-${tag}`} variant="secondary" className="capitalize">
                          {tag}
                        </Badge>
                      ))}
                      {tagsAdded.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground">Removed</div>
                    <div className="flex flex-wrap gap-1">
                      {tagsRemoved.map((tag) => (
                        <Badge
                          key={`removed-${tag}`}
                          variant="outline"
                          className="capitalize line-through text-muted-foreground"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {tagsRemoved.length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No tag changes</div>
              )}
            </>
          ) : (
            <div>No enrichment diff available yet. Run Enrich to generate one.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Scorecard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {scoreItems.length === 0 ? (
            <div>No score detail yet.</div>
          ) : (
            scoreItems.map((item) => (
              <div key={item.key} className="flex items-center gap-3">
                <div className="w-24 text-xs font-semibold text-muted-foreground">
                  {item.label}
                </div>
                <div className="h-2.5 flex-1 rounded-full bg-secondary/40">
                  <div
                    className="h-2.5 rounded-full bg-emerald-400/70"
                    style={{ width: `${item.value ?? 0}%` }}
                  />
                </div>
                <div className="w-10 text-right text-xs text-muted-foreground">
                  {item.value?.toFixed(0)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Idea Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {idea.one_liner && <div>{idea.one_liner}</div>}
          {idea.summary && <div>{idea.summary}</div>}
          {idea.description && <div>{idea.description}</div>}
          {!idea.one_liner && !idea.summary && !idea.description && (
            <div>No idea description available yet.</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {evidence.length === 0 ? (
            <div>No evidence recorded yet.</div>
          ) : (
            evidence.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-border/60 bg-card/40 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-foreground">
                    {item.title ?? 'Untitled evidence'}
                  </div>
                  {item.source_type && (
                    <Badge variant="secondary" className="capitalize">
                      {item.source_type}
                    </Badge>
                  )}
                </div>
                {item.excerpt && <div className="mt-2 text-sm">{item.excerpt}</div>}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{formatRelative(item.created_at)}</span>
                  {item.url && (
                    <Link
                      href={item.url}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      View source
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
