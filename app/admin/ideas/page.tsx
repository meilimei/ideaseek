import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { CardBody, DataTable, GlassCard } from '@/components/admin/primitives';
import { bulkEnqueueIdeaEnrich, enqueueIdeaEnrich, rerunIdeaEnrich } from './actions';

export const dynamic = 'force-dynamic';

type IdeaRow = {
  id: string;
  title: string;
  summary: string | null;
  status: string | null;
  tags: string[] | null;
  score_overall: number | null;
  enriched_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type IdeaEnrichJob = {
  id: string;
  status: string | null;
  payload: Record<string, unknown> | null;
  created_at: string | null;
  error: string | null;
};

function clampText(value: string | null | undefined, maxLength: number) {
  const text = (value ?? '').trim();
  if (!text) return null;
  if (text.length <= maxLength) return text;
  const trimmed = text.slice(0, Math.max(0, maxLength - 3)).trim();
  return `${trimmed}...`;
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

function getIdeaIdFromPayload(payload: Record<string, unknown> | null | undefined) {
  const direct = payload?.['idea_id'];
  if (typeof direct === 'string') return direct;
  const alternate = payload?.['ideaId'];
  if (typeof alternate === 'string') return alternate;
  return null;
}

function getEnrichBadge(idea: IdeaRow, job?: IdeaEnrichJob) {
  if (job?.status === 'running') {
    return { label: 'Running', className: 'bg-blue-500/15 text-blue-200 border-blue-500/30' };
  }
  if (job?.status === 'queued') {
    return { label: 'Queued', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }
  if (job?.status === 'error') {
    return { label: 'Failed', className: 'bg-rose-500/15 text-rose-200 border-rose-500/30' };
  }
  if (idea.enriched_at) {
    return { label: 'Enriched', className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30' };
  }
  return { label: 'Not enriched', className: 'bg-secondary/40 text-foreground border-border/50' };
}

export default async function AdminIdeasPage({
  searchParams,
}: {
  searchParams?: { q?: string };
}) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') return redirect('/');
  if (auth.status === 'forbidden') {
    return <div className="text-sm text-gray-700">403 — Admin access required.</div>;
  }

  const query = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';

  let ideasQuery = supabase
    .from('ideas')
    .select(
      'id, title, summary, status, tags, score_overall, enriched_at, updated_at, created_at',
    )
    .order('updated_at', { ascending: false, nullsLast: true })
    .limit(50);

  if (query) {
    const pattern = `%${query}%`;
    ideasQuery = ideasQuery.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
  }

  const { data, error } = await ideasQuery;
  const ideas = (data ?? []) as IdeaRow[];
  const { data: jobsData } = await supabase
    .from('admin_jobs')
    .select('id, status, payload, created_at, error')
    .eq('job_type', 'idea_enrich')
    .order('created_at', { ascending: false })
    .limit(500);
  const jobs = (jobsData ?? []) as IdeaEnrichJob[];
  const latestJobByIdeaId = new Map<string, IdeaEnrichJob>();

  for (const job of jobs) {
    const ideaId = getIdeaIdFromPayload(job.payload ?? undefined);
    if (ideaId && !latestJobByIdeaId.has(ideaId)) {
      latestJobByIdeaId.set(ideaId, job);
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader title="Ideas" description="Enrichment QA" />

      <GlassCard>
        <CardBody className="space-y-3">
          <form
            action="/admin/ideas"
            method="get"
            className="flex flex-col gap-3 md:flex-row md:items-center"
          >
            <div className="flex-1">
              <Input
                name="q"
                defaultValue={query}
                placeholder="Search title or summary"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary">
              Search
            </Button>
          </form>
          <div className="text-xs text-muted-foreground">
            {query ? `Showing results for "${query}".` : 'Showing latest 50 ideas.'}
          </div>
          {error && (
            <div className="text-sm text-destructive">Failed to load ideas: {error.message}</div>
          )}
        </CardBody>
      </GlassCard>

      <GlassCard>
        <CardBody className="overflow-x-auto p-0">
          <div className="flex items-center gap-2 px-5 py-4">
            <form id="bulk-enqueue-ideas" action={bulkEnqueueIdeaEnrich}>
              <Button type="submit" size="sm" variant="secondary">
                Enqueue selected
              </Button>
            </form>
          </div>
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Select</th>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Enrich</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Tags</th>
                <th className="px-3 py-2 font-medium">Enriched</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {ideas.map((idea) => {
                const summary = clampText(idea.summary, 160);
                const job = latestJobByIdeaId.get(idea.id);
                const enrichBadge = getEnrichBadge(idea, job);
                return (
                  <tr key={idea.id} className="align-top transition hover:bg-secondary/8">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        name="idea_ids"
                        value={idea.id}
                        form="bulk-enqueue-ideas"
                        className="h-4 w-4 rounded border border-border/60 bg-background text-primary shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-foreground">{idea.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {summary ?? '—'}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {idea.status ? (
                        <Badge variant="secondary" className="capitalize">
                          {idea.status}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <Badge className={enrichBadge.className}>{enrichBadge.label}</Badge>
                        {job && (
                          <Link
                            href={`/admin/jobs/${job.id}`}
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            Job
                          </Link>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {idea.score_overall != null
                        ? Number(idea.score_overall).toFixed(2)
                        : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(idea.tags ?? []).slice(0, 6).map((tag) => (
                          <Badge key={tag} variant="secondary" className="capitalize">
                            {tag}
                          </Badge>
                        ))}
                        {(idea.tags ?? []).length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {formatRelative(idea.enriched_at)}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {formatRelative(idea.updated_at)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <form action={enqueueIdeaEnrich} className="inline-flex">
                          <input type="hidden" name="idea_id" value={idea.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Enqueue enrich
                          </Button>
                        </form>
                        <form action={rerunIdeaEnrich} className="inline-flex">
                          <input type="hidden" name="idea_id" value={idea.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Re-run
                          </Button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {ideas.length === 0 && !error && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={9}>
                    No ideas found.
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
