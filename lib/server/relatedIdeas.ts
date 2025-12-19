import type { SupabaseClient } from '@supabase/supabase-js';

export type RelatedIdea = {
  id: string;
  title: string;
  one_liner: string | null;
  tags: string[] | null;
  source_type: string | null;
  created_at: string;
  slug?: string | null;
  published?: boolean | null;
  pinned?: boolean | null;
  featured?: boolean | null;
};

export async function getRelatedIdeasForTrend(opts: {
  supabase: SupabaseClient;
  trendKeyword: string;
  trendTags?: string[] | null;
  limit?: number;
}): Promise<RelatedIdea[]> {
  const limit = opts.limit ?? 6;
  const supabase = opts.supabase;
  const keyword = opts.trendKeyword?.trim();
  const trendTags = Array.isArray(opts.trendTags)
    ? opts.trendTags.filter(Boolean)
    : [];

  const results: Record<string, RelatedIdea> = {};

  if (keyword) {
    const { data, error } = await supabase
      .from('ideas')
      .select(
        'id, title, one_liner, tags, source_type, created_at, slug, published, pinned, featured, description',
      )
      .or(
        `title.ilike.%${keyword}%,one_liner.ilike.%${keyword}%,description.ilike.%${keyword}%`,
      )
      .limit(12);

    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        results[row.id] = row as RelatedIdea;
      });
    }
  }

  if (trendTags.length > 0) {
    const { data, error } = await supabase
      .from('ideas')
      .select(
        'id, title, one_liner, tags, source_type, created_at, slug, published, pinned, featured, description',
      )
      .overlaps('tags', trendTags)
      .limit(12);

    if (!error && Array.isArray(data)) {
      data.forEach((row) => {
        results[row.id] = row as RelatedIdea;
      });
    }
  }

  const merged = Object.values(results);

  merged.sort((a, b) => {
    const pinnedA = a.pinned ? 1 : 0;
    const pinnedB = b.pinned ? 1 : 0;
    if (pinnedA !== pinnedB) return pinnedB - pinnedA;
    const featA = a.featured ? 1 : 0;
    const featB = b.featured ? 1 : 0;
    if (featA !== featB) return featB - featA;
    return (
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  });

  return merged.slice(0, limit);
}
