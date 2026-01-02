'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { DataTable, GlassCard, CardBody } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AdminJobActions from './JobActions';

const ideaDetailHref = (ideaId: string) => `/ideas/${ideaId}`;

type AdminJob = {
  id: string;
  job_type: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
  relatedIdeas?: { id: string; title: string | null; status: string | null }[];
  relatedIdeasCount?: number;
};

async function fetchJobs(): Promise<{ jobs: AdminJob[] }> {
  const res = await fetch('/api/admin/jobs', { cache: 'no-store' });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error || 'Failed to load jobs');
  }
  return res.json();
}

export default function AdminJobsClient() {
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasRunning = useMemo(
    () => jobs.some((j) => ['running', 'queued'].includes(j.status)),
    [jobs],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobs();
      setJobs(data.jobs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => {
      void load();
    }, 2000);
    return () => clearInterval(id);
  }, [hasRunning]);

  return (
    <div className="space-y-5">
      <AdminJobActions />

      <GlassCard>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void load()}
              disabled={loading}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <div className="text-sm text-muted-foreground">
              {jobs.length > 0 ? `${jobs.length} jobs loaded` : 'No jobs yet'}
            </div>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>

          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Attempts</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Finished</th>
                <th className="px-3 py-2 font-medium hidden xl:table-cell">Ideas</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {jobs.map((job) => (
                <tr
                  key={job.id}
                  className="transition hover:bg-secondary/10"
                >
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {job.id}
                  </td>
                  <td className="px-3 py-2">{job.job_type}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2">
                    {job.attempts ?? 0} / {job.max_attempts ?? 3}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{job.created_at ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.started_at ?? '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.finished_at ?? '—'}</td>
                  <td className="px-3 py-2 hidden xl:table-cell">
                    {job.relatedIdeas && job.relatedIdeas.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {job.relatedIdeas.slice(0, 2).map((idea) => {
                          const label = idea.title?.trim() || idea.id.slice(0, 8);
                          return (
                            <Link
                              key={idea.id}
                              href={ideaDetailHref(idea.id)}
                              className="hover:underline"
                            >
                              <Badge variant="secondary" className="capitalize">
                                {label}
                              </Badge>
                            </Link>
                          );
                        })}
                        {(job.relatedIdeasCount ?? job.relatedIdeas.length) >
                          job.relatedIdeas.length && (
                          <span className="text-xs text-muted-foreground">
                            +{(job.relatedIdeasCount ?? job.relatedIdeas.length) - job.relatedIdeas.length}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {(job.relatedIdeasCount ?? 0) > 0
                          ? `(${job.relatedIdeasCount ?? 0})`
                          : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/jobs/${job.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && !error && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={9}>
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
