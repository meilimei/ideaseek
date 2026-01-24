import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';
import { embedText } from '@/lib/embeddings';

type ClusterRequest = {
  signalIds?: string[];
  ownerId?: string;
  userId?: string;
  createdBy?: string;
  visibility?: string;
  payload?: Record<string, unknown> | null;
  config?: Record<string, unknown> | null;
  strategy?: { config?: Record<string, unknown> | null } | null;
  strategyConfig?: Record<string, unknown> | null;
};

type SignalRow = {
  id: string;
  embedding: number[] | null;
  url?: string | null;
  author?: string | null;
  content?: string | null;
  signal_created_at?: string | null;
  source?: string | null;
  meta?: Record<string, unknown> | null;
};

type ClusterRow = {
  id: string;
  centroid: number[] | null;
  signal_count: number | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  meta?: Record<string, any> | null;
};

type MemberRow = {
  similarity: number;
  signals: {
    id: string;
    content: string | null;
    url: string | null;
    author: string | null;
    signal_created_at: string | null;
  };
};

type BriefOutput = {
  title: string;
  one_liner: string;
  markdown: string;
  brief: Record<string, unknown>;
};

const EXPECTED_DIM = Math.max(1, Number(process.env.OUTPUT_DIMENSION ?? 1024));
const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const PROMPT_VERSION = 'api-v1';
const ROLLING_WINDOW_DAYS = Math.max(
  1,
  Number(process.env.CLUSTER_ROLLING_WINDOW_DAYS ?? 30),
);
const MIN_ROLLING_SIGNALS = Math.max(
  1,
  Number(process.env.CLUSTER_ROLLING_MIN_SIGNALS ?? 20),
);
const MIN_SIGNAL_COUNT = Math.max(
  1,
  Number(process.env.CLUSTER_MIN_SIGNAL_COUNT ?? 20),
);
const MIN_UNIQUE_AUTHORS = Math.max(
  1,
  Number(process.env.CLUSTER_MIN_UNIQUE_AUTHORS ?? 20),
);
const MIN_MONETIZATION_MATCHES = Math.max(
  1,
  Number(process.env.CLUSTER_MIN_MONETIZATION_MATCHES ?? 2),
);
const MIN_PERSONA_MATCHES = Math.max(
  1,
  Number(process.env.CLUSTER_MIN_PERSONA_MATCHES ?? 2),
);
const MIN_COMMUNITIES = Math.max(
  1,
  Number(process.env.CLUSTER_MIN_COMMUNITIES ?? 2),
);
const GATING_SAMPLE_LIMIT = Math.max(
  MIN_SIGNAL_COUNT,
  Number(process.env.CLUSTER_GATING_SAMPLE_LIMIT ?? 120),
);

const MONETIZATION_TERMS = [
  'pricing',
  'price',
  'cost',
  'expensive',
  'cheap',
  'cheaper',
  'subscription',
  'license',
  'fee',
  'paid',
  'premium',
  'freemium',
  'trial',
  'budget',
  'affordable',
  'pay',
  'paying',
  'charge',
  'buy',
  'purchase',
  'revenue',
  'profit',
  'margin',
  'roi',
  'loss',
  'lost revenue',
  'lost sales',
  'missed revenue',
  'missed sales',
  'losing money',
  'churn',
  'refund',
  'chargeback',
  'bleeding',
  'downtime cost',
  'overpay',
  'overpaid',
  'overpaying',
];
const COMPETITOR_TERMS = [
  'we use',
  'using',
  'switch',
  'switching',
  'replace',
  'alternative to',
  'better than',
  'competing',
  'incumbent',
  'existing solution',
  'competitor',
  'migration',
  'rip and replace',
];
const PERSONA_TERMS = [
  'buyer',
  'customer',
  'client',
  'subscriber',
  'founder',
  'owner',
  'operator',
  'manager',
  'director',
  'lead',
  'marketer',
  'marketing',
  'sales',
  'sales ops',
  'recruiter',
  'hr',
  'people ops',
  'designer',
  'developer',
  'engineer',
  'cto',
  'cmo',
  'cfo',
  'product',
  'finance',
  'accountant',
  'consultant',
  'agency',
  'teacher',
  'student',
  'doctor',
  'therapist',
  'lawyer',
  'coach',
  'freelancer',
  'creator',
  'founder-led',
  'operations',
  'ops',
  'smb',
  'enterprise',
  'small business',
  'ecommerce',
  'merchant',
];
const moneyRegex = /(\$|usd|eur|gbp)\s?\d+/i;

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVisibility(value: unknown): 'public' | 'private' | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'private') return 'private';
  if (normalized === 'public') return 'public';
  return null;
}

