import { supabaseServiceClient } from '../../lib/supabaseServiceClient';
import { computeIdeaSignals } from '../../lib/server/ideaSignals';

export type IdeaForInsert = {
  title: string;
  one_liner?: string | null;
  description?: string | null;
  tags?: string[] | null;
  difficulty?: number | null;
  market_size?: string | null;
  demand_strength?: string | null;
  pain_points?: string[] | null;
  target_users?: string | null;
  market_stage?: string | null;
  competition?: string | null;
  monetization?: string[] | null;
  key_risks?: string[] | null;
  next_steps?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  score?: number | null;
  status?: string | null;
  status_reason?: string | null;
  keywords?: string[] | null;
};

type SkipReason = 'source_url' | 'title';

function escapeLikePattern(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

export async function insertIdeas(ideas: IdeaForInsert[]): Promise<void> {
  if (ideas.length === 0) {
    console.log('No ideas to insert.');
    return;
  }

  const uniqueIdeas: IdeaForInsert[] = [];
  const skipped: { title: string; source_url?: string | null; reason: SkipReason }[] = [];

  for (const idea of ideas) {
    // First dedupe: by source_url when coming from Reddit
    if (idea.source_type === 'reddit' && idea.source_url) {
      const { data: existing, error } = await supabaseServiceClient
        .from('ideas')
        .select('id')
        .eq('source_type', 'reddit')
        .eq('source_url', idea.source_url)
        .maybeSingle();

      if (error) {
        console.warn(
          `Dedup check (source_url) failed for ${idea.source_url}, inserting anyway:`,
          error.message,
        );
      } else if (existing) {
        skipped.push({ title: idea.title, source_url: idea.source_url, reason: 'source_url' });
        continue;
      }
    }

    // Second dedupe: case-insensitive title match
    const titlePattern = escapeLikePattern(idea.title);
    const { data: existingTitle, error: titleError } = await supabaseServiceClient
      .from('ideas')
      .select('id')
      .ilike('title', titlePattern)
      .limit(1)
      .maybeSingle();

    if (titleError) {
      console.warn(
        `Dedup check (title) failed for "${idea.title}", inserting anyway:`,
        titleError.message,
      );
    } else if (existingTitle) {
      skipped.push({ title: idea.title, reason: 'title' });
      continue;
    }

    uniqueIdeas.push(idea);
  }

  if (uniqueIdeas.length === 0) {
    console.log(
      `All ${ideas.length} ideas were skipped (duplicates by source_url/title).`,
    );
    if (skipped.length > 0) {
      console.log(
        'Skipped titles:',
        skipped.slice(0, 10).map((s) => `${s.title} (${s.reason})`),
      );
    }
    return;
  }

  const enrichedIdeas = uniqueIdeas.map((idea) => {
    const signals = computeIdeaSignals({
      title: idea.title,
      one_liner: idea.one_liner,
      description: idea.description,
      tags: idea.tags,
      demand_strength: idea.demand_strength,
      market_size: idea.market_size,
      difficulty: idea.difficulty ?? null,
      source_type: idea.source_type,
    });
    const mergedTags =
      idea.tags && idea.tags.length > 0
        ? Array.from(new Set([...idea.tags, ...signals.tags])).slice(0, 3)
        : signals.tags;

    return {
      ...idea,
      tags: mergedTags,
      score: signals.score,
      status: signals.status,
      status_reason: signals.status_reason,
      keywords: signals.keywords,
    };
  });

  const { data, error } = await supabaseServiceClient
    .from('ideas')
    .insert(enrichedIdeas)
    .select('id, title, source_url');

  if (error) {
    console.error('Error inserting ideas:', error);
    return;
  }

  console.log(`Inserted ${data?.length ?? 0} idea(s).`);
  if (data && data.length > 0) {
    console.log('Inserted titles:', data.slice(0, 10).map((row) => row.title));
  }
  if (skipped.length > 0) {
    console.log(
      `Skipped ${skipped.length} duplicate(s) by source_url/title.`,
      skipped.slice(0, 10).map((s) => `${s.title} (${s.reason})`),
    );
  }
}
