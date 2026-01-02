import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type IdeaDetail = {
  id: string;
  title: string | null;
  summary: string | null;
  one_liner: string | null;
  description: string | null;
  status: string | null;
  tags: string[] | null;
  score_overall: number | null;
  enriched_at: string | null;
  difficulty: number | null;
  market_size: string | null;
  source_type: string | null;
  source_url: string | null;
  demand_strength: string | null;
  pain_points: string[] | null;
  target_users: string | null;
  market_stage: string | null;
  competition: string | null;
  monetization: string[] | null;
  key_risks: string[] | null;
  next_steps: string | null;
  created_at: string | null;
};

type EvidenceItem = {
  id: string;
  source_type: string | null;
  title: string | null;
  url: string | null;
  excerpt: string | null;
  metrics: unknown;
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

function sectionValue(value: string | null | undefined) {
  const text = (value ?? '').trim();
  return text || '—';
}

export default async function GeneratedIdeaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { job?: string };
}) {
  const { id } = await params;
  const jobParam = typeof searchParams?.job === 'string' ? searchParams.job : null;

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return redirect('/login');
  }

  const { data: links, error: linksError } = await supabase
    .from('admin_job_ideas')
    .select('job_id')
    .eq('idea_id', id)
    .eq('relation_type', 'output');

  if (linksError) {
    return notFound();
  }

  const jobIds = Array.from(
    new Set(
      (links ?? [])
        .map((link) =>
          typeof link.job_id === 'string' || typeof link.job_id === 'number'
            ? String(link.job_id)
            : null,
        )
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (jobIds.length === 0) {
    return notFound();
  }

  const { data: jobRows, error: jobError } = await supabase
    .from('admin_jobs')
    .select('id, created_by')
    .in('id', jobIds)
    .eq('created_by', userData.user.id);

  if (jobError || !jobRows || jobRows.length === 0) {
    return notFound();
  }

  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select(
      [
        'id',
        'title',
        'summary',
        'one_liner',
        'description',
        'status',
        'tags',
        'score_overall',
        'enriched_at',
        'difficulty',
        'market_size',
        'source_type',
        'source_url',
        'demand_strength',
        'pain_points',
        'target_users',
        'market_stage',
        'competition',
        'monetization',
        'key_risks',
        'next_steps',
        'created_at',
      ].join(', '),
    )
    .eq('id', id)
    .maybeSingle();

  if (ideaError || !idea) {
    return notFound();
  }

  const { data: evidence } = await supabase
    .from('idea_evidence')
    .select('id, source_type, title, url, excerpt, metrics, created_at')
    .eq('idea_id', id)
    .order('created_at', { ascending: false, nullsFirst: true });

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/jobs">Back to Jobs</Link>
          </Button>
          {jobParam && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/admin/jobs/${jobParam}`}>Back to Job #{jobParam}</Link>
            </Button>
          )}
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/ideas/${idea.id}`}>Open public report</Link>
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold text-foreground">
            {idea.title ?? 'Untitled idea'}
          </h1>
          {idea.status && (
            <Badge variant="secondary" className="capitalize">
              {idea.status}
            </Badge>
          )}
        </div>
        {idea.tags && idea.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {idea.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span>Score: {idea.score_overall != null ? idea.score_overall.toFixed(2) : '—'}</span>
          <span>Enriched: {formatRelative(idea.enriched_at)}</span>
          <span>Created: {formatRelative(idea.created_at)}</span>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {idea.one_liner && <p className="text-foreground/90">{idea.one_liner}</p>}
          {idea.summary && <p>{idea.summary}</p>}
          {idea.description && <p>{idea.description}</p>}
          {!idea.one_liner && !idea.summary && !idea.description && (
            <p>—</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Market signals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Market size: {sectionValue(idea.market_size)}</div>
            <div>Demand strength: {sectionValue(idea.demand_strength)}</div>
            <div>Difficulty: {idea.difficulty ?? '—'}</div>
            <div>Source: {sectionValue(idea.source_type)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Fit & positioning</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <div>Target users: {sectionValue(idea.target_users)}</div>
            <div>Market stage: {sectionValue(idea.market_stage)}</div>
            <div>Competition: {sectionValue(idea.competition)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Pain points</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {idea.pain_points && idea.pain_points.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5">
              {idea.pain_points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Monetization & risks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div>
            <div className="font-medium text-foreground/80">Monetization</div>
            {idea.monetization && idea.monetization.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {idea.monetization.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
          <div>
            <div className="font-medium text-foreground/80">Key risks</div>
            {idea.key_risks && idea.key_risks.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5">
                {idea.key_risks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <p>—</p>
            )}
          </div>
          <div>
            <div className="font-medium text-foreground/80">Next steps</div>
            <p>{sectionValue(idea.next_steps)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Evidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          {evidence && evidence.length > 0 ? (
            evidence.map((item) => (
              <div key={item.id} className="rounded-xl border border-border/60 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium text-foreground/80">
                    {item.title ?? 'Evidence'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatRelative(item.created_at)}
                  </div>
                </div>
                {item.excerpt && <p className="mt-2">{item.excerpt}</p>}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex text-xs text-primary hover:underline"
                  >
                    View source
                  </a>
                )}
              </div>
            ))
          ) : (
            <p>—</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
