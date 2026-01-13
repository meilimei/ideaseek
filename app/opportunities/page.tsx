import { createServerSupabaseClient } from '@/lib/supabase/server';
import OpportunitiesClient from './OpportunitiesClient';

export const dynamic = 'force-dynamic';

const CLUSTER_LIMIT = 120;
const FAST_SIGNAL_LIMIT = 12;

export default async function OpportunitiesPage() {
  const supabase = await createServerSupabaseClient();

  const [clusterResult, signalResult] = await Promise.all([
    supabase
      .from('signal_clusters')
      .select(
        `
          id,
          score_total,
          last_seen_at,
          signal_count,
          last_30d_signal_count,
          evidence,
          meta,
          brief:opportunity_briefs (
            id,
            title,
            one_liner,
            markdown,
            brief
          )
        `,
      )
      .order('score_total', { ascending: false, nullsLast: true })
      .limit(CLUSTER_LIMIT),
    supabase
      .from('signals')
      .select('id, content, url, author, signal_created_at')
      .eq('source', 'reddit')
      .order('signal_created_at', { ascending: false, nullsLast: true })
      .limit(FAST_SIGNAL_LIMIT),
  ]);

  if (clusterResult.error) {
    console.error('Failed to load clusters:', clusterResult.error.message);
  }
  if (signalResult.error) {
    console.error('Failed to load signals:', signalResult.error.message);
  }

  const clusters = (clusterResult.data ?? []).map((row: any) => {
    const brief = Array.isArray(row.brief) ? row.brief[0] : row.brief;
    return {
      id: row.id as string,
      score_total: row.score_total as number | null,
      last_seen_at: row.last_seen_at as string | null,
      signal_count: row.signal_count as number | null,
      last_30d_signal_count: row.last_30d_signal_count as number | null,
      evidence: row.evidence as Array<Record<string, unknown>> | null,
      meta: row.meta as Record<string, unknown> | null,
      brief: brief
        ? {
            id: brief.id as string,
            title: brief.title as string | null,
            one_liner: brief.one_liner as string | null,
            markdown: brief.markdown as string | null,
            brief: brief.brief as Record<string, unknown> | null,
          }
        : null,
    };
  });

  const signals = (signalResult.data ?? []).map((row: any) => ({
    id: row.id as string,
    content: row.content as string | null,
    url: row.url as string | null,
    author: row.author as string | null,
    signal_created_at: row.signal_created_at as string | null,
  }));

  return <OpportunitiesClient clusters={clusters} signals={signals} />;
}
