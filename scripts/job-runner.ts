import path from 'node:path';
import dotenv from 'dotenv';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';
import { type AdminJobType, type AdminJobRow } from '../lib/server/adminJobs';
import { processSingleTrendsSnapshot } from '../lib/server/processTrendsSnapshot';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const execAsync = promisify(exec);

type StrategyRow = {
  id: string;
  source: string;
  config: any;
  is_active?: boolean | null;
  name?: string | null;
};

type JobWithStrategy = AdminJobRow & {
  strategy_id?: string | null;
  source?: string | null;
};

async function claimJob(worker: string): Promise<JobWithStrategy | null> {
  const { data, error } = await supabase.rpc('claim_admin_job', { worker });
  if (error) {
    console.error('claim_admin_job failed:', error);
    return null;
  }
  if (!data) return null;

  // Ensure we have full fields (strategy_id/source) by reloading the row.
  const { data: fullRow, error: fetchError } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, payload, error, log, created_at, started_at, finished_at, next_run_at, attempts, max_attempts, strategy_id, source',
    )
    .eq('id', (data as any).id)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to hydrate claimed job:', fetchError);
    return data as JobWithStrategy;
  }

  return (fullRow ?? data) as JobWithStrategy;
}

async function appendLog(jobId: string, message: string) {
  await supabase
    .from('admin_jobs')
    .update({
      log: supabase.rpc('coalesce', { args: ['log', ''] }), // placeholder; Supabase doesn't support this directly
    })
    .eq('id', jobId);
  // Simpler: overwrite log each time (safe enough for local runner)
  await supabase
    .from('admin_jobs')
    .update({
      log: message,
    })
    .eq('id', jobId);
}

async function runCommand(
  jobId: string,
  jobType: AdminJobType | string,
  strategy?: StrategyRow | null,
): Promise<string> {
  let command: string;
  const normalizedType = typeof jobType === 'string' ? jobType.replace(/_/g, '-') : jobType;
  switch (normalizedType) {
    case 'reddit-ingest':
      command = 'npm run ingest:reddit';
      break;
    case 'youtube-ingest':
      command = 'npm run ingest:youtube';
      break;
    case 'trends-ingest':
      command = 'npm run ingest:trends';
      break;
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }

  const env = { ...process.env };
  if (strategy) {
    env.INGEST_STRATEGY_ID = strategy.id;
    env.INGEST_STRATEGY_SOURCE = strategy.source;
    try {
      env.INGEST_STRATEGY_CONFIG = JSON.stringify(strategy.config ?? {});
    } catch {
      // ignore serialization issues
    }
  }

  const { stdout, stderr } = await execAsync(command, { env });
  const combined = `${stdout ?? ''}${stderr ?? ''}`;
  await appendLog(jobId, combined);
  return combined;
}

async function printQueuedSummary() {
  const { data, error } = await supabase
    .from('admin_jobs')
    .select('id, attempts, max_attempts, next_run_at')
    .eq('status', 'queued')
    .or('next_run_at.is.null,next_run_at.lte.now()')
    .order('id', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Failed to count queued jobs:', error);
    return;
  }

  const ready = (data ?? []).filter((row: any) => {
    const attempts = row.attempts ?? 0;
    const maxAttempts = row.max_attempts ?? 3;
    return attempts < maxAttempts;
  });

  const queuedIds = ready.slice(0, 5).map((row: any) => row.id);
  console.log(
    `Queued jobs: ${ready.length}${queuedIds.length ? ` (top ids: ${queuedIds.join(', ')})` : ''
    }`,
  );
}

async function markJob(
  jobId: string,
  status: 'success' | 'failed' | 'queued',
  log: string,
  errorMessage?: string,
  nextRunAt?: string | null,
) {
  const payload: Record<string, unknown> = {
    status,
    finished_at: new Date().toISOString(),
    log,
    error: errorMessage ?? null,
  };
  if (typeof nextRunAt !== 'undefined') {
    payload.next_run_at = nextRunAt;
  }
  await supabase.from('admin_jobs').update(payload).eq('id', jobId);
}

async function loadStrategy(id: string): Promise<StrategyRow | null> {
  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('id, source, config, is_active, name')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('Failed to load strategy', id, error);
    return null;
  }
  return data as StrategyRow | null;
}

async function processJob(job: JobWithStrategy) {
  const jobId = job.id;
  const jobType = job.job_type;
  let log = '';
  try {
    if (jobType === 'process-trends-snapshot') {
      const snapshotId = (job.payload as any)?.snapshot_id;
      if (!snapshotId) {
        throw new Error('Missing snapshot_id in payload');
      }
      await processSingleTrendsSnapshot(Number(snapshotId));
      log = `Processed trends snapshot ${snapshotId}`;
    } else {
      let strategy: StrategyRow | null = null;
      if (job.strategy_id) {
        strategy = await loadStrategy(job.strategy_id);
        if (!strategy || strategy.is_active === false) {
          throw new Error('Strategy not found or inactive');
        }
      }

      if (strategy && strategy.source === 'reddit') {
        log = await runCommand(jobId, 'reddit-ingest', strategy);
      } else if (strategy && strategy.source === 'youtube') {
        log = await runCommand(jobId, 'youtube-ingest', strategy);
      } else if (strategy && strategy.source === 'google_trends') {
        log = await runCommand(jobId, 'trends-ingest', strategy);
      } else {
        log = await runCommand(jobId, jobType, strategy);
      }

      if (strategy) {
        log = `Using strategy ${strategy.id} (${strategy.name ?? ''})\n${log}`;
      }
    }
    await markJob(jobId, 'success', log);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log += `\nError: ${message}`;
    const attempts = job.attempts ?? 0;
    const maxAttempts = job.max_attempts ?? 3;
    const shouldRetry = attempts + 1 < maxAttempts;
    const nextRunAt = shouldRetry
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
      : null;
    const status: 'queued' | 'failed' = shouldRetry ? 'queued' : 'failed';
    await markJob(jobId, status, log, message, nextRunAt);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const maxFlag = args.find((a) => a.startsWith('--max='));
  const maxJobs = maxFlag ? parseInt(maxFlag.split('=')[1], 10) || 3 : 3;
  const worker = `local-${Date.now()}`;

  console.log(`Job runner started. worker=${worker}, max=${maxJobs}`);
  await printQueuedSummary();

  for (let i = 0; i < maxJobs; i++) {
    const job = await claimJob(worker);
    if (!job) {
      console.log('No more queued jobs to claim.');
      break;
    }
    console.log(`Claimed job ${job.id} (${job.job_type})`);
    await processJob(job);
  }

  console.log('Job runner finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
