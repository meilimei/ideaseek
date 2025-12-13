import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

ensureEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEEPSEEK_API_KEY']);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY!,
});

type TrendRow = {
  id: string;
  trend_key?: string | null;
  slug?: string | null;
  title: string | null;
  keyword: string | null;
  source?: string | null;
  source_primary: string | null;
  geo: string | null;
  timeframe: string | null;
  growth_pct: number | null;
  latest_value: number | null;
  peak_value: number | null;
  avg_value: number | null;
  tags: string[] | null;
  score: number | null;
  summary: string | null;
  status: string | null;
};

type EnrichmentResult = {
  tags?: string[];
  score?: number;
  summary?: string;
  status?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadTrendsToEnrich(limit = 20): Promise<TrendRow[]> {
  const { data, error } = await supabase
    .from('trends')
    .select(
      'id, trend_key, slug, title, keyword, source, source_primary, geo, timeframe, latest_value, peak_value, avg_value, growth_pct, tags, score, summary, status',
    )
    .order('updated_at', { ascending: false, nullsFirst: true })
    .limit(limit);

  if (error) throw error;
  const rows = (data ?? []) as TrendRow[];
  return rows.filter((row) => {
    const tagsMissing = !row.tags || row.tags.length === 0;
    const scoreMissing = row.score == null;
    const summaryMissing = !row.summary || row.summary.trim() === '';
    const statusMissing = !row.status || row.status.trim() === '';
    return tagsMissing || scoreMissing || summaryMissing || statusMissing;
  });
}

function buildPrompt(trend: TrendRow): string {
  const name = trend.title || trend.keyword || '(untitled)';
  const growthPct =
    trend.growth_pct == null ? 'unknown' : `${(trend.growth_pct * 100).toFixed(1)}%`;
  const interest = trend.latest_value == null ? 'unknown' : `${trend.latest_value}`;

  return `
You are an analyst enriching trend metadata. Use only the provided data and do NOT fabricate numeric metrics.

Trend:
- Name: ${name}
- Source: ${trend.source_primary ?? trend.source ?? 'unknown'}
- Geo: ${trend.geo ?? 'unknown'}
- Timeframe: ${trend.timeframe ?? 'unknown'}
- Growth pct: ${growthPct}
- Latest interest/value: ${interest}

Output strict JSON with this shape:
{
  "tags": ["short tag 1", "short tag 2", "short tag 3"],
  "score": 0.0,
  "summary": "1-2 sentences in English"
}

Rules:
- Tags: 3-6 concise English tags, no emojis.
- Score: 0.0 - 5.0 with one decimal; qualitative only, do not fabricate other metrics.
- Keep content English only. Return ONLY JSON.
`;
}

function sanitizeEnrichment(raw: unknown): EnrichmentResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const tags = Array.isArray(obj.tags)
    ? obj.tags
        .map((t) => (typeof t === 'string' ? t.trim() : null))
        .filter((t): t is string => Boolean(t))
        .slice(0, 6)
    : undefined;

  const score =
    typeof obj.score === 'number' && Number.isFinite(obj.score)
      ? Math.max(0, Math.min(5, Number(obj.score.toFixed(1))))
      : undefined;

  const summary =
    typeof obj.summary === 'string' && obj.summary.trim() ? obj.summary.trim() : undefined;

  const statusRaw = typeof obj.status === 'string' ? obj.status.trim() : '';
  const allowedStatus = ['Exploding', 'Growing', 'Stable', 'Declining'];
  const status = allowedStatus.includes(statusRaw) ? statusRaw : undefined;

  const result: EnrichmentResult = {};
  if (tags && tags.length > 0) result.tags = tags;
  if (typeof score === 'number' && Number.isFinite(score)) result.score = score;
  if (summary) result.summary = summary;
  if (status) result.status = status;

  if (!result.tags && result.score == null && !result.summary && !result.status) {
    return null;
  }

  return result;
}

async function generateEnrichment(trend: TrendRow): Promise<EnrichmentResult | null> {
  const prompt = buildPrompt(trend);

  const completion = await deepseek.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: 'You are a precise JSON generator that outputs only valid JSON objects.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
    max_tokens: 600,
  });

  const content = completion.choices[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(content) as unknown;
    return sanitizeEnrichment(parsed);
  } catch (err) {
    console.error(`Failed to parse DeepSeek JSON for trend ${trend.slug ?? trend.id}:`, err);
    return null;
  }
}

