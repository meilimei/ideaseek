import type { SupabaseClient } from '@supabase/supabase-js';

type RecordJobOutputsArgs = {
  supabase: SupabaseClient;
  jobId: number | null;
  jobCreatedBy: string | null;
  ideaIds: string[];
};

export async function recordJobOutputs({
  supabase,
  jobId,
  jobCreatedBy,
  ideaIds,
}: RecordJobOutputsArgs): Promise<void> {
  const uniqueIdeaIds = Array.from(
    new Set(ideaIds.map((id) => String(id).trim()).filter(Boolean)),
  );

  if (uniqueIdeaIds.length === 0) {
    return;
  }

  if (jobCreatedBy) {
    const { error } = await supabase
      .from('ideas')
      .update({ created_by: jobCreatedBy })
      .in('id', uniqueIdeaIds)
      .is('created_by', null);

    if (error) {
      console.warn('Failed to backfill idea owners:', error.message);
    }
  }

  if (!jobId) {
    return;
  }

  const rows = uniqueIdeaIds.map((id) => ({
    job_id: jobId,
    idea_id: id,
    relation_type: 'output',
  }));

  const { error: upsertError } = await supabase
    .from('admin_job_ideas')
    .upsert(rows, { onConflict: 'job_id,idea_id,relation_type', ignoreDuplicates: true });

  if (!upsertError) {
    return;
  }

  console.warn('admin_job_ideas upsert failed; falling back to insert:', upsertError.message);

  const { data: existing, error: existingError } = await supabase
    .from('admin_job_ideas')
    .select('idea_id')
    .eq('job_id', jobId)
    .eq('relation_type', 'output')
    .in('idea_id', uniqueIdeaIds);

  if (existingError) {
    console.warn('admin_job_ideas lookup failed:', existingError.message);
    return;
  }

  const existingIds = new Set(
    (existing ?? []).map((row) => String(row.idea_id)),
  );
  const missingRows = rows.filter((row) => !existingIds.has(String(row.idea_id)));

  if (missingRows.length === 0) {
    return;
  }

  const { error: insertError } = await supabase
    .from('admin_job_ideas')
    .insert(missingRows);

  if (insertError) {
    console.warn('admin_job_ideas insert failed:', insertError.message);
  }
}
