import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardBody, CardHeading, DataTable, GlassCard } from '@/components/admin/primitives';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ClusterRow = {
  id: string;
  signal_count: number | null;
  unique_authors: number | null;
  gate_passed: boolean | null;
  status: string | null;
  score_total: number | null;
  last_seen_at: string | null;
};

type BriefRow = {
  id: string;
  cluster_id: string | null;
  title: string | null;
  one_liner: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default async function DashboardOpportunitiesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for dashboard opportunities:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return redirect('/login');
  }

  let errorMessage: string | null = null;
  const { data: briefsData, error: briefsError } = await supabase
    .from('opportunity_briefs')
    .select('id, cluster_id, title, one_liner, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (briefsError) {
    errorMessage = briefsError.message;
    console.error('Failed to load opportunity briefs:', briefsError.message);
  }

  const briefs = (briefsData ?? []) as BriefRow[];
  const clusterIds = Array.from(
    new Set(
      briefs
        .map((brief) => brief.cluster_id)
        .filter((clusterId): clusterId is string => typeof clusterId === 'string' && clusterId.length > 0),
    ),
  );

  const clusterMap = new Map<string, ClusterRow>();
  if (clusterIds.length > 0) {
    const { data: clustersData, error: clustersError } = await supabase
      .from('signal_clusters')
      .select('id, signal_count, unique_authors, gate_passed, status, score_total, last_seen_at')
      .in('id', clusterIds);

    if (clustersError) {
      errorMessage = clustersError.message;
      console.error('Failed to load signal clusters:', clustersError.message);
    }

    for (const cluster of (clustersData ?? []) as ClusterRow[]) {
      clusterMap.set(String(cluster.id), cluster);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-foreground">Opportunities</h1>
          <p className="text-sm text-muted-foreground">
            Opportunity briefs generated from need clusters.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard">Back to Dashboard</Link>
        </Button>
      </div>

      <GlassCard>
        <CardHeading
          title="Opportunity briefs"
          description="Latest briefs generated from need clusters."
        />
        <CardBody className="pt-0">
          {errorMessage ? (
            <div className="text-sm text-muted-foreground">
              Unable to load opportunity briefs. {errorMessage}
            </div>
          ) : briefs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No opportunity briefs yet. Run a strategy and then run clustering/brief generation.
            </div>
          ) : (
            <DataTable>
              <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium hidden md:table-cell">Gate</th>
                  <th className="px-3 py-2 text-right font-medium hidden md:table-cell">Signals</th>
                  <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">Score</th>
                  <th className="px-3 py-2 text-right font-medium">Updated/Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {briefs.map((brief) => {
                  const cluster = brief.cluster_id ? clusterMap.get(brief.cluster_id) ?? null : null;
                  const signalCount = cluster?.signal_count ?? null;
                  const gatePassed = cluster?.gate_passed ?? null;
                  const scoreTotal = cluster?.score_total ?? null;
                  const updatedAt = cluster?.last_seen_at ?? brief.created_at;
                  return (
                    <tr key={brief.id}>
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/opportunities/${brief.id}`}
                          className="block max-w-[260px] truncate font-semibold text-foreground hover:underline"
                        >
                          {brief.title || 'Untitled brief'}
                        </Link>
                        {brief.one_liner && (
                          <div className="mt-1 max-w-[320px] truncate text-xs text-muted-foreground">
                            {brief.one_liner}
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
                        {signalCount ?? '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground hidden lg:table-cell">
                        {scoreTotal != null ? scoreTotal.toFixed(2) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-muted-foreground">
                        {formatDate(updatedAt)}
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
