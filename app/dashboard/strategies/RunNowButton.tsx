'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function RunNowButton({ strategyId }: { strategyId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRun = async (fetchProvider?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/strategies/${strategyId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: fetchProvider ? JSON.stringify({ fetchProvider }) : undefined,
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
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-full px-3"
          onClick={() => handleRun()}
          disabled={loading}
        >
          {loading ? 'Queuing…' : 'Run now'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full px-3"
          onClick={() => handleRun('apify')}
          disabled={loading}
        >
          {loading ? 'Queuing…' : 'Run via Apify'}
        </Button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
