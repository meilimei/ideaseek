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

export default function RunJobActions({ canRun }: { canRun: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<JobType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createJob = async (job_type: JobType) => {
    if (!canRun) return;
    setLoading(job_type);
    setError(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_type,
          payload: { triggeredBy: 'dashboard' },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.message || json?.error || 'Failed to create job');
      }
      if (json?.jobId) {
        router.push(`/dashboard/jobs/${json.jobId}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(null);
    }
  };

  return (
    <GlassCard>
      <CardHeading
        title="Run ingestion"
        description="Queue an ingestion run for your account."
      />
      <CardBody className="space-y-3 pt-0">
        <div className="flex flex-wrap gap-2">
          {JOBS.map((job) => (
            <Button
              key={job.type}
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => createJob(job.type)}
              disabled={!canRun || loading !== null}
            >
              {loading === job.type ? 'Queuing…' : job.label}
            </Button>
          ))}
        </div>
        {!canRun && (
          <div className="text-xs text-muted-foreground">
            Upgrade to Pro to run ingestion jobs.
          </div>
        )}
        {error && <div className="text-xs text-destructive">{error}</div>}
      </CardBody>
    </GlassCard>
  );
}
