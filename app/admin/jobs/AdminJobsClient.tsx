'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AdminJobActions from './JobActions';

type AdminJob = {
  id: string;
  job_type: string;
  status: string;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
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
    <div className="space-y-4">
      <AdminJobActions />

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100"
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        {error && <span className="text-red-600">{error}</span>}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Attempts</th>
              <th className="px-4 py-2">Created</th>
              <th className="px-4 py-2">Started</th>
              <th className="px-4 py-2">Finished</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="border-t">
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{job.id}</td>
                <td className="px-4 py-2">{job.job_type}</td>
                <td className="px-4 py-2 capitalize">{job.status}</td>
                <td className="px-4 py-2">
                  {job.attempts ?? 0} / {job.max_attempts ?? 3}
                </td>
                <td className="px-4 py-2">{job.created_at ?? '—'}</td>
                <td className="px-4 py-2">{job.started_at ?? '—'}</td>
                <td className="px-4 py-2">{job.finished_at ?? '—'}</td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/jobs/${job.id}`}
                    className="text-indigo-600 hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && !error && (
              <tr>
                <td className="px-4 py-4 text-sm text-gray-500" colSpan={7}>
                  No jobs yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
