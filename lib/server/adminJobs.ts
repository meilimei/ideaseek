import { supabaseServiceClient as supabase } from '../supabaseServiceClient';

export type AdminJobType = 'reddit-ingest' | 'youtube-ingest' | 'trends-ingest';

export type AdminJobRow = {
  id: string;
  job_type: AdminJobType;
  status: string;
  payload: Record<string, unknown>;
  attempts?: number | null;
  max_attempts?: number | null;
  next_run_at?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  log?: string | null;
  error?: string | null;
};

export async function createAdminJob(
  jobType: AdminJobType,
  payload: Record<string, unknown> | null,
  createdBy?: string,
) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .insert({
      job_type: jobType,
      payload: payload ?? {},
      status: 'queued',
      next_run_at: new Date().toISOString(),
      created_by: createdBy ?? null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id as string;
}

export async function listAdminJobs(limit = 50) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, payload, error, log, created_at, started_at, finished_at, next_run_at, attempts, max_attempts',
    )
    .order('id', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getAdminJob(id: string) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, payload, error, log, created_at, started_at, finished_at, next_run_at, attempts, max_attempts',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
