import { supabaseServiceClient } from '@/lib/supabaseServiceClient';
import { createAdminJob } from '@/lib/server/adminJobs';
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
  created_utc?: string | null;
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
        created_utc,
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

  const sourceUrl = post.url ?? null;
  const insertPayload = {
    title: rawTitle || '(no title)',
    one_liner: oneLiner || null,
    description,
    tags: [],
    source_type: 'reddit',
    source_ref_id: post.source_post_id ?? post.id,
    source_url: sourceUrl,
    published: false,
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

  const evidencePayload = {
    idea_id: newIdea.id,
    source: 'reddit',
    source_type: 'reddit',
    source_ref_id: post.source_post_id ?? post.id,
    title: (post.title ?? rawTitle) || '(no title)',
    url: sourceUrl,
    excerpt: rawBody.trim().slice(0, 600) || null,
    metrics: {
      subreddit: post.subreddit,
      score: post.score,
      comments: post.num_comments,
      created_utc: post.created_utc,
    },
    raw_json: post,
  };

  const { error: evidenceError } = await supabase
    .from('idea_evidence')
    .insert(evidencePayload);

  if (evidenceError) {
    console.error('idea_evidence insert payload keys:', Object.keys(evidencePayload));
    throw new Error(
      `Failed to insert idea evidence for reddit post ${options.postId}: ${
        evidenceError.message
      }`,
    );
  }

  const jobId = await createAdminJob('idea_enrich', {
    payload: { idea_id: newIdea.id, triggeredBy: 'admin', source_type: 'reddit' },
    createdBy: options.adminUserId,
    dedupeKey: `${newIdea.id}:manual:${Date.now()}`,
  });

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
    jobId,
  };
}
