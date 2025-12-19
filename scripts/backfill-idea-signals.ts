import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeIdeaSignals } from '../lib/server/ideaSignals';

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

type IdeaRow = {
  id: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  demand_strength: string | null;
  market_size: string | null;
  difficulty: number | null;
  source_type: string | null;
};

const BATCH_SIZE = 50;

async function loadBatch(offset: number, limit: number): Promise<IdeaRow[]> {
  const { data, error } = await supabase
    .from('ideas')
    .select(
      'id, title, one_liner, description, tags, demand_strength, market_size, difficulty, source_type',
    )
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) {
    throw new Error(`Failed to load ideas batch: ${error.message}`);
  }
  return (data ?? []) as IdeaRow[];
}

async function updateIdea(row: IdeaRow) {
  const signals = computeIdeaSignals({
    title: row.title,
    one_liner: row.one_liner,
    description: row.description,
    tags: row.tags,
    demand_strength: row.demand_strength,
    market_size: row.market_size,
    difficulty: row.difficulty,
    source_type: row.source_type,
  });

  const mergedTags =
    row.tags && row.tags.length > 0
      ? Array.from(new Set([...(row.tags ?? []), ...signals.tags])).slice(0, 3)
      : signals.tags;

  const { error } = await supabase
    .from('ideas')
    .update({
      tags: mergedTags,
      score: signals.score,
      status: signals.status,
      status_reason: signals.status_reason,
      keywords: signals.keywords,
      updated_at: new Date().toISOString(),
    })
    .eq('id', row.id);

  if (error) {
    throw new Error(`Failed to update idea ${row.id}: ${error.message}`);
  }
}

async function main() {
  console.log('--- Backfill idea signals (tags/score/status/keywords) ---');
  const { count, error: countError } = await supabase
    .from('ideas')
    .select('id', { count: 'exact', head: true });
  if (countError) throw countError;
  const total = count ?? 0;
  console.log(`Total ideas: ${total}`);

  let offset = 0;
  let processed = 0;

  while (true) {
    const batch = await loadBatch(offset, BATCH_SIZE);
    if (batch.length === 0) break;

    for (const row of batch) {
      try {
        await updateIdea(row);
        processed += 1;
        if (processed % 50 === 0) {
          console.log(`Updated ${processed}/${total} ideas...`);
        }
      } catch (err) {
        console.error(
          `Failed to backfill idea ${row.id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    offset += batch.length;
  }

  console.log(`Backfill complete. Updated ${processed} ideas.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
