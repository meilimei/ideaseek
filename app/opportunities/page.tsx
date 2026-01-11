import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpportunitiesClient from './OpportunitiesClient';

export const dynamic = 'force-dynamic';

export default async function OpportunitiesPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('opportunity_briefs')
    .select(
      `
        id,
        title,
        one_liner,
        markdown,
        brief,
        cluster:signal_clusters (
          id,
          score_total,
          last_seen_at,
          signal_count,
          last_30d_signal_count,
          evidence
        )
      `,
    )
    .order('score_total', { referencedTable: 'signal_clusters', ascending: false, nullsLast: true })
    .limit(100);

  if (error) {
    console.error('Failed to load opportunities:', error.message);
  }

  const briefs =
    (data ?? []).map((row: any) => ({
      id: row.id as string,
      title: row.title as string | null,
      one_liner: row.one_liner as string | null,
      markdown: row.markdown as string | null,
      brief: row.brief as Record<string, unknown> | null,
      cluster: row.cluster
        ? {
            id: row.cluster.id as string,
            score_total: row.cluster.score_total as number | null,
            last_seen_at: row.cluster.last_seen_at as string | null,
            signal_count: row.cluster.signal_count as number | null,
            last_30d_signal_count: row.cluster.last_30d_signal_count as number | null,
            evidence: row.cluster.evidence as Array<Record<string, unknown>> | null,
          }
        : null,
    })) ?? [];

  return <OpportunitiesClient briefs={briefs} />;
}
