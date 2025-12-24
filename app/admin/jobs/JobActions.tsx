'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, CardBody, CardHeading } from '@/components/admin/primitives';
import { Button } from '@/components/ui/button';

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
      setMessage(`Queued job ${json.jobId}. Runner will pick it up soon.`);
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
    <GlassCard>
      <CardHeading title="Create job" description="Manually queue ingestion or processing runs." />
      <CardBody className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          {JOBS.map((job) => (
            <Button
              key={job.type}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => createJob(job.type)}
              disabled={loading !== null}
            >
              {loading === job.type ? 'Running…' : job.label}
            </Button>
          ))}
        </div>
        {message && <div className="text-xs text-muted-foreground">{message}</div>}
        {error && <div className="text-xs text-destructive">{error}</div>}
        <div className="text-[11px] text-muted-foreground">
          Dev hint: run runner locally via{' '}
          <code className="rounded bg-secondary/20 px-1 py-0.5">npx tsx scripts/job-runner.ts --max=3</code>
        </div>
      </CardBody>
    </GlassCard>
  );
}
