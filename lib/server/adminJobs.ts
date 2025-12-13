import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { supabaseServiceClient as supabase } from '../supabaseServiceClient';

const execAsync = promisify(exec);

export type AdminJobType = 'reddit-ingest' | 'youtube-ingest' | 'trends-ingest';

const JOB_COMMANDS: Record<AdminJobType, string> = {
  'reddit-ingest': 'npm run ingest:reddit',
  'youtube-ingest': 'npm run ingest:youtube',
  'trends-ingest': 'npm run ingest:trends',
};

export async function createAdminJob(
  jobType: AdminJobType,
  payload: Record<string, unknown> | null,
) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .insert({
      job_type: jobType,
      payload: payload ?? {},
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data?.id as string;
}

export async function runAdminJob(jobId: string, jobType: AdminJobType) {
  const command = JOB_COMMANDS[jobType];
  if (!command) {
    throw new Error(`Unknown job type: ${jobType}`);
  }

  let log = '';
  try {
    const { stdout, stderr } = await execAsync(command, { env: process.env });
    log = `${stdout ?? ''}${stderr ?? ''}`;
    await supabase
      .from('admin_jobs')
      .update({
        status: 'success',
        finished_at: new Date().toISOString(),
        log,
      })
      .eq('id', jobId);
    return { ok: true, log };
  } catch (err) {
    log += `\nError: ${err instanceof Error ? err.message : String(err)}`;
    await supabase
      .from('admin_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        error: err instanceof Error ? err.message : String(err),
        log,
      })
      .eq('id', jobId);
    throw err;
  }
}

export async function listAdminJobs(limit = 50) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .select('id, job_type, status, payload, error, log, created_at, started_at, finished_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function getAdminJob(id: string) {
  const { data, error } = await supabase
    .from('admin_jobs')
    .select('id, job_type, status, payload, error, log, created_at, started_at, finished_at')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}
