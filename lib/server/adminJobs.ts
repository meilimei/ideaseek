import { supabaseServiceClient as supabase } from '../supabaseServiceClient';

export type AdminJobType =
  | 'reddit-ingest'
  | 'youtube-ingest'
  | 'trends-ingest'
  | 'process-trends-snapshot';

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
  strategy_id?: string | null;
  source?: string | null;
};

export async function createAdminJob(
  type: AdminJobType,
  options?: {
    payload?: unknown;
    strategyId?: string | null;
    source?: string | null;
    createdBy?: string | null;
  },
) {
  const payloadObj =
    (options?.payload && typeof options.payload === 'object'
      ? (options.payload as Record<string, unknown>)
      : options?.payload ?? {}) ?? {};

  const inferredSource =
    options?.source ??
    (typeof options?.payload === 'object' &&
    options?.payload &&
    'source' in (options.payload as Record<string, unknown>)
      ? String((options.payload as Record<string, unknown>).source)
      : null);

  const { data, error } = await supabase
    .from('admin_jobs')
    .insert({
      job_type: type,
      payload: payloadObj,
      status: 'queued',
      next_run_at: new Date().toISOString(),
      created_by: options?.createdBy ?? null,
      strategy_id: options?.strategyId ?? null,
      source: inferredSource,
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
