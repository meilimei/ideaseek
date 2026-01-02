import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getUserPlan } from '@/lib/plan';

export const dynamic = 'force-dynamic';

type IdeaRow = {
  id: string;
  title: string | null;
  summary: string | null;
  one_liner: string | null;
  description: string | null;
  status: string | null;
  tags: string[] | null;
  score_overall: number | null;
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

export default async function DashboardIdeaDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: { job?: string };
}) {
  const { id } = await params;
  const jobParam = typeof searchParams?.job === 'string' ? searchParams.job : null;

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
    .select('id, title, summary, one_liner, description, status, tags, score_overall, enriched_at, created_at')
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

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/ideas">Back to Ideas</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/jobs">Back to Jobs</Link>
          </Button>
          {jobParam && (
            <Button asChild variant="ghost" size="sm">
              <Link href={`/dashboard/jobs/${jobParam}`}>Back to Job #{jobParam}</Link>
            </Button>
          )}
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
