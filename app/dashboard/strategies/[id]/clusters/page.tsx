import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ClusterRow = {
  cluster_id: string;
  title: string | null;
  summary: string | null;
  signal_count: number | null;
  unique_authors: number | null;
  score_total: number | null;
  gate_passed: boolean | null;
  last_seen_at: string | null;
  brief_id: string | null;
  brief_title: string | null;
  updated_at: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function StrategyClustersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!id || !isUuid(id)) {
    return notFound();
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy clusters:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  const { data, error } = await supabase.rpc('strategy_clusters_list', {
    p_strategy_id: id,
    p_limit: 50,
    p_offset: 0,
  });

  if (error) {
    console.error('Failed to load strategy clusters:', error.message);
  }

  const clusters = (data ?? []) as ClusterRow[];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Need clusters</h1>
          <p className="text-sm text-muted-foreground">
            Clusters derived from signals tied to this strategy.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/strategies">Back to Strategies</Link>
        </Button>
      </div>

      <GlassCard>
        <CardHeading title="Strategy clusters" description="Opportunity pipeline clusters." />
        <CardBody className="pt-0">
          {error ? (
            <div className="text-sm text-muted-foreground">
              Unable to load clusters. {error.message}
            </div>
          ) : clusters.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No clusters yet. Run the strategy and clustering jobs to generate briefs.
            </div>
          ) : (
            <DataTable>
              <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Gate</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">Signals</th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">
                    Authors
                  </th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">
                    Score
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {clusters.map((cluster) => {
                  const title = cluster.brief_title || cluster.title || 'Untitled cluster';
                  const clusterHref = cluster.brief_id
                    ? `/dashboard/opportunities/${cluster.brief_id}`
                    : `/dashboard/opportunities?clusterId=${cluster.cluster_id}`;
                  const gatePassed = cluster.gate_passed ?? null;
                  return (
                    <tr key={cluster.cluster_id}>
                      <td className="px-3 py-2">
                        <Link
                          href={clusterHref}
                          className="block max-w-[260px] truncate font-semibold text-foreground hover:underline"
                        >
                          {title}
                        </Link>
                        {cluster.summary && (
                          <div className="mt-1 max-w-[320px] truncate text-xs text-muted-foreground">
                            {cluster.summary}
                          </div>
                        )}
                        {cluster.brief_id && (
                          <div className="mt-2">
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/dashboard/opportunities/${cluster.brief_id}`}>
                                Brief
                              </Link>
                            </Button>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 hidden md:table-cell">
                        <Badge
                          variant={gatePassed ? 'secondary' : 'outline'}
                          className="capitalize"
                        >
                          {gatePassed === null ? 'Unknown' : gatePassed ? 'Passed' : 'Failed'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground hidden md:table-cell">
                        {cluster.signal_count ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground hidden lg:table-cell">
                        {cluster.unique_authors ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground hidden lg:table-cell">
                        {cluster.score_total != null ? cluster.score_total.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                        {formatDate(cluster.last_seen_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          )}
        </CardBody>
      </GlassCard>
    </div>
  );
}
