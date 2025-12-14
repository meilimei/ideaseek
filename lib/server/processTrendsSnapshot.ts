import { supabaseServiceClient as supabase } from '../supabaseServiceClient';

type TrendPoint = { point_date: string; value: number };

const DEFAULT_TIMEFRAME = 'today 12-m';

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
  snapshot: {
    id: number;
    snapshot_key: string | null;
    keyword: string | null;
    geo: string | null;
    timeframe: string | null;
    source: string | null;
    strategy_name: string | null;
    raw_payload: any;
  },
  metrics: ReturnType<typeof computeMetrics>,
) {
  const geoLabel = snapshot.geo ?? 'GLOBAL';
  const timeframeLabel = snapshot.timeframe ?? DEFAULT_TIMEFRAME;
  const sourceLabel = snapshot.source || 'google_trends';
  const keyword = snapshot.keyword ?? 'unknown';
  const trend_key = `${sourceLabel}|${geoLabel}|${timeframeLabel}|${keyword}`;
  const slug = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'trend';

  const summary = `Search interest over time (${geoLabel}/${timeframeLabel}).`;

  const row = {
    trend_key,
    slug,
    title: keyword,
    keyword,
    geo: snapshot.geo ?? null,
    timeframe: snapshot.timeframe ?? null,
    source: sourceLabel,
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
      `Failed to upsert trend for ${keyword}: ${error.message}`,
    );
  }

  return data?.id as number;
}

async function upsertTrendPoints(trendId: number, points: TrendPoint[]) {
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

export async function processSingleTrendsSnapshot(snapshotId: number) {
  const { data: snapshot, error } = await supabase
    .from('raw_trends_snapshots')
    .select(
      'id, snapshot_key, keyword, geo, timeframe, source, strategy_name, raw_payload, processed, processed_at, last_error',
    )
    .eq('id', snapshotId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load snapshot ${snapshotId}: ${error.message}`);
  }
  if (!snapshot) {
    throw new Error(`Snapshot ${snapshotId} not found`);
  }

  const points = extractTimelinePoints(snapshot.raw_payload);
  const metrics = computeMetrics(points);
  const trendId = await upsertTrendRow(snapshot, metrics);
  await upsertTrendPoints(trendId, points);

  const { error: updErr } = await supabase
    .from('raw_trends_snapshots')
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq('id', snapshotId);

  if (updErr) {
    throw new Error(`Failed to mark snapshot processed: ${updErr.message}`);
  }
}
