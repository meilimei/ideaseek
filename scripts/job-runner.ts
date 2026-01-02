import path from 'node:path';
import dotenv from 'dotenv';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';
import { type AdminJobType, type AdminJobRow } from '../lib/server/adminJobs';
import { ideaEnrich } from '../lib/ai/ideaEnrich';
import { processSingleTrendsSnapshot } from '../lib/server/processTrendsSnapshot';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const execAsync = promisify(exec);
const rawPollMs = Number.parseInt(process.env.JOB_RUNNER_POLL_MS ?? '2000', 10);
const POLL_MS = Number.isFinite(rawPollMs) && rawPollMs >= 200 ? rawPollMs : 200;

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
  created_by?: string | null;
};

type EvidenceRow = {
  id: string;
  title: string | null;
  excerpt: string | null;
  metrics: any;
  raw_json: any;
  source_type?: string | null;
  created_at?: string | null;
};

type IdeaRow = {
  id: string;
  title: string | null;
  one_liner: string | null;
  source_type: string | null;
  source_ref_id: string | null;
};

async function claimJob(worker: string): Promise<JobWithStrategy | null> {
  const { data, error } = await supabase.rpc('claim_admin_job', { worker });
  if (error) {
    console.error('claim_admin_job failed:', error);
    return null;
  }

  const rawClaim = Array.isArray(data) ? data[0] : data;
  const claimedId = rawClaim?.id ?? rawClaim?.job_id;
  const claimedType = rawClaim?.job_type ?? rawClaim?.type;

  if (!claimedId) {
    return null;
  }

  // Ensure we have full fields (strategy_id/source) by reloading the row.
  const { data: fullRow, error: fetchError } = await supabase
    .from('admin_jobs')
    .select(
      'id, job_type, status, payload, error, log, created_at, started_at, finished_at, next_run_at, attempts, max_attempts, strategy_id, source, created_by',
    )
    .eq('id', `${claimedId}`)
    .maybeSingle();

  if (fetchError) {
    console.error('Failed to hydrate claimed job:', fetchError);
    return null;
  }

  const hydrated = (fullRow ?? {
    id: `${claimedId}`,
    job_type: claimedType ?? null,
    status: 'queued',
    payload: {},
  }) as JobWithStrategy;

  // Ensure id and job_type are present.
  if (!hydrated?.id) {
    console.warn('Hydrated job missing id', { claimedId, claimedType, keys: Object.keys(hydrated ?? {}) });
    return null;
  }

  return hydrated;
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

function compactUpdate<T extends Record<string, unknown>>(input: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'undefined') continue;
    if (key === 'next_run_at' && value === null) continue;
    output[key] = value;
  }
  return output as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function linkJobToIdea(
  jobId: number | string,
  ideaId: string,
  relationType = 'target',
) {
  const { error } = await supabase.from('admin_job_ideas').insert({
    job_id: jobId,
    idea_id: ideaId,
    relation_type: relationType,
  });

  if (error) {
    const code = (error as { code?: string | null }).code ?? null;
    const isDuplicate = code === '23505' || error.message.includes('duplicate key');
    if (!isDuplicate) {
      throw error;
    }
  }
}

function extractIdeaIds(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return [];
  const raw = payload as Record<string, unknown>;
  const ids: string[] = [];
  if (typeof raw.idea_id === 'string') {
    ids.push(raw.idea_id);
  }
  if (Array.isArray(raw.idea_ids)) {
    for (const value of raw.idea_ids) {
      if (typeof value === 'string') {
        ids.push(value);
      }
    }
  }
  return Array.from(new Set(ids));
}

