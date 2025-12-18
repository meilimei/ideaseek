import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type IngestionRunContext,
  type IngestionSource,
  type IngestionStatus,
} from '../lib/ingestion/types';
import {
  getEnabledStrategiesOrDefault,
  type StrategyWithConfig,
} from '../lib/server/ingestStrategies';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// google-trends-api is CommonJS
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleTrends = require('google-trends-api');

const DEFAULT_TIMEFRAME = 'today 12-m';

function ensureEnv(keys: string[]) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing environment variables: ${missing.join(
        ', ',
      )}. Populate them in .env.local before running.`,
    );
  }
}

ensureEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

type TrendsConfig = {
  keywords: string[];
  geo?: string;
  timeframe?: string;
  strategyName?: string;
};

const DEFAULT_TRENDS_PIPELINES: Array<{
  strategyKey: string;
  name: string;
  config: TrendsConfig;
}> = [
  {
    strategyKey: 'creator-economy',
    name: 'creator-economy',
    config: {
      keywords: [
        'picture management software',
        'content scheduler',
        'video editing ai',
      ],
      geo: 'US',
      timeframe: 'today 12-m',
    },
  },
  {
    strategyKey: 'ai-developer-tools',
    name: 'ai-developer-tools',
    config: {
      keywords: ['code assistant', 'ai code review'],
      geo: 'GLOBAL',
      timeframe: 'today 12-m',
    },
  },
];

type TrendsIngestStrategy = {
  id: string | null;
  strategyKey: string;
  name: string;
  keywords: string[];
  geo?: string;
  timeframe?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseTimeframe(
  timeframe?: string,
): { startTime: Date; endTime: Date } {
  const normalized = timeframe?.trim().toLowerCase() ?? DEFAULT_TIMEFRAME;
  const endTime = new Date();
  const startTime = new Date(endTime);

  switch (normalized) {
    case 'today 3-m':
      startTime.setMonth(startTime.getMonth() - 3);
      break;
    case 'today 5-y':
      startTime.setFullYear(startTime.getFullYear() - 5);
      break;
    case 'now 7-d':
      startTime.setDate(startTime.getDate() - 7);
      break;
    case 'now 30-d':
      startTime.setDate(startTime.getDate() - 30);
      break;
    case 'today 12-m':
    default:
      startTime.setMonth(startTime.getMonth() - 12);
      break;
  }

  return { startTime, endTime };
}

async function fetchInterestOverTime(
  keyword: string,
  geo?: string,
  timeframe?: string,
): Promise<Record<string, unknown>> {
  const { startTime, endTime } = parseTimeframe(timeframe);
  const geoParam = geo && geo !== 'GLOBAL' ? geo : undefined;
  const params: Record<string, unknown> = {
    keyword,
    startTime,
    endTime,
    hl: 'en-US',
  };

  if (geoParam) {
    params.geo = geoParam;
  }

  const raw = await googleTrends.interestOverTime(params);

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to parse interestOverTime response for "${keyword}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

async function upsertRawTrendsSnapshot(
  strategy: TrendsIngestStrategy,
  keyword: string,
  geo: string | undefined,
  timeframe: string | undefined,
  payload: unknown,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const geoLabel = geo && geo.trim() ? geo.trim() : 'GLOBAL';
  const timeframeLabel = timeframe?.trim() || DEFAULT_TIMEFRAME;
  const snapshot_key = `google_trends|${geoLabel}|${timeframeLabel}|${keyword}|${today}`;

  const { error } = await supabase
    .from('raw_trends_snapshots')
    .upsert(
      {
        snapshot_key,
        keyword,
        geo: geo ?? null,
        timeframe: timeframe ?? null,
        source: 'google_trends',
        strategy_name: strategy.name,
        ingest_strategy_id: strategy.id ?? null,
        raw_payload: payload,
      },
      { onConflict: 'snapshot_key' },
    );

  if (error) {
    throw new Error(
      `[${strategy.name}] Failed to upsert raw_trends_snapshots for ${keyword}: ${error.message}`,
    );
  }
}

async function startIngestionRun(
  source: IngestionSource,
  strategyName: string,
): Promise<IngestionRunContext> {
  const startedAt = new Date();
  const { data, error } = await supabase
    .from('ingestion_runs')
    .insert({
      source,
      strategy_name: strategyName,
      status: 'running',
      started_at: startedAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to start ingestion run:', error);
  }

  return {
    id: data?.id ?? null,
    source,
    strategyName,
    startedAt,
  };
}

async function finishIngestionRun(
  ctx: IngestionRunContext,
  status: IngestionStatus,
  counts: { raw?: number; ideas?: number; trends?: number },
  errorMessage?: string,
): Promise<void> {
  if (!ctx.id) return;

  const updateData: Record<string, unknown> = {
    status,
    finished_at: new Date().toISOString(),
  };

  if (typeof counts.raw === 'number') {
    updateData.raw_count = counts.raw;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('ingestion_runs')
    .update(updateData)
    .eq('id', ctx.id);

  if (error) {
    console.error('Failed to finish ingestion run:', error);
  }
}

async function main() {
  console.log(
    '--- Ingest Google Trends raw → Supabase.raw_trends_snapshots ---',
  );

  const strategies: StrategyWithConfig<TrendsConfig>[] =
    await getEnabledStrategiesOrDefault<TrendsConfig>(
      'trends',
      DEFAULT_TRENDS_PIPELINES,
    );

  const trendsStrategies: TrendsIngestStrategy[] = strategies.map((s) => ({
    id: s.id,
    strategyKey: s.strategyKey,
    name: s.name,
    keywords: s.config.keywords ?? [],
    geo: s.config.geo ?? 'US',
    timeframe: s.config.timeframe ?? DEFAULT_TIMEFRAME,
  }));

  for (const strategy of trendsStrategies) {
    const ctx = await startIngestionRun('trends', strategy.name);
    let rawInserted = 0;

    try {
      for (const keyword of strategy.keywords) {
        console.log(
          `[${strategy.strategyKey}] Fetching interest over time for "${keyword}" (${strategy.geo ?? 'GLOBAL'}, ${strategy.timeframe ?? DEFAULT_TIMEFRAME})`,
        );

        const payload = await fetchInterestOverTime(
          keyword,
          strategy.geo,
          strategy.timeframe,
        );
        await upsertRawTrendsSnapshot(
          strategy,
          keyword,
          strategy.geo,
          strategy.timeframe,
          payload,
        );
        rawInserted += 1;
        await sleep(500);
      }

      await finishIngestionRun(ctx, 'success', { raw: rawInserted });
      console.log(
        `[${strategy.strategyKey}] Stored ${rawInserted} raw trend snapshot(s).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[${strategy.strategyKey}] Error during trends ingestion:`,
        message,
      );
      await finishIngestionRun(ctx, 'error', { raw: rawInserted }, message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