function determineStatus(trend: TrendRow): string | undefined {
  if (typeof trend.growth_pct === 'number' && Number.isFinite(trend.growth_pct)) {
    const pct = trend.growth_pct * 100;
    if (pct >= 200) return 'Exploding';
    if (pct >= 50) return 'Growing';
    if (pct <= -20) return 'Declining';
    return 'Stable';
  }
  return undefined;
}

async function updateTrend(
  trend: TrendRow,
  enrichment: EnrichmentResult,
  deterministicStatus?: string,
): Promise<boolean> {
  const payload: Record<string, unknown> = {
    enriched_at: new Date().toISOString(),
  };

  if ((!trend.tags || trend.tags.length === 0) && enrichment.tags && enrichment.tags.length > 0) {
    payload.tags = enrichment.tags;
  }

  if (trend.score == null && typeof enrichment.score === 'number') {
    payload.score = enrichment.score;
  }

  if (!trend.summary || trend.summary.trim() === '') {
    if (enrichment.summary) {
      payload.summary = enrichment.summary;
    }
  }

  if (!trend.status || trend.status.trim() === '') {
    const statusToUse = deterministicStatus ?? enrichment.status ?? 'Stable';
    payload.status = statusToUse;
  }

  if (Object.keys(payload).length <= 1) return false; // only enriched_at present

  const { error } = await supabase
    .from('trends')
    .update(payload)
    .eq('id', trend.id);

  if (error) {
    throw new Error(`Failed to update trend ${trend.id}: ${error.message}`);
  }
  return true;
}

async function main() {
  console.log('--- Enrich trends with DeepSeek ---');

  const trends = await loadTrendsToEnrich(20);
  console.log(`Loaded ${trends.length} trend(s) needing enrichment.`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const trend of trends) {
    processed += 1;
    const deterministicStatus = determineStatus(trend);

    // No need to call model if everything already present (defensive)
    const needsTags = !trend.tags || trend.tags.length === 0;
    const needsScore = trend.score == null;
    const needsSummary = !trend.summary || trend.summary.trim() === '';
    const needsStatus = !trend.status || trend.status.trim() === '';
    const onlyNeedsStatus = !needsTags && !needsScore && !needsSummary && needsStatus;

    if (onlyNeedsStatus) {
      const updatedStatus = await updateTrend(trend, {}, deterministicStatus);
      if (updatedStatus) {
        console.log(
          `[${trend.id}] Set status to ${deterministicStatus ?? 'Stable'} (${deterministicStatus ? 'deterministic' : 'default'})`,
        );
        updated += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (!needsTags && !needsScore && !needsSummary && !needsStatus) {
      skipped += 1;
      continue;
    }

    let attempt = 0;
    const maxAttempts = 3;
    let updatedThis = false;
    while (attempt < maxAttempts) {
      try {
        attempt += 1;
        console.log(
          `[${trend.id}] Enriching "${trend.title || trend.keyword || trend.id}" (attempt ${attempt}/${maxAttempts})`,
        );
        const enrichment = await generateEnrichment(trend);
        if (!enrichment) {
          throw new Error('No enrichment produced');
        }
        const statusUsed = deterministicStatus ?? enrichment.status ?? 'Stable';
        updatedThis = await updateTrend(trend, enrichment, deterministicStatus);
        console.log(
          `[${trend.id}] Updated: tags=${enrichment.tags?.length ?? 0}, score=${enrichment.score ?? '—'}, summary=${enrichment.summary ? 'yes' : 'no'}, status=${statusUsed}`,
        );
        break;
      } catch (err) {
        const isLast = attempt >= maxAttempts;
        console.error(
          `[${trend.id}] Enrichment error:`,
          err instanceof Error ? err.message : String(err),
        );
        if (isLast) {
          console.error(`[${trend.id}] Giving up after ${attempt} attempts.`);
        } else {
          await sleep(500 * 2 ** (attempt - 1));
        }
      }
    }
    if (updatedThis) {
      updated += 1;
    } else {
      skipped += 1;
    }
    await sleep(200);
  }

  console.log(
    `Done enriching trends. Processed=${processed}, Updated=${updated}, Skipped=${skipped}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
