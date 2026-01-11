import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';

type ClusterRow = {
  id: string;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

type MemberRow = {
  similarity: number | null;
  signals: {
    content: string | null;
    signal_created_at: string | null;
    community?: string | null;
    source?: string | null;
  } | null;
};

const HOURS_LOOKBACK = Number(process.env.CLUSTER_SCORE_LOOKBACK_HOURS ?? 24);
const SCORE_GATE = Number(process.env.CLUSTER_SCORE_GATE ?? 0.6);
const TOP_N = Number(process.env.CLUSTER_SCORE_TOP_N ?? 20);

const paidIntentKeywords = {
  pricing: [
    'pricing',
    'cost',
    'expensive',
    'cheapest',
    'subscription',
    'license',
    'fee',
    '$',
    'affordable',
  ],
  paid: [
    'paid',
    'paid version',
    'subscription',
    'premium',
    'free trial',
    'paying customers',
    'freemium',
    'sponsor',
    'support',
    'investment',
    'donation',
    'buy',
  ],
  competition: [
    'we use',
    'replace',
    'alternative to',
    'better than',
    'competing with',
    'incumbent',
    'market leader',
  ],
  dissatisfaction: [
    'too expensive',
    'not worth the price',
    'not affordable',
    'can’t justify cost',
    'cant justify cost',
    'wish it was cheaper',
  ],
  action: [
    'buy',
    'sign up',
    'subscribe',
    'pay for',
    'invest',
    'donate',
    'contract',
    'purchase',
    'checkout',
    'sign-in',
    'paying',
  ],
};

const buyerKeywords = [
  'workflow',
  'process',
  'team',
  'manager',
  'lead',
  'director',
  'founder',
  'cto',
  'cmo',
  'marketing',
  'sales',
  'ops',
  'operations',
  'engineering',
  'product',
  'design',
  'qa',
  'customer support',
  'clients',
  'customers',
  'agency',
  'company',
  'enterprise',
  'startup',
];

const moneyRegex = /(\$|usd|eur|€|£)\s?\d+/i;

function textHits(text: string, keywords: string[]) {
  const lowered = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lowered.includes(kw)) hits += 1;
  }
  if (moneyRegex.test(text)) hits += 1;
  return hits;
}

function scoreFromHits(hits: number, scale = 3) {
  return Math.min(1, hits / scale);
}

const paidIntentList = Array.from(
  new Set(
    Object.values(paidIntentKeywords)
      .flat()
      .map((keyword) => keyword.toLowerCase()),
  ),
);

function paidIntentScore(content: string) {
  if (!content) return 0;
  const lowered = content.toLowerCase();
  let matches = 0;
  for (const keyword of paidIntentList) {
    if (!keyword) continue;
    if (keyword === '$') {
      if (lowered.includes('$')) matches += 1;
      continue;
    }
    if (lowered.includes(keyword)) matches += 1;
  }
  return Math.min(1, matches * 0.2);
}

function computeScores(members: MemberRow[]) {
  const sorted = members
    .filter((m) => m.signals)
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, TOP_N);

  let paidScoreSum = 0;
  let buyerHits = 0;
  let reachSum = 0;

  for (const row of sorted) {
    const content = row.signals?.content ?? '';
    if (content) {
      paidScoreSum += paidIntentScore(content);
      buyerHits += textHits(content, buyerKeywords);
    }
    const hasCommunity = Boolean(row.signals?.community);
    const hasSource = Boolean(row.signals?.source);
    reachSum += hasCommunity || hasSource ? 1 : 0;
  }

  const denom = sorted.length || 1;
  const paid_intent_score = Math.min(1, paidScoreSum / denom);
  const buyer_clarity_score = scoreFromHits(buyerHits / denom, 2);
  const reachability_score = Math.min(1, reachSum / denom);
  const score_total =
    paid_intent_score * 0.5 + buyer_clarity_score * 0.3 + reachability_score * 0.2;
  const gate_passed = score_total >= SCORE_GATE;

  return {
    paid_intent_score,
    buyer_clarity_score,
    reachability_score,
    score_total,
    gate_passed,
  };
}

function isWithin30Days(iso: string | null | undefined) {
  if (!iso) return false;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return false;
  const diff = Date.now() - ts;
  return diff <= 30 * 86400000;
}

async function fetchClusters(): Promise<ClusterRow[]> {
  const now = Date.now();
  const cutoff = now - HOURS_LOOKBACK * 3600 * 1000;
  const cutoffIso = new Date(cutoff).toISOString();
  const { data, error } = await supabase
    .from('signal_clusters')
    .select('id, updated_at, last_seen_at')
    .or(`updated_at.gte.${cutoffIso},last_seen_at.gte.${cutoffIso}`);
  if (error) throw new Error(error.message);
  return (data ?? []) as ClusterRow[];
}

async function fetchMembers(clusterId: string): Promise<MemberRow[]> {
  const { data, error } = await supabase
    .from('signal_cluster_members')
    .select('similarity, signals(content, signal_created_at, community, source)')
    .eq('cluster_id', clusterId);
  if (error) throw new Error(error.message);
  return (data ?? []) as MemberRow[];
}

async function updateClusterScores(
  clusterId: string,
  scores: ReturnType<typeof computeScores>,
  last30dCount: number,
) {
  const { error } = await supabase
    .from('signal_clusters')
    .update({
      last_30d_signal_count: last30dCount,
      paid_intent_score: scores.paid_intent_score,
      buyer_clarity_score: scores.buyer_clarity_score,
      reachability_score: scores.reachability_score,
      score_total: scores.score_total,
      gate_passed: scores.gate_passed,
    })
    .eq('id', clusterId);
  if (error) throw new Error(error.message);
}

async function main() {
  const clusters = await fetchClusters();
  console.log(`[score] evaluating ${clusters.length} clusters`);
  let updated = 0;

  for (const cluster of clusters) {
    const members = await fetchMembers(cluster.id);
    if (members.length === 0) continue;

    const scores = computeScores(members);
    const last30dCount = members.reduce((acc, m) => {
      return acc + (isWithin30Days(m.signals?.signal_created_at ?? null) ? 1 : 0);
    }, 0);

    await updateClusterScores(cluster.id, scores, last30dCount);
    updated += 1;
  }

  console.log(`[score] updated ${updated} clusters`);
}

main().catch((err) => {
  console.error('score-clusters failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
