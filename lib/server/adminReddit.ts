import { supabaseServiceClient } from '@/lib/supabaseServiceClient';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  source_post_id?: string | null;
  used_for_ideas?: boolean | null;
  promoted_at?: string | null;
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
        source_post_id,
        title,
        selftext,
        subreddit,
        score,
        num_comments,
        url,
        promoted_idea_id,
        selected,
        created_at,
        used_for_ideas,
        promoted_at
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

  const nowIso = new Date().toISOString();

  if (post.promoted_idea_id) {
    const needsUpdate = !post.used_for_ideas || !post.promoted_at;
    if (needsUpdate) {
      const { error: reuseUpdateError } = await supabase
        .from('raw_reddit_posts')
        .update({
          used_for_ideas: true,
          promoted_at: post.promoted_at ?? nowIso,
        })
        .eq('id', options.postId);

      if (reuseUpdateError) {
        throw new Error(
          `Failed to flag existing promotion for post ${options.postId}: ${reuseUpdateError.message}`,
        );
      }
    }

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
  const sourceMeta = {
    subreddit: post.subreddit,
    score: post.score,
    comments: post.num_comments,
    raw_post_id: post.source_post_id ?? post.id,
  };

  const insertPayload = {
    title: rawTitle || '(no title)',
    one_liner: oneLiner || null,
    description,
    tags,
    source_type: 'reddit',
    source_url: sourceUrl,
    source_meta: sourceMeta,
    published: false,
    status: 'draft',
    pinned: false,
    featured: false,
    created_by: options.adminUserId,
    updated_at: nowIso,
  };

  const { data: newIdea, error: ideaError } = await supabase
    .from('ideas')
    .insert(insertPayload)
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
      selected_for_idea: true,
      used_for_ideas: true,
      promoted_at: nowIso,
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
