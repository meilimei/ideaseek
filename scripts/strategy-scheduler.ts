import path from 'node:path';
import dotenv from 'dotenv';
import * as CronParser from 'cron-parser';
import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

type StrategyRow = {
  id: string;
  name: string | null;
  strategy_key?: string | null;
  cron?: string | null;
  cron_expr?: string | null;
  next_run_at?: string | null;
  last_enqueued_at?: string | null;
  last_error?: string | null;
  is_active?: boolean | null;
  deleted_at?: string | null;
  type?: string | null;
  source?: string | null;
  config?: any;
};

const JOB_MAP: Record<string, string> = {
  reddit: 'reddit-ingest',
  youtube: 'youtube-ingest',
  google_trends: 'google-trends-ingest',
  'google-trends': 'google-trends-ingest',
};

function parseArgs() {
  const args = process.argv.slice(2);
  const maxFlag = args.find((a) => a.startsWith('--max='));
  const max = maxFlag ? parseInt(maxFlag.split('=')[1], 10) || 50 : 50;
  const dryRun = args.includes('--dry-run');
  return { max, dryRun };
}

function normalizeSource(value?: string | null) {
  if (!value) return null;
  const v = value.toLowerCase().replace(/\s+/g, '_');
  if (['reddit', 'youtube', 'google_trends', 'google-trends'].includes(v)) return v === 'google-trends' ? 'google_trends' : v;
  return null;
}

async function fetchDueStrategies(limit: number): Promise<StrategyRow[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('id, name, strategy_key, cron, cron_expr, next_run_at, last_enqueued_at, last_error, is_active, deleted_at, type, source, config')
    .eq('is_active', true)
    .is('deleted_at', null)
    .or(`next_run_at.lte.${nowIso},next_run_at.is.null`)
    .order('next_run_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

function getCronInterval(cronStr: string, currentDate: Date) {
  const opts = { currentDate };
  const parser: any = CronParser as any;

  if (typeof parser.parseExpression === 'function') {
    return parser.parseExpression(cronStr, opts);
  }
  if (parser?.default && typeof parser.default.parseExpression === 'function') {
    return parser.default.parseExpression(cronStr, opts);
  }
  if (parser?.CronExpressionParser && typeof parser.CronExpressionParser.parse === 'function') {
    return parser.CronExpressionParser.parse(cronStr, opts);
  }

  throw new Error('No supported cron parser found');
}

function computeNext(cronStr: string, currentDate: Date) {
  const interval = getCronInterval(cronStr, currentDate);
  const next = interval.next();
  return typeof next.toDate === 'function' ? next.toDate() : new Date(next);
}

async function scheduleStrategy(strategy: StrategyRow, dryRun: boolean) {
  const source = normalizeSource(strategy.type ?? strategy.source);
  const jobType = source ? JOB_MAP[source] : null;
  const cronStr = (strategy.cron ?? strategy.cron_expr ?? '').trim();
  if (!cronStr) {
    throw new Error(`Invalid cron for ${strategy.id}: Missing cron expression`);
  }
  if (!jobType) {
    throw new Error(`Unsupported source ${strategy.type ?? strategy.source}`);
  }

  const scheduledAt = strategy.next_run_at ? new Date(strategy.next_run_at) : new Date();

  let nextRunAt: Date;
  try {
    nextRunAt = computeNext(cronStr, new Date());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!dryRun) {
      await supabase
        .from('ingest_strategies')
        .update({ last_error: message, updated_at: new Date().toISOString() })
        .eq('id', strategy.id);
    }
    throw new Error(`Invalid cron for ${strategy.id}: ${message}`);
  }

  const dedupeKey = `${strategy.id}:${scheduledAt.toISOString()}`;
  const payload = {
    strategyId: strategy.id,
    strategyKey: strategy.strategy_key ?? strategy.id,
    strategyType: source,
    config: strategy.config ?? {},
    triggeredBy: 'scheduler',
    scheduledAt: scheduledAt.toISOString(),
  };

  if (!dryRun) {
    const { error: jobError } = await supabase
      .from('admin_jobs')
      .upsert(
        {
          job_type: jobType,
          payload,
          status: 'queued',
          next_run_at: new Date().toISOString(),
          strategy_id: strategy.id,
          source,
          dedupe_key: dedupeKey,
        },
        { onConflict: 'dedupe_key' },
      )
      .select('id')
      .single();

    if (jobError) {
      throw new Error(jobError.message);
    }

    const { error: updateError } = await supabase
      .from('ingest_strategies')
      .update({
        last_enqueued_at: new Date().toISOString(),
        next_run_at: nextRunAt.toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', strategy.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  }

  return { dedupeKey, nextRunAt };
}

async function main() {
  const { max, dryRun } = parseArgs();
  const due = await fetchDueStrategies(max);
  let enqueued = 0;
  let skipped = 0;

  for (const strategy of due) {
    try {
      await scheduleStrategy(strategy, dryRun);
      enqueued += 1;
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      skipped += 1;
    }
  }

  console.log(
    `Checked ${due.length} strategies. Enqueued: ${enqueued}. Skipped: ${skipped}. Dry-run: ${dryRun}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
