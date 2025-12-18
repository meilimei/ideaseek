import { supabaseServiceClient } from '@/lib/supabaseServiceClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export type IngestStrategySource = 'reddit' | 'youtube' | 'google_trends';

export interface IngestStrategy {
  id: string;
  name: string;
  source: IngestStrategySource;
  description: string | null;
  is_active: boolean;
  config: any;
  cron_expr: string | null;
  last_run_at: string | Date | null;
  last_run_status: string | null;
  last_error: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function getAdminSupabase(): SupabaseClient {
  return supabaseServiceClient;
}

export async function listStrategies(options?: {
  source?: IngestStrategySource | 'all';
  includeInactive?: boolean;
}): Promise<IngestStrategy[]> {
  const supabase = getAdminSupabase();
  const { source, includeInactive = false } = options ?? {};

  let query = supabase
    .from('ingest_strategies')
    .select('*')
    .order('created_at', { ascending: false });

  if (source && source !== 'all') {
    query = query.eq('source', source);
  }

  if (!includeInactive) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as IngestStrategy[];
}

export async function getStrategyById(
  id: string,
): Promise<IngestStrategy | null> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as IngestStrategy | null) ?? null;
}

export async function createStrategy(input: {
  name: string;
  source: IngestStrategySource;
  description?: string;
  is_active?: boolean;
  config?: any;
  cron_expr?: string;
  created_by?: string | null;
}): Promise<IngestStrategy> {
  const supabase = getAdminSupabase();

  const payload = {
    name: input.name,
    source: input.source,
    description: input.description ?? null,
    is_active: input.is_active ?? true,
    config: input.config ?? {},
    cron_expr: input.cron_expr ?? null,
    created_by: input.created_by ?? null,
  };

  const { data, error } = await supabase
    .from('ingest_strategies')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as IngestStrategy;
}

export async function updateStrategy(
  id: string,
  patch: Partial<{
    name: string;
    source: IngestStrategySource;
    description: string;
    is_active: boolean;
    config: any;
    cron_expr: string;
    last_run_at: string | Date;
    last_run_status: string;
    last_error: string;
  }>,
): Promise<IngestStrategy> {
  const supabase = getAdminSupabase();
  const update: Record<string, unknown> = {};

  if (typeof patch.name === 'string') update.name = patch.name;
  if (patch.source) update.source = patch.source;
  if (typeof patch.description === 'string') update.description = patch.description;
  if (typeof patch.is_active === 'boolean') update.is_active = patch.is_active;
  if (typeof patch.config !== 'undefined') update.config = patch.config;
  if (typeof patch.cron_expr === 'string') update.cron_expr = patch.cron_expr;
  if (typeof patch.last_run_at !== 'undefined') {
    update.last_run_at =
      patch.last_run_at instanceof Date
        ? patch.last_run_at.toISOString()
        : patch.last_run_at;
  }
  if (typeof patch.last_run_status === 'string') {
    update.last_run_status = patch.last_run_status;
  }
  if (typeof patch.last_error === 'string') {
    update.last_error = patch.last_error;
  }

  const { data, error } = await supabase
    .from('ingest_strategies')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as IngestStrategy;
}

export async function softDeleteStrategy(id: string): Promise<void> {
  const supabase = getAdminSupabase();
  const { error } = await supabase
    .from('ingest_strategies')
    .update({ is_active: false })
    .eq('id', id);

  if (error) {
    throw new Error(error.message);
  }
}
