import path from 'node:path';
import dotenv from 'dotenv';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';
import { type AdminJobType, type AdminJobRow } from '../lib/server/adminJobs';
import { processSingleTrendsSnapshot } from '../lib/server/processTrendsSnapshot';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const execAsync = promisify(exec);

const JOB_COMMANDS: Partial<Record<AdminJobType, string>> = {
  'reddit-ingest': 'npm run ingest:reddit',
  'youtube-ingest': 'npm run ingest:youtube',
  'trends-ingest': 'npm run ingest:trends',
};

async function claimJob(worker: string): Promise<AdminJobRow | null> {
  const { data, error } = await supabase.rpc('claim_admin_job', { worker });
  if (error) {
    console.error('claim_admin_job failed:', error);
    return null;
  }
  return data as AdminJobRow | null;
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

async function runCommand(jobId: string, jobType: AdminJobType): Promise<string> {
  const command = JOB_COMMANDS[jobType];
  if (!command) {
    throw new Error(`Unknown job type: ${jobType}`);
  }
  const { stdout, stderr } = await execAsync(command, { env: process.env });
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

async function processJob(job: AdminJobRow) {
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
      log = await runCommand(jobId, jobType);
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
