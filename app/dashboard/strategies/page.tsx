import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import RunNowButton from './RunNowButton';

export const dynamic = 'force-dynamic';

type StrategyRow = {
  id: string;
  name: string;
  source: string | null;
  is_active: boolean | null;
  cron_expr: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function DashboardStrategiesPage() {
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
    .select('id, name, source, is_active, cron_expr, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load user strategies:', error.message);
  }

  const strategies = (data ?? []) as StrategyRow[];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">My Strategies</h1>
          <p className="text-sm text-muted-foreground">
            Create and manage your ingestion strategies.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin">Back to Dashboard</Link>
        </Button>
      </div>

      <GlassCard>
        <CardHeading
          title="Strategies"
          description="Only strategies created by you are listed here."
        />
        <CardBody className="pt-0">
          <DataTable>
            <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Active</th>
                <th className="px-3 py-2 font-medium">Cron</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {strategies.map((strategy) => (
                <tr key={strategy.id} className="align-top">
                  <td className="px-3 py-2 font-semibold text-foreground">
                    {strategy.name}
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
                    {formatDate(strategy.created_at)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <RunNowButton strategyId={strategy.id} />
                  </td>
                </tr>
              ))}
              {strategies.length === 0 && (
                <tr>
                  <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={6}>
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
