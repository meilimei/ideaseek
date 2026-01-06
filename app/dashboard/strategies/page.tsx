import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RunNowButton from './RunNowButton';
import CreateStrategyCard from './CreateStrategyCard';
import { toggleStrategyActive } from './actions';
import DeleteStrategyButton from './DeleteStrategyButton';

export const dynamic = 'force-dynamic';

type StrategyRow = {
  id: string;
  name: string;
  source: string | null;
  description: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  created_at: string | null;
  last_run_at: string | null;
  last_run_status: string | null;
  last_error: string | null;
};

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function DashboardStrategiesPage({
  searchParams,
}: {
  searchParams?:
    | { [key: string]: string | string[] | undefined }
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard strategies:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data, error } = await supabase
    .from('ingest_strategies')
    .select(
      'id, name, source, description, is_active, cron_expr, created_at, last_run_at, last_run_status, last_error',
    )
    .eq('created_by', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load user strategies:', error.message);
  }

  const strategies = (data ?? []) as StrategyRow[];
  const toast =
    typeof resolvedSearchParams?.toast === 'string' ? resolvedSearchParams.toast : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">My Strategies</h1>
          <p className="text-sm text-muted-foreground">
            Only strategies created by you are listed here.
          </p>
          {toast === 'updated' && (
            <span className="text-sm text-emerald-400">Changes saved.</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="sm">
            <Link href="/dashboard/strategies/new/step-1">New strategy (guided)</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="#advanced-create">Advanced</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/jobs">Back to Dashboard</Link>
          </Button>
        </div>
      </div>

      <div id="advanced-create">
        <CreateStrategyCard />
      </div>

      <GlassCard>
        <CardHeading
          title="Existing strategies"
          description="Manage schedules and run ad-hoc ingests."
        />
        <CardBody className="pt-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Cron</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 font-medium">Last status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {strategies.map((strategy) => (
                <tr key={strategy.id} className="align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold text-foreground">{strategy.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {strategy.description || '—'}
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
                    {strategy.cron_expr ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-sm text-muted-foreground">
                    {formatDate(strategy.last_run_at)}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <span
                      className={
                        strategy.last_run_status === 'error'
                          ? 'text-destructive'
                          : 'text-foreground'
                      }
                    >
                      {strategy.last_run_status || '—'}
                    </span>
                    {strategy.last_error && (
                      <div className="text-xs text-destructive">{strategy.last_error}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-col items-end gap-2">
                      <form action={toggleStrategyActive.bind(null, strategy.id, strategy.is_active)}>
                        <Button
                          type="submit"
                          size="sm"
                          variant="ghost"
                          className="rounded-full px-3"
                        >
                          {strategy.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </form>
                      <Button
                        asChild
                        size="sm"
                        variant="ghost"
                        className="rounded-full px-3"
                      >
                        <Link
                          href={`/dashboard/strategies/edit/step-1?mode=edit&strategyId=${strategy.id}`}
                        >
                          Edit
                        </Link>
                      </Button>
                      <RunNowButton strategyId={strategy.id} />
                      <DeleteStrategyButton strategyId={strategy.id} />
                    </div>
                  </td>
                </tr>
              ))}
              {strategies.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={7}>
                    No strategies found.
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
