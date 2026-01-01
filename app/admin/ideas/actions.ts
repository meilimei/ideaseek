'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

export async function enqueueIdeaEnrich(formData: FormData): Promise<void> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    throw new Error('Not authorized');
  }

  const ideaId = String(formData.get('idea_id') ?? '').trim();
  if (!ideaId) {
    throw new Error('Missing idea_id');
  }

  const { data: existing, error: existingError } = await supabase
    .from('admin_jobs')
    .select('id')
    .eq('job_type', 'idea_enrich')
    .eq('payload->>idea_id', ideaId)
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(1);

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (!existing || existing.length === 0) {
    const { error } = await supabase.from('admin_jobs').insert({
      job_type: 'idea_enrich',
      payload: { idea_id: ideaId, triggeredBy: 'admin' },
      status: 'queued',
      source: 'admin',
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  revalidatePath('/admin/ideas');
}

export async function rerunIdeaEnrich(formData: FormData): Promise<void> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    throw new Error('Not authorized');
  }

  const ideaId = String(formData.get('idea_id') ?? '').trim();
  if (!ideaId) {
    throw new Error('Missing idea_id');
  }

  const { error } = await supabase.from('admin_jobs').insert({
    job_type: 'idea_enrich',
    payload: { idea_id: ideaId, triggeredBy: 'admin' },
    status: 'queued',
    source: 'admin',
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/ideas');
}

export async function bulkEnqueueIdeaEnrich(formData: FormData): Promise<void> {
  const auth = await requireAdmin();
  if (auth.status !== 'ok') {
    throw new Error('Not authorized');
  }

  const ids = formData
    .getAll('idea_ids')
    .map((value) => String(value).trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return;
  }

  const { data: jobs, error: jobsError } = await supabase
    .from('admin_jobs')
    .select('status, payload, created_at')
    .eq('job_type', 'idea_enrich')
    .in('status', ['queued', 'running'])
    .order('created_at', { ascending: false })
    .limit(2000);

  if (jobsError) {
    throw new Error(jobsError.message);
  }

  const queuedIdeaIds = new Set<string>();
  for (const job of jobs ?? []) {
    const payload = (job as { payload?: Record<string, unknown> | null }).payload ?? null;
    const ideaId =
      typeof payload?.idea_id === 'string'
        ? payload.idea_id
        : typeof payload?.ideaId === 'string'
          ? payload.ideaId
          : null;
    if (ideaId) {
      queuedIdeaIds.add(ideaId);
    }
  }

  const toInsert = ids.filter((id) => !queuedIdeaIds.has(id));
  if (toInsert.length === 0) {
    return;
  }

  const { error } = await supabase.from('admin_jobs').insert(
    toInsert.map((id) => ({
      job_type: 'idea_enrich',
      payload: { idea_id: id, triggeredBy: 'admin' },
      status: 'queued',
      source: 'admin',
    })),
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/admin/ideas');
}
