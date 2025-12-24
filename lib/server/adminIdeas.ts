import { supabaseServiceClient } from '@/lib/supabaseServiceClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminIdeaStatus = 'published' | 'unpublished' | 'deleted' | 'draft' | 'archived';

export type AdminIdea = {
  id: string;
  title: string;
  one_liner: string | null;
  source_type: string | null;
  source_url: string | null;
  published: boolean;
  pinned: boolean;
  featured: boolean;
  deleted_at: string | null;
  published_at?: string | null;
  unpublished_at?: string | null;
  status?: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ListIdeasParams = {
  search?: string;
  sourceType?: string;
  status?: 'all' | 'published' | 'unpublished' | 'deleted';
  createdBy?: string;
  includeDeleted?: boolean;
  page?: number;
  pageSize?: number;
};

export type UpdateIdeaFlagsInput = {
  published?: boolean;
  pinned?: boolean;
  featured?: boolean;
  softDelete?: boolean;
};

function getAdminSupabaseClient(): SupabaseClient {
  return supabaseServiceClient;
}

export async function listIdeas(
  params: ListIdeasParams,
): Promise<{ items: AdminIdea[]; total: number }> {
  const supabase = getAdminSupabaseClient();
  const {
    search,
    sourceType,
    status = 'all',
    createdBy,
    includeDeleted = false,
    page = 1,
    pageSize = 20,
  } = params;

  let query = supabase
    .from('ideas')
    .select(
      `
      id,
      title,
      one_liner,
      source_type,
      source_url,
      published,
      pinned,
      featured,
      published_at,
      unpublished_at,
      status,
      deleted_at,
      created_by,
      created_at,
      updated_at
      `,
      { count: 'exact' },
    );

  if (search && search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(`title.ilike.${pattern},one_liner.ilike.${pattern}`);
  }

  if (sourceType && sourceType !== 'all') {
    query = query.eq('source_type', sourceType);
  }

  if (status === 'published') {
    query = query.eq('published', true).is('deleted_at', null);
  } else if (status === 'unpublished') {
    query = query.eq('published', false).is('deleted_at', null);
  } else if (status === 'deleted') {
    query = query.not('deleted_at', 'is', null);
  } else if (!includeDeleted) {
    query = query.is('deleted_at', null);
  }

  if (createdBy) {
    query = query.eq('created_by', createdBy);
  }

  query = query.order('created_at', { ascending: false, nullsLast: true });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return { items: (data ?? []) as AdminIdea[], total: count ?? 0 };
}

export async function updateIdeaFlags(
  id: string,
  changes: UpdateIdeaFlagsInput,
  adminUserId: string,
) {
  const supabase = getAdminSupabaseClient();
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    updated_at: nowIso,
  };

  if (typeof changes.published === 'boolean') {
    update.published = changes.published;
    update.status = changes.published ? 'published' : 'draft';
    if (changes.published) {
      update.published_at = nowIso;
      update.unpublished_at = null;
    } else {
      update.unpublished_at = nowIso;
    }
  }
  if (typeof changes.pinned === 'boolean') {
    update.pinned = changes.pinned;
  }
  if (typeof changes.featured === 'boolean') {
    update.featured = changes.featured;
  }
  if (changes.softDelete === true) {
    update.deleted_at = new Date().toISOString();
    update.deleted_by = adminUserId;
    update.status = 'archived';
  } else if (changes.softDelete === false) {
    update.deleted_at = null;
    update.deleted_by = null;
    if (typeof update.published === 'undefined') {
      update.published = false;
      update.unpublished_at = nowIso;
    }
    if (!update.status) {
      update.status = update.published ? 'published' : 'draft';
    }
  }

  const { data, error } = await supabase
    .from('ideas')
    .update(update)
    .eq('id', id)
    .select(
      `
      id,
      title,
      one_liner,
      source_type,
      source_url,
      published,
      pinned,
      featured,
      published_at,
      unpublished_at,
      status,
      deleted_at,
      created_by,
      created_at,
      updated_at
      `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
