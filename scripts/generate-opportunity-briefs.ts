import OpenAI from 'openai';
import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';

type ClusterRow = {
  id: string;
  gate_passed: boolean;
  updated_at: string | null;
  last_seen_at: string | null;
  evidence: Array<{
    quote?: string | null;
    url?: string | null;
    author?: string | null;
    created_at?: string | null;
  }> | null;
  signal_count?: number | null;
  last_30d_signal_count?: number | null;
  paid_intent_score?: number | null;
  buyer_clarity_score?: number | null;
  reachability_score?: number | null;
  score_total?: number | null;
};

type BriefRow = {
  cluster_id: string;
  updated_at: string | null;
};

type BriefOutput = {
  title: string;
  one_liner: string;
  markdown: string;
  brief: Record<string, unknown>;
};

const MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
});

const PROMPT_VERSION = 'v1';

function shouldRefresh(cluster: ClusterRow, brief: BriefRow | null) {
  if (!brief) return true;
  if (!cluster.updated_at) return false;
  if (!brief.updated_at) return true;
  return new Date(cluster.updated_at) > new Date(brief.updated_at);
}

async function fetchClusters(): Promise<ClusterRow[]> {
  const { data, error } = await supabase
    .from('signal_clusters')
    .select(
      'id, gate_passed, updated_at, last_seen_at, evidence, signal_count, last_30d_signal_count, paid_intent_score, buyer_clarity_score, reachability_score, score_total',
    )
    .eq('gate_passed', true);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClusterRow[];
}

async function fetchBriefMap(): Promise<Map<string, BriefRow>> {
  const { data, error } = await supabase
    .from('opportunity_briefs')
    .select('cluster_id, updated_at');
  if (error) throw new Error(error.message);
  const map = new Map<string, BriefRow>();
  for (const row of data ?? []) {
    map.set(row.cluster_id, row as BriefRow);
  }
  return map;
}

function buildPrompt(cluster: ClusterRow) {
  const evidence = (cluster.evidence ?? []).slice(0, 5);
  const payload = {
    stats: {
      signal_count: cluster.signal_count ?? 0,
      last_30d_signal_count: cluster.last_30d_signal_count ?? 0,
      paid_intent_score: cluster.paid_intent_score ?? 0,
      buyer_clarity_score: cluster.buyer_clarity_score ?? 0,
      reachability_score: cluster.reachability_score ?? 0,
      score_total: cluster.score_total ?? 0,
      last_seen_at: cluster.last_seen_at,
    },
    evidence,
  };

  return `
You are an opportunity analyst. Read the cluster signals and produce a concise brief.

Data (JSON):
${JSON.stringify(payload, null, 2)}

Return ONLY valid JSON with this schema:
{
  "title": "Concise opportunity title",
  "one_liner": "1-sentence value prop",
  "markdown": "# Opportunity\\n... (short sections: Problem, Alternatives, Why pay, Wedge, 2-week MVP, Acquisition channels, Validation script)",
  "brief": {
    "problem": "...",
    "alternatives": ["..."],
    "why_pay": "...",
    "wedge": "...",
    "two_week_mvp": ["step1", "step2"],
    "acquisition": ["channel1", "channel2"],
    "validation_script": ["question1", "question2"]
  }
}

Rules:
- Keep markdown short and skimmable.
- Use evidence quotes lightly; do not paste full quotes.
- If data is thin, be conservative.
- Output ONLY JSON, no extra text.`;
}

async function generateBrief(cluster: ClusterRow): Promise<BriefOutput | null> {
  const prompt = buildPrompt(cluster);
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a precise JSON generator.' },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 800,
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

async function main() {
  if (!process.env.DEEPSEEK_API_KEY) {
    console.warn('Missing DEEPSEEK_API_KEY; aborting briefs generation.');
    return;
  }

  const clusters = await fetchClusters();
  const briefMap = await fetchBriefMap();
  let generated = 0;
  let skipped = 0;

  for (const cluster of clusters) {
    const existing = briefMap.get(cluster.id) ?? null;
    if (!shouldRefresh(cluster, existing)) {
      skipped += 1;
      continue;
    }
    const output = await generateBrief(cluster);
    if (!output) {
      console.warn(`Skipping cluster ${cluster.id} due to invalid model output.`);
      continue;
    }
    await upsertBrief(cluster.id, output);
    generated += 1;
    console.log(`[brief] cluster=${cluster.id} title="${output.title}"`);
  }

  console.log(`[brief] generated=${generated} skipped=${skipped}`);
}

main().catch((err) => {
  console.error('generate-opportunity-briefs failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
