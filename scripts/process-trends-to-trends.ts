import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  type IngestionRunContext,
  type IngestionSource,
  type IngestionStatus,
} from '../lib/ingestion/types';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

type RawTrendsSnapshot = {
  id: number;
  snapshot_key: string;
  keyword: string;
  geo: string | null;
  timeframe: string | null;
  source: string;
  strategy_name: string | null;
  raw_payload: any;
};

type TrendPoint = { point_date: string; value: number };

async function loadUnprocessedSnapshots(
  limit = 10,
): Promise<RawTrendsSnapshot[]> {
  const { data, error } = await supabase
    .from('raw_trends_snapshots')
    .select(
      'id, snapshot_key, keyword, geo, timeframe, source, strategy_name, raw_payload',
    )
    .eq('processed', false)
    .order('ingested_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as RawTrendsSnapshot[];
}

async function markSnapshotsProcessed(ids: number[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('raw_trends_snapshots')
    .update({
      processed: true,
      last_processed_at: new Date().toISOString(),
    })
    .in('id', ids);

  if (error) throw error;
}

function slugifyKeyword(keyword: string): string {
  const slug = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'trend';
}

function extractTimelinePoints(payload: any): TrendPoint[] {
  const timeline =
    payload?.interestOverTime?.default?.timelineData ??
    payload?.default?.timelineData ??
    payload?.timelineData;

  if (!Array.isArray(timeline)) return [];

  const points: TrendPoint[] = [];

  for (const item of timeline) {
    const timeSeconds = Number(item?.time);
    const valueArray = item?.value;
    const rawValue = Array.isArray(valueArray)
      ? Number(valueArray[0])
      : Number(valueArray);

    if (!Number.isFinite(timeSeconds) || !Number.isFinite(rawValue)) continue;

    const pointDate = new Date(timeSeconds * 1000).toISOString().slice(0, 10);
    points.push({ point_date: pointDate, value: rawValue });
  }

  return points;
}

function computeMetrics(points: TrendPoint[]) {
  if (points.length === 0) {
    return {
      latest_value: null,
      peak_value: null,
      avg_value: null,
      growth_pct: null,
      sparkline: [] as number[],
    };
  }

  const values = points.map((p) => p.value);
  const latest_value = values[values.length - 1];
  const peak_value = Math.max(...values);
  const avg_value = values.reduce((sum, v) => sum + v, 0) / values.length;

  let growth_pct: number | null = null;
  if (values.length >= 14) {
    const last7 = values.slice(-7);
    const prev7 = values.slice(-14, -7);
    const avg = (arr: number[]) =>
      arr.reduce((sum, v) => sum + v, 0) / arr.length;
    const avgLast = avg(last7);
    const avgPrev = avg(prev7);
    const denom = Math.max(1, avgPrev);
    growth_pct = (avgLast - avgPrev) / denom;
  }

  const sparkline = values.slice(-30).map((v) => Math.round(v));

  return { latest_value, peak_value, avg_value, growth_pct, sparkline };
}

async function upsertTrendRow(
  snapshot: RawTrendsSnapshot,
  metrics: ReturnType<typeof computeMetrics>,
): Promise<number> {
  const geoLabel = snapshot.geo ?? 'GLOBAL';
  const timeframeLabel = snapshot.timeframe ?? DEFAULT_TIMEFRAME;
  const sourceLabel = snapshot.source || 'google_trends';
  const trend_key = `${sourceLabel}|${geoLabel}|${timeframeLabel}|${snapshot.keyword}`;
  const slug = slugifyKeyword(snapshot.keyword);
  const sourceValue = 'google_trends';

  const summary = `Search interest over time (${geoLabel}/${timeframeLabel}).`;

  const row = {
    trend_key,
    slug,
    title: snapshot.keyword,
    keyword: snapshot.keyword,
    geo: snapshot.geo ?? null,
    timeframe: snapshot.timeframe ?? null,
    source: sourceValue,
    source_primary: sourceLabel ?? sourceValue,
    summary,
    latest_value: metrics.latest_value,
    peak_value: metrics.peak_value,
    avg_value: metrics.avg_value,
    growth_pct: metrics.growth_pct,
    sparkline: metrics.sparkline,
    raw_latest_payload: snapshot.raw_payload,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('trends')
    .upsert([row], { onConflict: 'trend_key' })
    .select('id')
    .single();

  if (error) {
    throw new Error(
      `Failed to upsert trend for ${snapshot.keyword}: ${error.message}`,
    );
  }

  return data?.id as number;
}

async function upsertTrendPoints(
  trendId: number,
  points: TrendPoint[],
): Promise<void> {
  if (points.length === 0) return;

  const rows = points.map((p) => ({
    trend_id: trendId,
    point_date: p.point_date,
    value: p.value,
  }));

  const { error } = await supabase
    .from('trend_points')
    .upsert(rows, { onConflict: 'trend_id,point_date' });

  if (error) {
    throw new Error(`Failed to upsert trend_points: ${error.message}`);
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
    raw_count: counts.raw ?? 0,
    idea_count: counts.ideas ?? 0,
    trend_count: counts.trends ?? 0,
    error_message: errorMessage ?? null,
  };

  const { error } = await supabase
    .from('ingestion_runs')
    .update(updateData)
    .eq('id', ctx.id);

  if (error) {
    console.error('Failed to update ingestion_runs:', error);
  }
}

async function main() {
  console.log('--- Process raw_trends_snapshots → trends + trend_points ---');

  const ctx = await startIngestionRun('trends', 'trends-raw-to-trends');

  try {
    const snapshots = await loadUnprocessedSnapshots();
    console.log(`Loaded ${snapshots.length} unprocessed snapshot(s).`);

    const processedIds: number[] = [];
    let trendCount = 0;
    const errors: string[] = [];

    for (const snap of snapshots) {
      try {
        const points = extractTimelinePoints(snap.raw_payload);
        const metrics = computeMetrics(points);
        const trendId = await upsertTrendRow(snap, metrics);
        await upsertTrendPoints(trendId, points);
        processedIds.push(snap.id);
        trendCount += 1;
        console.log(
          `[${snap.snapshot_key}] Upserted trend ${trendId} with ${points.length} point(s).`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(
          `[${snap.snapshot_key}] Failed to process snapshot:`,
          message,
        );
        errors.push(message);
      }
    }

    if (processedIds.length > 0) {
      await markSnapshotsProcessed(processedIds);
      console.log(`Marked ${processedIds.length} snapshot(s) processed.`);
    }

    const status: IngestionStatus =
      errors.length > 0 && processedIds.length === 0
        ? 'error'
        : errors.length > 0
          ? 'partial'
          : 'success';

    await finishIngestionRun(
      ctx,
      status,
      { raw: snapshots.length, trends: trendCount },
      errors[0],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Top-level error while processing trends:', message);
    await finishIngestionRun(
      ctx,
      'error',
      { raw: 0, trends: 0 },
      message,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