async function runCommand(
  jobId: string,
  jobType: AdminJobType | string,
  strategy?: StrategyRow | null,
  payload?: Record<string, any>,
  jobCreatedBy?: string | null,
): Promise<string> {
  let command: string;
  const normalizedType = typeof jobType === 'string' ? jobType.replace(/_/g, '-') : jobType;
  switch (normalizedType) {
    case 'reddit-ingest':
      command = 'npm run ingest:reddit';
      break;
    case 'youtube-ingest':
      command = 'npm run --silent ingest:youtube';
      break;
    case 'trends-ingest':
    case 'google-trends-ingest':
      command = 'npm run ingest:trends';
      break;
    case 'idea_enrich':
      throw new Error('idea_enrich does not use ingest commands');
    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }

  const env = {
    ...process.env,
    ADMIN_JOB_ID: String(jobId),
    ADMIN_JOB_CREATED_BY: jobCreatedBy ?? '',
  };
  if (strategy) {
    env.INGEST_STRATEGY_ID = strategy.id;
    env.INGEST_STRATEGY_SOURCE = strategy.source;
    try {
      env.INGEST_STRATEGY_CONFIG = JSON.stringify(strategy.config ?? {});
    } catch {
      // ignore serialization issues
    }
  }
  if (!strategy && payload?.strategyId) {
    env.INGEST_STRATEGY_ID = payload.strategyId;
    env.INGEST_STRATEGY_SOURCE = payload.strategyType ?? payload.source ?? '';
    try {
      env.INGEST_STRATEGY_CONFIG = JSON.stringify(payload.config ?? {});
    } catch {
      // ignore
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
    return 0;
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
  return ready.length;
}

async function getIdleDiagnostics() {
  const nowIso = new Date().toISOString();

  const [readyRes, runningRes, futureRes] = await Promise.all([
    supabase
      .from('admin_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued')
      .or('next_run_at.is.null,next_run_at.lte.now()'),
    supabase
      .from('admin_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'running'),
    supabase
      .from('admin_jobs')
      .select('next_run_at')
      .eq('status', 'queued')
      .gt('next_run_at', nowIso)
      .order('next_run_at', { ascending: true, nullsLast: true })
      .limit(1),
  ]);

  const readyCount = readyRes.count ?? 0;
  const runningCount = runningRes.count ?? 0;
  const nextFuture =
    futureRes.data && futureRes.data.length > 0
      ? (futureRes.data[0] as { next_run_at?: string | null }).next_run_at ?? null
      : null;

  return { readyCount, runningCount, nextFuture };
}

async function markJob(
  jobId: string,
  status: 'success' | 'failed' | 'queued' | 'running' | 'error',
  log: string,
  errorMessage?: string,
  nextRunAt?: string | null,
  result?: Record<string, unknown> | null,
) {
  const nowIso = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status,
    log,
    error: errorMessage ?? null,
  };

  if (status === 'running') {
    payload.started_at = nowIso;
    payload.finished_at = null;
  } else {
    payload.finished_at = nowIso;
  }

  if (typeof nextRunAt !== 'undefined') {
    if (nextRunAt !== null) {
      payload.next_run_at = nextRunAt;
    }
  }

  if (result) {
    payload.result = result;
  }

  const updatePayload = compactUpdate(payload);

  const { error } = await supabase.from('admin_jobs').update(updatePayload).eq('id', jobId);

  if (error && result) {
    // Retry without result column in case schema lacks it.
    const retryPayload = compactUpdate({ ...updatePayload });
    delete (retryPayload as any).result;
    const retry = await supabase.from('admin_jobs').update(retryPayload).eq('id', jobId);
    if (retry.error) {
      console.error('Failed to update admin_jobs status (retry):', {
        message: retry.error.message,
        keys: Object.keys(retryPayload),
      });
    }
  } else if (error) {
    console.error('Failed to update admin_jobs status:', {
      message: error.message,
      keys: Object.keys(updatePayload),
    });
  }
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

async function loadIdeaWithEvidence(ideaId: string) {
  const { data: idea, error: ideaError } = await supabase
    .from('ideas')
    .select('id, title, one_liner, source_type, source_ref_id')
    .eq('id', ideaId)
    .single();
  if (ideaError) {
    throw new Error(`Failed to load idea ${ideaId}: ${ideaError.message}`);
  }

  const { data: evidence, error: evidenceError } = await supabase
    .from('idea_evidence')
    .select('id, title, excerpt, metrics, raw_json, source_type, created_at')
    .eq('idea_id', ideaId);

  if (evidenceError) {
    throw new Error(`Failed to load idea evidence ${ideaId}: ${evidenceError.message}`);
  }

  return {
    idea: idea as IdeaRow,
    evidence: (evidence ?? []) as EvidenceRow[],
  };
}

const TAG_ALLOWLIST = new Set([
  'ai',
  'automation',
  'productivity',
  'marketing',
  'saas',
  'community',
  'creator',
  'analytics',
  'finance',
  'education',
  'health',
  'ecommerce',
  'hr',
  'sales',
  'developer',
  'design',
  'security',
  'travel',
  'fitness',
  'real-estate',
  'legal',
  'customer-support',
  'social-media',
  'content',
  'research',
  'ops',
  'b2b',
  'b2c',
  'startups',
]);

const TOKEN_TO_TAG: Record<string, string> = {
  ai: 'ai',
  gpt: 'ai',
  llm: 'ai',
  automate: 'automation',
  automation: 'automation',
  productivity: 'productivity',
  marketing: 'marketing',
  saas: 'saas',
  community: 'community',
  creator: 'creator',
  creators: 'creator',
  analytics: 'analytics',
  finance: 'finance',
  fintech: 'finance',
  education: 'education',
  edtech: 'education',
  health: 'health',
  fitness: 'fitness',
  ecommerce: 'ecommerce',
  'e-commerce': 'ecommerce',
  shopify: 'ecommerce',
  hr: 'hr',
  hiring: 'hr',
  sales: 'sales',
  dev: 'developer',
  developer: 'developer',
  design: 'design',
  security: 'security',
  travel: 'travel',
  legal: 'legal',
  support: 'customer-support',
  customersupport: 'customer-support',
  social: 'social-media',
  socialmedia: 'social-media',
  content: 'content',
  research: 'research',
  ops: 'ops',
  b2b: 'b2b',
  b2c: 'b2c',
  startup: 'startups',
  startups: 'startups',
};

const SUBREDDIT_TAGS: Record<string, string[]> = {
  entrepreneur: ['startups', 'b2b'],
  startups: ['startups', 'b2b'],
  sideproject: ['startups', 'productivity'],
  saas: ['saas', 'b2b'],
  productivity: ['productivity'],
  marketing: ['marketing'],
  ecommerce: ['ecommerce'],
  indiehackers: ['startups', 'saas'],
};

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractTags(idea: IdeaRow, evidence: EvidenceRow[]) {
  const tags = new Set<string>();
  const textParts = [
    idea.title ?? '',
    idea.one_liner ?? '',
    ...evidence.map((row) => row.title ?? ''),
    ...evidence.map((row) => row.excerpt ?? ''),
  ];

  for (const token of tokenize(textParts.join(' '))) {
    const normalized = token.replace(/_/g, '-');
    const mapped = TOKEN_TO_TAG[normalized];
    const tag = mapped ?? (TAG_ALLOWLIST.has(normalized) ? normalized : null);
    if (tag && TAG_ALLOWLIST.has(tag)) {
      tags.add(tag);
    }
  }

  for (const row of evidence) {
    const subreddit =
      row.metrics?.subreddit ??
      row.raw_json?.subreddit ??
      row.raw_json?.subreddit_name_prefixed ??
      null;
    if (typeof subreddit === 'string') {
      const key = subreddit.replace(/^r\//i, '').toLowerCase();
      const mapped = SUBREDDIT_TAGS[key];
      if (mapped) {
        mapped.forEach((tag) => {
          if (TAG_ALLOWLIST.has(tag)) tags.add(tag);
        });
      }
    }
  }

  return Array.from(tags).slice(0, 8);
}

function getEvidenceSignals(evidence: EvidenceRow[]) {
  let maxScore = 0;
  let maxComments = 0;
  let mostRecent: Date | null = null;
  let sourceType: string | null = null;

  for (const row of evidence) {
    const score =
      Number(row.metrics?.score ?? row.raw_json?.score ?? row.raw_json?.ups ?? 0) || 0;
    const comments =
      Number(row.metrics?.comments ?? row.raw_json?.num_comments ?? 0) || 0;
    maxScore = Math.max(maxScore, score);
    maxComments = Math.max(maxComments, comments);

    const created =
      row.metrics?.created_utc ??
      row.raw_json?.created_utc ??
      row.created_at ??
      null;
    if (created) {
      const createdDate =
        typeof created === 'number'
          ? new Date(created * 1000)
          : new Date(created);
      if (!Number.isNaN(createdDate.getTime())) {
        if (!mostRecent || createdDate > mostRecent) {
          mostRecent = createdDate;
        }
      }
    }
    if (!sourceType && row.source_type) {
      sourceType = row.source_type;
    }
  }

  const now = Date.now();
  const recencyDays = mostRecent
    ? Math.max(0, Math.round((now - mostRecent.getTime()) / (1000 * 60 * 60 * 24)))
    : null;
  const engagementScore = maxScore + maxComments * 2;

  return {
    maxScore,
    maxComments,
    recencyDays,
    engagementScore,
    sourceType,
  };
}

function computeStatusAndScore(signals: ReturnType<typeof getEvidenceSignals>) {
  const recencyDays = signals.recencyDays ?? 999;
  const engagement = signals.engagementScore;

  let status = 'Stable';
  if (recencyDays <= 2 && engagement >= 80) {
    status = 'Exploding';
  } else if (recencyDays <= 7 && engagement >= 30) {
    status = 'Growing';
  } else if (recencyDays > 30 && engagement < 10) {
    status = 'Falling';
  }

  const normalized = Math.min(1, engagement / 200);
  let score = 5 * normalized;
  if (recencyDays <= 2) score += 1;
  else if (recencyDays <= 7) score += 0.5;
  else if (recencyDays > 30) score -= 0.5;
  if (recencyDays > 90) score -= 0.5;
  score = Math.max(0, Math.min(5, Number(score.toFixed(2))));

  return { status, score };
}

function isTransientError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error && err.name === 'TransientError') return true;
  const candidate = [
    err instanceof Error ? err.message : null,
    (err as any)?.stderr,
    (err as any)?.stdout,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join('\n');
  return candidate.includes('TransientError');
}

function getTransientMessage(err: unknown): string {
  const firstLine = (value: string) => {
    const line = value.split('\n').find((entry) => entry.trim()) ?? value;
    return line.trim();
  };
  if (!err) return 'Transient error';
  const stderr = (err as any)?.stderr;
  if (typeof stderr === 'string' && stderr.trim()) return firstLine(stderr);
  const stdout = (err as any)?.stdout;
  if (typeof stdout === 'string' && stdout.trim()) return firstLine(stdout);
  if (err instanceof Error) return firstLine(err.message);
  return String(err);
}

async function requeueJob(jobId: string, message: string) {
  const nextRunAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const logLine = `Transient failure, re-queued job ${jobId} for ${nextRunAt}: ${message}`;

  const { data, error } = await supabase
    .from('admin_jobs')
    .select('log')
    .eq('id', jobId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load admin job log for requeue:', error.message);
  }

  const combinedLog = data?.log ? `${data.log}\n${logLine}` : logLine;
  const updatePayload = compactUpdate({
    status: 'queued',
    next_run_at: nextRunAt,
    locked_at: null,
    locked_by: null,
    updated_at: nowIso,
    finished_at: null,
    error: null,
    log: combinedLog,
  });

  const { error: updateError } = await supabase
    .from('admin_jobs')
    .update(updatePayload)
    .eq('id', jobId);

  if (updateError) {
    console.error('Failed to re-queue admin job:', {
      message: updateError.message,
      keys: Object.keys(updatePayload),
    });
  } else {
    console.log(logLine);
  }
}

async function processJob(job: JobWithStrategy) {
  const jobId = job.id;
  const jobType = job.job_type;
  let log = '';
  try {
    if (jobType === 'idea_enrich') {
      await markJob(jobId, 'running', 'Enriching idea...');
      const payload = (job.payload as any) ?? {};
      const ideaId = payload.idea_id ?? payload.ideaId;
      if (!ideaId || typeof ideaId !== 'string') {
        throw new Error('Missing idea_id in payload');
      }

      const { data: idea, error: ideaError } = await supabase
        .from('ideas')
        .select('*')
        .eq('id', ideaId)
        .single();
      if (ideaError || !idea) {
        throw new Error(`Idea not found: ${ideaId}`);
      }

      const { data: evidence, error: evidenceError } = await supabase
        .from('idea_evidence')
        .select('*')
        .eq('idea_id', ideaId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (evidenceError) {
        throw new Error(`Failed to load evidence for ${ideaId}: ${evidenceError.message}`);
      }

      const result = await ideaEnrich({
        idea,
        evidence: evidence ?? [],
      });

      const patch: Record<string, unknown> = {
        tags: result.tags,
        score_overall: result.score_overall,
        score_detail: result.score_detail,
        enriched_at: new Date().toISOString(),
      };
      if (idea.status !== 'published') {
        patch.status = 'draft';
      }

      const { error: updateError } = await supabase
        .from('ideas')
        .update(patch)
        .eq('id', ideaId);
      if (updateError) {
        throw new Error(`Failed to update idea ${ideaId}: ${updateError.message}`);
      }

      const summary = `idea_enrich ok: tags=${result.tags.length} score=${result.score_overall}`;
      log = job.log ? `${job.log}\n${summary}` : summary;
      await markJob(jobId, 'success', log, undefined, undefined);
      return;
    }

    if (jobType === 'process-trends-snapshot') {
      const snapshotId = (job.payload as any)?.snapshot_id;
      if (!snapshotId) {
        throw new Error('Missing snapshot_id in payload');
      }
      log = 'Processing trends snapshot...';
      await markJob(jobId, 'running', log);
      await processSingleTrendsSnapshot(Number(snapshotId));
      log = `Processed trends snapshot ${snapshotId}`;
      await markJob(jobId, 'success', log);
      return;
    }

    let strategy: StrategyRow | null = null;
    if (job.strategy_id) {
      strategy = await loadStrategy(job.strategy_id);
      if (!strategy || strategy.is_active === false) {
        throw new Error('Strategy not found or inactive');
      }
    }

    const payload = (job.payload as any) ?? {};
    let commandLog = 'Running job...';
    await markJob(jobId, 'running', commandLog);

    let commandType: AdminJobType | string;
    if (strategy && strategy.source === 'reddit') {
      commandType = 'reddit-ingest';
    } else if (strategy && strategy.source === 'youtube') {
      commandType = 'youtube-ingest';
    } else if (strategy && strategy.source === 'google_trends') {
      commandType = 'trends-ingest';
    } else {
      commandType = jobType;
    }

    try {
      commandLog = await runCommand(
        jobId,
        commandType,
        strategy,
        payload,
        job.created_by ?? null,
      );
    } catch (err) {
      const isTrendsCommand =
        commandType === 'trends-ingest' || commandType === 'google-trends-ingest';
      if (isTrendsCommand && isTransientError(err)) {
        await requeueJob(jobId, getTransientMessage(err));
        return;
      }
      throw err;
    }

    if (strategy) {
      commandLog = `Using strategy ${strategy.id} (${strategy.name ?? ''})\n${commandLog}`;
    }

    await markJob(jobId, 'success', commandLog);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log += `\nError: ${message}`;
    await markJob(jobId, 'error', log, message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const maxFlag = args.find((a) => a.startsWith('--max='));
  const maxJobs = maxFlag ? parseInt(maxFlag.split('=')[1], 10) || 3 : 3;
  const worker = `local-${Date.now()}`;
  let processed = 0;
  let idleLoops = 0;
  let lastIdleKey = '';

  console.log(`Job runner started. worker=${worker}, max=${maxJobs}`);
  await printQueuedSummary();

  while (processed < maxJobs) {
    const job = await claimJob(worker);
    if (!job) {
      idleLoops += 1;
      const { readyCount, runningCount, nextFuture } = await getIdleDiagnostics();
      const idleKey = `${readyCount}|${runningCount}|${nextFuture ?? 'null'}`;
      if (idleLoops % 10 === 0 || idleKey !== lastIdleKey) {
        console.log(
          `Idle: readyQueued=${readyCount} running=${runningCount} nextFuture=${nextFuture ?? 'null'} pollMs=${POLL_MS}`,
        );
        lastIdleKey = idleKey;
      }
      await sleep(POLL_MS);
      continue;
    }
    console.log(`Claimed job ${job.id} (${job.job_type})`);
    const ideaIds = extractIdeaIds(job.payload ?? null);
    if (ideaIds.length > 0) {
      await Promise.all(
        ideaIds.map(async (ideaId) => {
          try {
            await linkJobToIdea(job.id, ideaId, 'target');
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`Failed to link job ${job.id} to idea ${ideaId}: ${message}`);
          }
        }),
      );
    }
    await processJob(job);
    processed += 1;
    idleLoops = 0;
  }

  console.log('Job runner finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
