import { supabaseServiceClient } from '../supabaseServiceClient';

export type IngestStrategyType = 'reddit' | 'youtube' | 'trends';

export interface IngestStrategyRow {
  id: string;
  type: IngestStrategyType;
  strategy_key: string;
  name: string;
  description: string | null;
  config: any; // jsonb payload from Supabase
  enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function getAdminSupabase() {
  return supabaseServiceClient;
}

export async function getEnabledStrategies(
  type: IngestStrategyType,
): Promise<IngestStrategyRow[]> {
  const supabase = getAdminSupabase();
  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('*')
    .eq('type', type)
    .eq('enabled', true)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to load ingest_strategies', { type, error });
    return [];
  }
  return data ?? [];
}

export interface StrategyWithConfig<TConfig> {
  id: string | null;
  type: IngestStrategyType;
  strategyKey: string;
  name: string;
  config: TConfig;
}

export async function getEnabledStrategiesOrDefault<TConfig extends object>(
  type: IngestStrategyType,
  defaults: Array<{ strategyKey: string; name: string; config: TConfig }>,
): Promise<Array<StrategyWithConfig<TConfig>>> {
  const rows = await getEnabledStrategies(type);
  if (!rows.length) {
    return defaults.map((d) => ({
      id: null,
      type,
      strategyKey: d.strategyKey,
      name: d.name,
      config: d.config,
    }));
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    strategyKey: row.strategy_key,
    name: row.name,
    config: (row.config ?? {}) as TConfig,
  }));
}
