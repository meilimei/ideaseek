import { supabaseServiceClient } from '@/lib/supabaseServiceClient';
import type { SupabaseClient } from '@supabase/supabase-js';
import { computeIdeaSignals } from './ideaSignals';

function getAdminSupabaseClient(): SupabaseClient {
  return supabaseServiceClient;
}

export type AdminRedditPost = {
  id: string;
  title: string | null;
  selftext: string | null;
  subreddit: string | null;
  score: number | null;
  num_comments: number | null;
  url: string | null;
  promoted_idea_id: string | null;
  selected: boolean | null;
  created_at: string;
};

export async function promoteRedditPostToIdea(options: {
  postId: string;
  adminUserId: string;
}) {
  const supabase = getAdminSupabaseClient();

  const { data: post, error: fetchError } = await supabase
    .from('raw_reddit_posts')
    .select(
      `
        id,
        title,
        selftext,
        subreddit,
        score,
        num_comments,
        url,
        promoted_idea_id,
        selected,
        created_at
      `,
    )
    .eq('id', options.postId)
    .single();

  if (fetchError || !post) {
    throw new Error(
      `Failed to load reddit post ${options.postId}: ${
        fetchError?.message ?? 'not found'
      }`,
    );
  }

  if (post.promoted_idea_id) {
    return {
      ideaId: post.promoted_idea_id,
      created: false,
    };
  }

  const rawTitle = post.title ?? '';
  const rawBody = post.selftext ?? '';
  const oneLinerBase = rawBody.trim().length > 0 ? rawBody.trim() : rawTitle;
  const oneLiner = oneLinerBase.slice(0, 140);

  const description =
    rawBody.trim().length > 0
      ? rawBody.slice(0, 2000)
      : `Reddit pain point: ${rawTitle}`.slice(0, 2000);

  const subredditTag = post.subreddit ? `r/${post.subreddit}` : null;

  const tags = [
    ...(subredditTag ? [subredditTag] : []),
    'reddit',
    'community-painpoint',
  ];

  const sourceUrl = post.url ?? null;

  const insertPayload = {
    title: rawTitle || '(no title)',
    one_liner: oneLiner || null,
    description,
    tags,
    source_type: 'reddit',
    source_url: sourceUrl,
    published: false,
    pinned: false,
    featured: false,
    created_by: options.adminUserId,
  };

  const signals = computeIdeaSignals({
    title: insertPayload.title,
    one_liner: insertPayload.one_liner,
    description: insertPayload.description,
    tags: insertPayload.tags,
    source_type: insertPayload.source_type,
  });

  const mergedTags =
    insertPayload.tags && insertPayload.tags.length > 0
      ? Array.from(new Set([...(insertPayload.tags ?? []), ...signals.tags])).slice(
          0,
          3,
        )
      : signals.tags;

  const { data: newIdea, error: ideaError } = await supabase
    .from('ideas')
    .insert({
      ...insertPayload,
      tags: mergedTags,
      score: signals.score,
      status: signals.status,
      status_reason: signals.status_reason,
      keywords: signals.keywords,
    })
    .select('id, title')
    .single();

  if (ideaError || !newIdea) {
    throw new Error(
      `Failed to insert idea from reddit post ${options.postId}: ${
        ideaError?.message ?? 'unknown error'
      }`,
    );
  }

  const { error: updateError } = await supabase
    .from('raw_reddit_posts')
    .update({
      promoted_idea_id: newIdea.id,
      selected: true,
    })
    .eq('id', options.postId);

  if (updateError) {
    throw new Error(
      `Failed to update raw_reddit_posts after promotion: ${updateError.message}`,
    );
  }

  return {
    ideaId: newIdea.id as string,
    created: true,
  };
}
