'use client';

import { useState } from 'react';

export default function ReRunJobButton({ jobType }: { jobType: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRerun = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_type: jobType }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to create job');
      }
      setMessage(`Created job ${json.jobId}. Refresh to see status.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleRerun}
        disabled={loading}
        className="rounded-md border px-3 py-1 text-sm text-gray-800 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Running…' : 'Re-run'}
      </button>
      {message && <span className="text-xs text-gray-600">{message}</span>}
    </div>
  );
}
