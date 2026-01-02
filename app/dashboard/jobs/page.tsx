import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { getUserPlan } from '@/lib/plan';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RunJobActions from './RunJobActions';

export const dynamic = 'force-dynamic';

type JobRow = {
  id: string | number;
  job_type: string | null;
  status: string | null;
  attempts: number | null;
  max_attempts: number | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function DashboardJobsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard jobs:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const plan = await getUserPlan({ supabase, userId: user.id });
  const canRun = plan === 'pro' || plan === 'admin';

  const { data, error } = await supabase
    .from('admin_jobs')
    .select('id, job_type, status, attempts, max_attempts, created_at, started_at, finished_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Failed to load dashboard jobs:', error.message);
  }

  const jobs = (data ?? []) as JobRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">My Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Review ingestion and processing jobs you created.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      <RunJobActions canRun={canRun} />

      <GlassCard>
        <CardHeading
          title="Jobs"
          description="Only jobs created by you are listed here."
        />
        <CardBody className="pt-0">
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
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {jobs.map((job) => (
                <tr key={String(job.id)} className="align-top">
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {String(job.id)}
                  </td>
                  <td className="px-3 py-2 text-sm text-foreground">
                    {job.job_type ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={job.status} />
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {job.attempts ?? 0} / {job.max_attempts ?? 3}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.created_at)}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.started_at)}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(job.finished_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/dashboard/jobs/${job.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={8}>
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
