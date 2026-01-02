import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { StatusBadge } from '@/components/admin/StatusBadge';
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

export default async function DashboardIdeasPage() {
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

  const ideaIds = Array.from(ideaMeta.keys());

  const { data: ideasData, error: ideasError } = await supabase
    .from('ideas')
    .select('id, title, status, tags, score_overall, enriched_at, created_at')
    .in('id', ideaIds);

  if (ideasError) {
    console.error('Failed to load ideas for dashboard:', ideasError.message);
  }

  const ideaById = new Map<string, IdeaRow>(
    (ideasData ?? []).map((idea) => [idea.id, idea as IdeaRow]),
  );

  const ideaList = ideaIds
    .map((id) => {
      const idea = ideaById.get(id);
      const meta = ideaMeta.get(id);
      if (!idea || !meta) return null;
      return { idea, meta };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aTime = a?.meta.latestProducedAt
        ? new Date(a.meta.latestProducedAt).getTime()
        : 0;
      const bTime = b?.meta.latestProducedAt
        ? new Date(b.meta.latestProducedAt).getTime()
        : 0;
      return bTime - aTime;
    });

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
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Produced</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {ideaList.map((row) => {
                if (!row) return null;
                const { idea, meta } = row;
                const tags = idea.tags ?? [];
                const visibleTags = tags.slice(0, 6);
                const overflowCount = Math.max(0, tags.length - visibleTags.length);
                const title = idea.title?.trim() || idea.id.slice(0, 8);
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
            </tbody>
          </DataTable>
        </CardBody>
      </GlassCard>
    </div>
  );
}
