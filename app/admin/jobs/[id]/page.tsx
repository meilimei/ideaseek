import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { getAdminJob } from '@/lib/server/adminJobs';
import ReRunJobButton from './ReRunJobButton';

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
          <ReRunJobButton jobType={job.job_type} payload={job.payload} />
        </div>
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
    </div>
  );
}