function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let an = 0;
  let bn = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    an += a[i]! * a[i]!;
    bn += b[i]! * b[i]!;
  }
  if (an === 0 || bn === 0) return 0;
  return dot / Math.sqrt(an * bn);
}

function avgCentroid(prev: number[], count: number, next: number[]) {
  if (prev.length !== next.length) return prev;
  const updated: number[] = [];
  const total = count + 1;
  for (let i = 0; i < prev.length; i += 1) {
    updated.push((prev[i]! * count + next[i]!) / total);
  }
  return updated;
}

function normalizeEmbedding(vector: number[]) {
  if (vector.length === EXPECTED_DIM) return vector;
  if (vector.length > EXPECTED_DIM) return vector.slice(0, EXPECTED_DIM);
  return vector.concat(new Array(EXPECTED_DIM - vector.length).fill(0));
}

function getRollingWindowStartIso(days: number) {
  const millis = days * 24 * 60 * 60 * 1000;
  return new Date(Date.now() - millis).toISOString();
}

async function fetchClusters(): Promise<ClusterRow[]> {
  const { data, error } = await supabase
    .from('signal_clusters')
    .select('id, centroid, signal_count, first_seen_at, last_seen_at, meta')
    .contains('meta', { type: 'need' });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClusterRow[];
}

