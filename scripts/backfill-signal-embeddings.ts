import { supabaseServiceClient } from '../lib/supabaseServiceClient';
import { embedText } from '../lib/embeddings';

type SignalRow = {
  id: string;
  content: string | null;
  meta: Record<string, unknown> | null;
};

type ClusterRow = {
  id: string;
};

type ClusterMemberRow = {
  signal_id: string | null;
};

const OUTPUT_DIM = Math.max(1, Number(process.env.OUTPUT_DIMENSION ?? 1024));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeEmbedding(vector: number[]) {
  if (vector.length === OUTPUT_DIM) return vector;
  if (vector.length > OUTPUT_DIM) return vector.slice(0, OUTPUT_DIM);
  return vector.concat(new Array(OUTPUT_DIM - vector.length).fill(0));
}

function averageEmbeddings(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dim = vectors[0]?.length ?? 0;
  if (!dim) return null;
  const sums = new Array(dim).fill(0);
  let count = 0;
  for (const vec of vectors) {
    if (vec.length !== dim) continue;
    for (let i = 0; i < dim; i += 1) {
      sums[i] += vec[i] ?? 0;
    }
    count += 1;
  }
  if (count === 0) return null;
  return sums.map((value) => value / count);
}

async function recomputeClusterCentroids() {
  const { data, error } = await supabaseServiceClient
    .from('signal_clusters')
    .select('id');
  if (error) {
    console.error('Failed to load clusters:', error.message);
    return;
  }

  const clusters = (data ?? []) as ClusterRow[];
  let updated = 0;
  for (const cluster of clusters) {
    const { data: memberRows, error: memberError } = await supabaseServiceClient
      .from('signal_cluster_members')
      .select('signal_id')
      .eq('cluster_id', cluster.id);
    if (memberError) {
      console.warn(`Failed to load members for ${cluster.id}: ${memberError.message}`);
      continue;
    }
    const ids = ((memberRows ?? []) as ClusterMemberRow[])
      .map((row) => row.signal_id)
      .filter((value): value is string => typeof value === 'string');
    if (ids.length === 0) continue;

    const embeddings: number[][] = [];
    const batchSize = 500;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const { data: signals, error: signalError } = await supabaseServiceClient
        .from('signals')
        .select('embedding')
        .in('id', batch);
      if (signalError) {
        console.warn(`Failed to load signals for ${cluster.id}: ${signalError.message}`);
        continue;
      }
      for (const row of signals ?? []) {
        if (Array.isArray(row.embedding)) {
          embeddings.push(row.embedding as number[]);
        }
      }
    }

    const centroid = averageEmbeddings(embeddings);
    if (!centroid) continue;

    const { error: updateError } = await supabaseServiceClient
      .from('signal_clusters')
      .update({ centroid })
      .eq('id', cluster.id);
    if (updateError) {
      console.warn(`Failed to update centroid for ${cluster.id}: ${updateError.message}`);
      continue;
    }
    updated += 1;
  }

  console.log(`[embeddings] refreshed centroids=${updated}`);
}

async function main() {
  const batchSize = Math.max(1, Number(process.env.BATCH_SIZE ?? 50));
  const sleepMs = Math.max(0, Number(process.env.BATCH_SLEEP_MS ?? 400));

  let totalUpdated = 0;
  let totalProcessed = 0;

  while (true) {
    const { data, error } = await supabaseServiceClient
      .from('signals')
      .select('id, content, meta')
      .is('embedding', null)
      .order('created_at', { ascending: true, nullsLast: true })
      .limit(batchSize);

    if (error) {
      console.error('Failed to load signals:', error.message);
      process.exit(1);
    }

    const rows = (data ?? []) as SignalRow[];
    if (rows.length === 0) {
      break;
    }

    let updatedThisBatch = 0;
    for (const row of rows) {
      totalProcessed += 1;
      const content = row.content?.trim() ?? '';
      if (!content) {
        continue;
      }
      const result = await embedText(content);
      if (!result) {
        console.warn('Embeddings provider unavailable. Stopping backfill.');
        return;
      }

      const nextMeta = {
        ...(row.meta ?? {}),
        provider: result.provider,
      };

      const embedding = normalizeEmbedding(result.embedding);
      if (embedding.length !== OUTPUT_DIM) {
        console.warn(
          `Signal ${row.id} embedding dimension mismatch (${embedding.length}), expected ${OUTPUT_DIM}.`,
        );
      }

      const { error: updateError } = await supabaseServiceClient
        .from('signals')
        .update({
          embedding,
          embedding_model: result.model,
          meta: nextMeta,
        })
        .eq('id', row.id);

      if (updateError) {
        console.warn(`Failed to update signal ${row.id}: ${updateError.message}`);
        continue;
      }

      updatedThisBatch += 1;
      totalUpdated += 1;
    }

    console.log(
      `[embeddings] batch processed=${rows.length} updated=${updatedThisBatch} total=${totalUpdated}`,
    );

    if (sleepMs > 0) {
      await sleep(sleepMs);
    }
  }

  console.log(`[embeddings] backfill complete. updated=${totalUpdated} processed=${totalProcessed}`);
  await recomputeClusterCentroids();
}

main().catch((err) => {
  console.error('Backfill failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
