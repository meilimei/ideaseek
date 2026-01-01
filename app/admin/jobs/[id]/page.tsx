import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getAdminJob } from '@/lib/server/adminJobs';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { Badge } from '@/components/ui/badge';
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
};

type RelatedIdea = {
  id: string;
  title: string | null;
  status: string | null;
  score_overall: number | null;
  tags: string[] | null;
  enriched_at: string | null;
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

function shortId(value: string) {
  return value.slice(0, 8);
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

  const relatedIdeaIds = Array.from(
    new Set((linksData ?? []).map((link) => link.idea_id).filter(Boolean)),
  );

  let relatedIdeas: RelatedIdea[] = [];
  if (relatedIdeaIds.length > 0) {
    const { data: ideasData } = await supabase
      .from('ideas')
      .select('id, title, status, score_overall, tags, enriched_at')
      .in('id', relatedIdeaIds);
    relatedIdeas = (ideasData ?? []) as RelatedIdea[];
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Job {job.id}</h1>
          <p className="text-sm text-gray-600">{job.job_type}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/jobs" className="text-sm text-indigo-600 hover:underline">
            Back
          </Link>
          {job.job_type === 'idea_enrich' ? (
            <form action={rerunIdeaEnrich.bind(null, job.id)}>
              <button
                type="submit"
                className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
              >
                Re-run enrichment
              </button>
            </form>
          ) : (
            <ReRunJobButton jobType={job.job_type} payload={job.payload} />
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 text-sm text-gray-700">
        <div className="font-semibold">Related Ideas</div>
        {relatedIdeas.length === 0 ? (
          <div className="text-xs text-gray-500">No related ideas recorded.</div>
        ) : (
          <div className="space-y-3">
            {relatedIdeas.map((related) => (
              <div
                key={related.id}
                className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/ideas?q=${encodeURIComponent(related.id)}`}
                    className="text-sm font-semibold text-gray-900 hover:underline"
                  >
                    {related.title ?? shortId(related.id)}
                  </Link>
                  {related.status ? (
                    <Badge variant="secondary" className="capitalize">
                      {related.status}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                  <span className="text-xs text-gray-500">
                    Score: {related.score_overall != null
                      ? Number(related.score_overall).toFixed(2)
                      : '—'}
                  </span>
                  <span className="text-xs text-gray-500">
                    Enriched: {formatRelative(related.enriched_at)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {(related.tags ?? []).slice(0, 6).map((tag) => (
                    <Badge key={tag} variant="secondary" className="capitalize">
                      {tag}
                    </Badge>
                  ))}
                  {(related.tags ?? []).length === 0 && (
                    <span className="text-xs text-gray-500">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2 text-sm text-gray-700">
        <div>Status: {job.status}</div>
        <div>Created: {job.created_at ?? '—'}</div>
        <div>Started: {job.started_at ?? '—'}</div>
        <div>Finished: {job.finished_at ?? '—'}</div>
        <div>Payload: <pre className="whitespace-pre-wrap break-all text-xs">{JSON.stringify(job.payload ?? {}, null, 2)}</pre></div>
        {job.error && (
          <div className="text-red-600">
            Error: {job.error}
          </div>
        )}
        {job.log && (
          <div>
            <div className="font-semibold">Log</div>
            <pre className="whitespace-pre-wrap break-all rounded-md bg-gray-100 p-3 text-xs text-gray-800">
              {job.log}
            </pre>
          </div>
        )}
      </div>

      {job.job_type === 'idea_enrich' && (
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 text-sm text-gray-700">
          <div className="font-semibold">Enrichment</div>
          {!ideaId && <div className="text-xs text-gray-500">No idea_id in payload.</div>}
          {ideaLoadError && (
            <div className="text-xs text-red-600">Failed to load idea: {ideaLoadError}</div>
          )}
          {idea && (
            <>
              <div>
                Idea ID:{' '}
                <Link
                  href={`/admin/ideas?q=${encodeURIComponent(idea.id)}`}
                  className="text-indigo-600 hover:underline"
                >
                  {idea.id}
                </Link>
              </div>
              <div>Status: {idea.status ?? '—'}</div>
              <div>Tags: {idea.tags?.join(', ') || '—'}</div>
              <div>Score overall: {idea.score_overall ?? '—'}</div>
              <div>Enriched at: {idea.enriched_at ?? '—'}</div>
              <details className="rounded-md border bg-gray-50 p-3">
                <summary className="cursor-pointer text-xs font-semibold">
                  Score detail
                </summary>
                <pre className="mt-2 whitespace-pre-wrap break-all text-xs text-gray-800">
                  {JSON.stringify(idea.score_detail ?? {}, null, 2)}
                </pre>
              </details>
            </>
          )}
        </div>
      )}
    </div>
  );
}
