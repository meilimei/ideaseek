import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeTrendSignals } from '../lib/server/trendsSignals';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

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

type TrendRow = {
  id: string;
  keyword: string;
  title?: string | null;
  growth_pct?: number | null;
  latest_value?: number | null;
  peak_value?: number | null;
  avg_value?: number | null;
  sparkline?: number[] | null;
};

const BATCH_SIZE = 50;

async function loadBatch(offset: number, limit: number): Promise<TrendRow[]> {
  const { data, error } = await supabase
    .from('trends')
    .select(
      'id, keyword, title, growth_pct, latest_value, peak_value, avg_value, sparkline',
    )
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new Error(`Failed to load trends batch: ${error.message}`);
  }

  return (data ?? []) as TrendRow[];
}

async function updateTrend(row: TrendRow) {
  const signals = computeTrendSignals({
    keyword: row.keyword,
    title: row.title,
    growth_pct: row.growth_pct,
    latest_value: row.latest_value,
    peak_value: row.peak_value,
    avg_value: row.avg_value,
    sparkline: row.sparkline,
  });

  const { error } = await supabase
    .from('trends')
    .update({
      tags: signals.tags,
      score: signals.score,
      status: signals.status,
      status_reason: signals.status_reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) {
    throw new Error(`Failed to update trend ${row.id}: ${error.message}`);
  }
}

async function main() {
  console.log('--- Backfill trend signals (tags/score/status) ---');

  let offset = 0;
  let totalProcessed = 0;
  // First, count total rows
  const { count, error: countError } = await supabase
    .from('trends')
    .select('id', { count: 'exact', head: true });
  if (countError) throw countError;

  const totalRows = count ?? 0;
  console.log(`Total trends: ${totalRows}`);

  while (true) {
    const batch = await loadBatch(offset, BATCH_SIZE);
    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        await updateTrend(row);
        totalProcessed += 1;
        if (totalProcessed % 25 === 0) {
          console.log(`Updated ${totalProcessed}/${totalRows}...`);
        }
      } catch (err) {
        console.error(
          `Failed to backfill trend ${row.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    offset += batch.length;
  }

  console.log(`Backfill complete. Updated ${totalProcessed} rows.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
