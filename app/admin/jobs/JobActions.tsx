'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type JobType = 'reddit-ingest' | 'youtube-ingest' | 'trends-ingest';

const JOBS: { type: JobType; label: string }[] = [
  { type: 'reddit-ingest', label: 'Run Reddit ingest' },
  { type: 'youtube-ingest', label: 'Run YouTube ingest' },
  { type: 'trends-ingest', label: 'Run Google Trends ingest' },
];

export default function AdminJobActions() {
  const [loading, setLoading] = useState<JobType | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function createJob(job_type: JobType) {
    setLoading(job_type);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create job');
      }
      setMessage(`Created job ${json.jobId}. Navigating...`);
      router.push(`/admin/jobs/${json.jobId}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessage(null);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
      <div className="text-sm font-semibold text-gray-900">Create Job</div>
      <div className="flex flex-wrap gap-2">
        {JOBS.map((job) => (
          <button
            key={job.type}
            type="button"
            onClick={() => createJob(job.type)}
            disabled={loading !== null}
            className="rounded-md border px-3 py-2 text-sm text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading === job.type ? 'Running…' : job.label}
          </button>
        ))}
      </div>
      {message && <div className="text-xs text-gray-600">{message}</div>}
      {error && <div className="text-xs text-red-600">{error}</div>}
    </div>
  );
}