async function countRollingSignals(windowStart: string): Promise<number> {
  const { count, error } = await supabase
    .from('signals')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'reddit')
    .not('signal_created_at', 'is', null)
    .gte('signal_created_at', windowStart);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function fetchSignalsByIds(ids: string[], windowStart?: string): Promise<SignalRow[]> {
  if (ids.length === 0) return [];
  let query = supabase
    .from('signals')
    .select('id, embedding, url, author, content, signal_created_at, source, meta')
    .in('id', ids)
    .eq('source', 'reddit');
  if (windowStart) {
    query = query.not('signal_created_at', 'is', null).gte('signal_created_at', windowStart);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SignalRow[];
}

async function fetchClusterSignals(
  clusterId: string,
  limit: number,
  windowStart?: string,
): Promise<SignalRow[]> {
  let query = supabase
    .from('signal_cluster_members')
    .select('signals(id, url, author, content, signal_created_at, source)')
    .eq('cluster_id', clusterId)
    .order('similarity', { ascending: false })
    .limit(limit);
  if (windowStart) {
    query = query
      .not('signals.signal_created_at', 'is', null)
      .gte('signals.signal_created_at', windowStart);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{ signals: SignalRow | null }>;
  return rows.map((row) => row.signals).filter(Boolean) as SignalRow[];
}

async function fetchNextSignals(
  limit: number,
  offset: number,
  windowStart?: string,
): Promise<SignalRow[]> {
  let query = supabase
    .from('signals')
    .select('id, embedding, url, author, content, signal_created_at, source, meta')
    .eq('source', 'reddit')
    .not('embedding', 'is', null)
    .order('signal_created_at', { ascending: true, nullsLast: true })
    .range(offset, offset + limit - 1);
  if (windowStart) {
    query = query.not('signal_created_at', 'is', null).gte('signal_created_at', windowStart);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SignalRow[];
}

async function filterUnclustered(signals: SignalRow[]) {
  if (signals.length === 0) return [];
  const ids = signals.map((s) => s.id);
  const { data, error } = await supabase
    .from('signal_cluster_members')
    .select('signal_id')
    .in('signal_id', ids);
  if (error) throw new Error(error.message);
  const clustered = new Set((data ?? []).map((r) => r.signal_id));
  return signals.filter((s) => !clustered.has(s.id));
}

async function insertCluster(
  embedding: number[],
  createdAt: string | null,
  author?: string | null,
  signalId?: string | null,
  options?: { ownerId: string | null; visibility: 'public' | 'private' },
) {
  const ownerId = options?.ownerId ?? null;
  const visibility = options?.visibility ?? 'public';
  const { data, error } = await supabase
    .from('signal_clusters')
    .insert({
      centroid: embedding,
      signal_count: 1,
      first_seen_at: createdAt ?? new Date().toISOString(),
      last_seen_at: createdAt ?? new Date().toISOString(),
      owner_id: ownerId,
      visibility,
      meta: {
        type: 'need',
        source: 'reddit',
        ...(author ? { authors: [author] } : {}),
        ...(signalId ? { signal_ids: [signalId] } : {}),
      },
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string;
}

async function updateClusterStats(
  cluster: ClusterRow,
  embedding: number[],
  createdAt: string | null,
  author?: string | null,
  signalId?: string | null,
) {
  const count = Number(cluster.signal_count ?? 0);
  const centroid = cluster.centroid ?? embedding;
  const newCentroid = avgCentroid(centroid, count, embedding);
  const firstSeen = cluster.first_seen_at
    ? new Date(cluster.first_seen_at) < new Date(createdAt ?? '') && cluster.first_seen_at
      ? cluster.first_seen_at
      : createdAt ?? cluster.first_seen_at
    : createdAt ?? new Date().toISOString();
  const lastSeen =
    !cluster.last_seen_at || (createdAt && new Date(createdAt) > new Date(cluster.last_seen_at))
      ? createdAt ?? cluster.last_seen_at ?? new Date().toISOString()
      : cluster.last_seen_at;

  const meta = { ...(cluster.meta ?? {}) };
  meta.type = meta.type ?? 'need';
  meta.source = meta.source ?? 'reddit';
  const authors: string[] = Array.isArray(meta.authors) ? meta.authors : [];
  if (author && !authors.includes(author)) authors.push(author);
  meta.authors = authors;
  const signalIds: string[] = Array.isArray(meta.signal_ids) ? meta.signal_ids : [];
  if (signalId && !signalIds.includes(signalId)) {
    signalIds.push(signalId);
    if (signalIds.length > 25) signalIds.shift();
  }
  meta.signal_ids = signalIds;

  const { error } = await supabase
    .from('signal_clusters')
    .update({
      centroid: newCentroid,
      signal_count: count + 1,
      first_seen_at: firstSeen,
      last_seen_at: lastSeen,
      meta,
    })
    .eq('id', cluster.id);
  if (error) throw new Error(error.message);

  cluster.centroid = newCentroid;
  cluster.signal_count = count + 1;
  cluster.first_seen_at = firstSeen;
  cluster.last_seen_at = lastSeen;
  cluster.meta = meta;
}

async function insertMember(signalId: string, clusterId: string, similarity: number) {
  const { error } = await supabase
    .from('signal_cluster_members')
    .insert({ signal_id: signalId, cluster_id: clusterId, similarity });
  if (error) throw new Error(error.message);
}

async function refreshEvidence(clusterId: string, windowStart?: string) {
  let query = supabase
    .from('signal_cluster_members')
    .select('similarity, signals(id, content, url, author, signal_created_at)')
    .eq('cluster_id', clusterId)
    .order('similarity', { ascending: false })
    .limit(5);
  if (windowStart) {
    query = query
      .not('signals.signal_created_at', 'is', null)
      .gte('signals.signal_created_at', windowStart);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const members = (data ?? []) as MemberRow[];
  const evidence = members
    .map((row) => row.signals)
    .filter(Boolean)
    .map((m) => ({
      quote: m.content,
      url: m.url,
      author: m.author,
      created_at: m.signal_created_at,
    }));

  const authors = Array.from(
    new Set(
      members
        .map((m) => m.signals?.author)
        .filter((a): a is string => typeof a === 'string' && a.length > 0),
    ),
  );

  const { data: clusterRow, error: clusterError } = await supabase
    .from('signal_clusters')
    .select('meta')
    .eq('id', clusterId)
    .maybeSingle();
  if (clusterError) throw new Error(clusterError.message);
  const baseMeta =
    clusterRow && typeof clusterRow.meta === 'object' && clusterRow.meta
      ? (clusterRow.meta as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from('signal_clusters')
    .update({
      evidence,
      meta: {
        ...baseMeta,
        type: 'need',
        source: 'reddit',
        authors,
        unique_authors: authors.length,
      },
    })
    .eq('id', clusterId);
  if (updateError) throw new Error(updateError.message);
}

function extractSubreddit(url?: string | null) {
  if (!url) return null;
  const match = url.match(/\/r\/([^/]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function hasTerm(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function evaluateGating(signals: SignalRow[]) {
  const authors = new Set<string>();
  const communities = new Set<string>();
  let monetizationMatches = 0;
  let personaMatches = 0;

  for (const signal of signals) {
    const author = signal.author?.trim().toLowerCase();
    if (author) authors.add(author);
    const text = (signal.content ?? '').toLowerCase();
    const hasMoney =
      moneyRegex.test(text) ||
      hasTerm(text, MONETIZATION_TERMS) ||
      hasTerm(text, COMPETITOR_TERMS);
    const hasPersona = hasTerm(text, PERSONA_TERMS);
    if (hasMoney) monetizationMatches += 1;
    if (hasPersona) personaMatches += 1;
    const subreddit = extractSubreddit(signal.url);
    if (subreddit) communities.add(subreddit);
  }

  const signalCount = signals.length;
  const pass =
    signalCount >= MIN_SIGNAL_COUNT &&
    authors.size >= MIN_UNIQUE_AUTHORS &&
    monetizationMatches >= MIN_MONETIZATION_MATCHES &&
    personaMatches >= MIN_PERSONA_MATCHES &&
    communities.size >= MIN_COMMUNITIES;

  return {
    pass,
    signalCount,
    authors: authors.size,
    monetizationMatches,
    personaMatches,
    communities: communities.size,
  };
}

function buildPrompt(cluster: {
  signal_count?: number | null;
  last_seen_at?: string | null;
  evidence?: Array<Record<string, unknown>> | null;
}) {
  const payload = {
    stats: {
      signal_count: cluster.signal_count ?? 0,
      last_seen_at: cluster.last_seen_at ?? null,
    },
    evidence: (cluster.evidence ?? []).slice(0, 5),
  };

  return `
You are an opportunity analyst. Given Reddit signals for a recurring pain point, create a concise opportunity brief.

Data (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON with this schema:
{
  "title": "Concise opportunity title",
  "one_liner": "1-sentence value prop",
  "markdown": "# Opportunity\\n... (short sections: Problem, Personas, Alternatives, Monetization, Wedge, MVP, Channels, Validation, Evidence)",
  "brief": {
    "problem_definition": {
      "who": "...",
      "task": "...",
      "obstacle": "..."
    },
    "pain_points": ["..."],
    "personas": ["Persona 1", "Persona 2", "Persona 3"],
    "existing_solutions": ["..."],
    "monetization_reasons": ["..."],
    "wedge": "...",
    "mvp_features": ["..."],
    "channels": ["..."],
    "validation": {
      "interview_questions": ["..."],
      "landing_page_test": "..."
    },
    "evidence": {
      "signal_count": 0,
      "trend_summary": "...",
      "quotes": [
        { "quote": "...", "url": "...", "author": "...", "created_at": "..." }
      ]
    }
  }
}

Rules:
- Use evidence quotes lightly; include 2-5 short quotes with links.
- Provide 2-3 personas.
- Provide 5-8 MVP features.
- Provide 3 acquisition channels.
- Provide 10 interview questions plus one landing page test.
- If data is thin, be conservative.
- Output ONLY JSON, no extra text.`;
}

async function generateBrief(cluster: {
  signal_count?: number | null;
  last_seen_at?: string | null;
  evidence?: Array<Record<string, unknown>> | null;
}): Promise<BriefOutput | null> {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }
  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com',
  });
  const prompt = buildPrompt(cluster);
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a precise JSON generator.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 900,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';
  const trimmed = content.trim().startsWith('```')
    ? content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : content;
  try {
    const parsed = JSON.parse(trimmed);
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      one_liner: typeof parsed.one_liner === 'string' ? parsed.one_liner.trim() : '',
      markdown: typeof parsed.markdown === 'string' ? parsed.markdown.trim() : '',
      brief: typeof parsed.brief === 'object' && parsed.brief ? parsed.brief : {},
    };
  } catch (err) {
    console.error('Failed to parse brief JSON:', err, content);
    return null;
  }
}

async function upsertBrief(clusterId: string, output: BriefOutput) {
  const { error } = await supabase
    .from('opportunity_briefs')
    .upsert(
      {
        cluster_id: clusterId,
        title: output.title,
        one_liner: output.one_liner,
        markdown: output.markdown,
        brief: output.brief,
        model: MODEL,
        prompt_version: PROMPT_VERSION,
      },
      { onConflict: 'cluster_id' },
    );
  if (error) throw new Error(error.message);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: ClusterRequest | null = null;
  try {
    body = (await request.json()) as ClusterRequest;
  } catch {
    body = null;
  }

  const payload = toRecord(body?.payload);
  const payloadConfig = toRecord(payload?.config);
  const config = toRecord(body?.config);
  const strategyConfig =
    toRecord(body?.strategy?.config) ?? toRecord(body?.strategyConfig);
  const ownerId =
    toNonEmptyString(body?.ownerId) ??
    toNonEmptyString(body?.userId) ??
    toNonEmptyString(body?.createdBy) ??
    toNonEmptyString(payload?.ownerId) ??
    toNonEmptyString(payload?.userId) ??
    toNonEmptyString(payload?.user_id) ??
    toNonEmptyString(payload?.created_by) ??
    (process.env.ADMIN_JOB_CREATED_BY?.trim() || null);
  const payloadVisibility =
    normalizeVisibility(body?.visibility) ??
    normalizeVisibility(payload?.visibility) ??
    normalizeVisibility(payload?.opportunity_visibility) ??
    normalizeVisibility(payload?.opportunities_visibility);
  const configVisibility =
    normalizeVisibility(config?.visibility) ??
    normalizeVisibility(strategyConfig?.visibility) ??
    normalizeVisibility(payloadConfig?.visibility);
  const baseVisibility = payloadVisibility ?? configVisibility ?? 'public';
  const visibility = ownerId ? baseVisibility : 'public';
  // signal_clusters own visibility/ownership; opportunity_briefs inherit via cluster_id.
  console.log(`[clusters] owner_id=${ownerId ?? 'none'} visibility=${visibility}`);

  const rawIds = Array.isArray(body?.signalIds)
    ? body?.signalIds?.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  const threshold = Number(process.env.CLUSTER_SIM_THRESHOLD || 0.86);
  const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 50));
  const windowStart = getRollingWindowStartIso(ROLLING_WINDOW_DAYS);

  const rollingCount = await countRollingSignals(windowStart);
  if (rollingCount < MIN_ROLLING_SIGNALS) {
    console.log(
      `[cluster] skip: rolling signals ${rollingCount} < min ${MIN_ROLLING_SIGNALS}`,
    );
    return NextResponse.json({ ok: true, clusters: [] });
  }

  const clusters = await fetchClusters();
  const touched = new Set<string>();

  async function processSignals(signals: SignalRow[]) {
    for (const signal of signals) {
      let embedding = signal.embedding;
      if (!embedding || embedding.length === 0) {
        const content = signal.content?.trim() ?? '';
        if (content) {
          const result = await embedText(content);
          if (result?.embedding) {
            embedding = normalizeEmbedding(result.embedding);
            const nextMeta = { ...(signal.meta ?? {}), provider: result.provider };
            await supabase
              .from('signals')
              .update({
                embedding,
                embedding_model: result.model,
                meta: nextMeta,
              })
              .eq('id', signal.id);
          }
        }
      }
      if (embedding && embedding.length !== EXPECTED_DIM) {
        embedding = normalizeEmbedding(embedding);
      }
      if (!embedding || embedding.length !== EXPECTED_DIM) {
        continue;
      }

      let bestId: string | null = null;
      let bestSim = -1;
      let bestCluster: ClusterRow | null = null;

      for (const cluster of clusters) {
        if (!cluster.centroid || cluster.centroid.length !== EXPECTED_DIM) continue;
        const sim = cosineSimilarity(cluster.centroid, embedding);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = cluster.id;
          bestCluster = cluster;
        }
      }

      if (!bestId || bestSim < threshold) {
        const newId = await insertCluster(
          embedding,
          signal.signal_created_at ?? null,
          signal.author ?? null,
          signal.id,
          { ownerId, visibility },
        );
        clusters.push({
          id: newId,
          centroid: embedding,
          signal_count: 1,
          first_seen_at: signal.signal_created_at ?? null,
          last_seen_at: signal.signal_created_at ?? null,
          meta: signal.author ? { authors: [signal.author] } : {},
        });
        await insertMember(signal.id, newId, 1);
        touched.add(newId);
        continue;
      }

      await updateClusterStats(
        bestCluster!,
        embedding,
        signal.signal_created_at ?? null,
        signal.author ?? null,
        signal.id,
      );
      await insertMember(signal.id, bestId, bestSim);
      touched.add(bestId);
    }
  }

  if (rawIds.length > 0) {
    const signals = await fetchSignalsByIds(rawIds, windowStart);
    const candidates = await filterUnclustered(signals);
    await processSignals(candidates);
  } else {
    let offset = 0;
    while (true) {
      const signals = await fetchNextSignals(batchSize, offset, windowStart);
      if (signals.length === 0) break;
      const candidates = await filterUnclustered(signals);
      await processSignals(candidates);
      if (signals.length < batchSize) break;
      offset += batchSize;
    }
  }

  for (const id of touched) {
    await refreshEvidence(id, windowStart);
  }

  const touchedIds = Array.from(touched);
  if (touchedIds.length === 0) {
    return NextResponse.json({ ok: true, clusters: [] });
  }

  const { data: clusterRows, error } = await supabase
    .from('signal_clusters')
    .select('id, signal_count, last_seen_at, evidence')
    .in('id', touchedIds);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clustersOut: Array<{
    id: string;
    brief: BriefOutput | null;
    signals: SignalRow[];
  }> = [];

  for (const cluster of clusterRows ?? []) {
    const signalList = await fetchClusterSignals(
      cluster.id,
      GATING_SAMPLE_LIMIT,
      windowStart,
    );
    const gating = evaluateGating(signalList);
    console.log(
      `[cluster][gate] id=${cluster.id} signals=${gating.signalCount} authors=${gating.authors} monetization=${gating.monetizationMatches} persona=${gating.personaMatches} communities=${gating.communities} pass=${gating.pass}`,
    );
    if (!gating.pass) {
      continue;
    }
    const brief = await generateBrief(cluster);
    if (brief) {
      await upsertBrief(cluster.id, brief);
    }
    clustersOut.push({
      id: cluster.id,
      brief,
      signals: signalList,
    });
  }

  return NextResponse.json({ ok: true, clusters: clustersOut });
}
