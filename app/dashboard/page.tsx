import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { getUserPlan } from '@/lib/plan';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RunJobActions from './jobs/RunJobActions';

export const dynamic = 'force-dynamic';

type StrategyRow = {
  id: string;
  name: string | null;
  source: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  updated_at: string | null;
  created_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
};

type JobRow = {
  id: string | number;
  job_type: string | null;
  status: string | null;
  created_at: string | null;
  finished_at: string | null;
  attempts: number | null;
};

type IdeaRow = {
  id: string;
  title: string | null;
  tags: string[] | null;
  source_type: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Failed to get user for dashboard home:', error.message);
  }

  if (!userData?.user) {
    return redirect('/login');
  }

  const user = userData.user;
  const plan = await getUserPlan({ supabase, userId: user.id });
  const canRun = plan === 'pro' || plan === 'admin';
  const showRunIngestion = process.env.NEXT_PUBLIC_SHOW_RUN_INGESTION === '1';

  let strategies: StrategyRow[] = [];
  let jobs: JobRow[] = [];
  let ideas: IdeaRow[] = [];

  try {
    const { data, error: strategiesError } = await supabase
      .from('ingest_strategies')
      .select(
        'id, name, source, is_active, cron_expr, updated_at, created_at, last_run_at, last_run_status',
      )
      .eq('created_by', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8);
    if (strategiesError) {
      console.error('Failed to load strategies for dashboard:', strategiesError.message);
    }
    strategies = (data ?? []) as StrategyRow[];
  } catch (err) {
    console.error('Failed to load strategies for dashboard:', err);
  }

  try {
    const { data, error: jobsError } = await supabase
      .from('admin_jobs')
      .select('id, job_type, status, created_at, finished_at, attempts')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (jobsError) {
      console.error('Failed to load jobs for dashboard:', jobsError.message);
    }
    jobs = (data ?? []) as JobRow[];
  } catch (err) {
    console.error('Failed to load jobs for dashboard:', err);
  }

  try {
    const { data, error: ideasError } = await supabase
      .from('ideas')
      .select('id, title, tags, source_type, created_at')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
    if (ideasError) {
      console.error('Failed to load ideas for dashboard:', ideasError.message);
    }
    ideas = (data ?? []) as IdeaRow[];
  } catch (err) {
    console.error('Failed to load ideas for dashboard:', err);
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview and shortcuts for your jobs, ideas, and strategies.
        </p>
      </div>

      <GlassCard>
        <CardHeading
          title="Quick actions"
          description="Start a new strategy or run an ingestion job."
        />
        <CardBody className="space-y-4 pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href="/dashboard/strategies/new/step-1">Create strategy</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/dashboard/strategies">View strategies</Link>
            </Button>
          </div>
          {showRunIngestion ? <RunJobActions canRun={canRun} variant="inline" /> : null}
        </CardBody>
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <CardHeading
            title="Your strategies"
            description="Recent schedules and runs."
          />
          <CardBody className="pt-0">
            {strategies.length === 0 ? (
              <div className="text-sm text-muted-foreground">No strategies yet.</div>
            ) : (
              <DataTable>
                <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Source</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Last run</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {strategies.map((strategy) => (
                    <tr key={strategy.id}>
                      <td className="px-3 py-2">
                        <Link
                          href="/dashboard/strategies"
                          className="font-semibold text-foreground hover:underline"
                        >
                          {strategy.name || 'Untitled strategy'}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {strategy.cron_expr ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {strategy.source ?? '—'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            strategy.is_active
                              ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30'
                              : 'bg-secondary/40 text-muted-foreground border-border/60'
                          }
                        >
                          {strategy.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {formatDate(strategy.last_run_at)}
                        <div className="text-xs text-muted-foreground">
                          {strategy.last_run_status || '—'}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardBody>
        </GlassCard>

        <GlassCard>
          <CardHeading title="Recent jobs" description="Latest processing activity." />
          <CardBody className="pt-0">
            {jobs.length === 0 ? (
              <div className="text-sm text-muted-foreground">No jobs yet.</div>
            ) : (
              <DataTable>
                <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Job</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Attempts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/jobs/${job.id}`}
                          className="font-semibold text-foreground hover:underline"
                        >
                          #{job.id}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {job.job_type ?? '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {job.status ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {formatDate(job.created_at)}
                      </td>
                      <td className="px-3 py-2 text-sm text-muted-foreground">
                        {job.attempts ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            )}
          </CardBody>
        </GlassCard>
      </div>

      <GlassCard>
        <CardHeading title="Latest ideas" description="Recently generated ideas." />
        <CardBody className="pt-0">
          {ideas.length === 0 ? (
            <div className="text-sm text-muted-foreground">No ideas yet.</div>
          ) : (
            <DataTable>
              <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 font-medium">Tags</th>
                  <th className="px-3 py-2 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {ideas.map((idea) => (
                  <tr key={idea.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/ideas/${idea.id}`}
                        className="font-semibold text-foreground hover:underline"
                      >
                        {idea.title || 'Untitled idea'}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {idea.source_type ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(idea.tags ?? []).slice(0, 3).map((tag) => (
                          <Badge
                            key={tag}
                            className="border-border/60 bg-secondary/40 text-xs text-muted-foreground"
                          >
                            {tag}
                          </Badge>
                        ))}
                        {(idea.tags ?? []).length > 3 && (
                          <Badge className="border-border/60 bg-secondary/40 text-xs text-muted-foreground">
                            +{(idea.tags ?? []).length - 3}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground">
                      {formatDate(idea.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          )}
        </CardBody>
      </GlassCard>
    </div>
  );
}
