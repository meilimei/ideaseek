import { supabaseServiceClient } from '@/lib/supabaseServiceClient';

export type IdeaDatabaseStats = {
  totalIdeas: number;
  publishedIdeas: number;
  newLast7d: number;
  sourceCounts: Record<string, number>;
  mySavedIdeas?: number;
};

export async function getIdeaDatabaseStats(options?: {
  userId?: string | null;
}): Promise<IdeaDatabaseStats> {
  const supabase = supabaseServiceClient;
  const stats: IdeaDatabaseStats = {
    totalIdeas: 0,
    publishedIdeas: 0,
    newLast7d: 0,
    sourceCounts: {},
  };

  // total ideas (excluding deleted if column exists)
  const totalQuery = supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true });
  const { error: totalErr, count: totalCount } = await totalQuery.is(
    'deleted_at',
    null,
  );
  if (!totalErr && typeof totalCount === 'number') {
    stats.totalIdeas = totalCount;
  }

  // published ideas
  const publishedQuery = supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
    .eq('published', true)
    .is('deleted_at', null);
  const { count: publishedCount } = await publishedQuery;
  if (typeof publishedCount === 'number') {
    stats.publishedIdeas = publishedCount;
  }

  // new last 7d
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const newQuery = supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', sevenDaysAgo.toISOString())
    .is('deleted_at', null);
  const { count: newCount } = await newQuery;
  if (typeof newCount === 'number') {
    stats.newLast7d = newCount;
  }

  // source counts
  const { data: sourceRows } = await supabase
    .from('ideas')
    .select('source_type')
    .is('deleted_at', null);
  if (Array.isArray(sourceRows)) {
    for (const row of sourceRows) {
      const key = (row as { source_type?: string | null }).source_type ?? 'unknown';
      stats.sourceCounts[key] = (stats.sourceCounts[key] ?? 0) + 1;
    }
  }

  if (options?.userId) {
    try {
      const { count: savedCount } = await supabase
        .from('idea_bookmarks')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', options.userId);
      if (typeof savedCount === 'number') {
        stats.mySavedIdeas = savedCount;
      }
    } catch {
      // ignore if table not present
    }
  }

  return stats;
}
