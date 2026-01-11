import { supabaseServiceClient as supabase } from '../lib/supabaseServiceClient';

type SignalRow = {
  id: string;
  embedding: number[] | null;
  url?: string | null;
  author?: string | null;
  content?: string | null;
  signal_created_at?: string | null;
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
  content: string | null;
  url: string | null;
  author: string | null;
  signal_created_at: string | null;
};

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

async function fetchClusters(): Promise<ClusterRow[]> {
  const { data, error } = await supabase
    .from('signal_clusters')
    .select('id, centroid, signal_count, first_seen_at, last_seen_at, meta');
  if (error) throw new Error(error.message);
  return (data ?? []) as ClusterRow[];
}

async function fetchNextSignals(limit: number): Promise<SignalRow[]> {
  const { data, error } = await supabase
    .from('signals')
    .select('id, embedding, url, author, content, signal_created_at')
    .not('embedding', 'is', null)
    .order('signal_created_at', { ascending: true, nullsLast: true })
    .limit(limit * 2); // grab extra before membership filter
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

async function insertCluster(embedding: number[], createdAt: string | null, author?: string | null) {
  const { data, error } = await supabase
    .from('signal_clusters')
    .insert({
      centroid: embedding,
      signal_count: 1,
      first_seen_at: createdAt ?? new Date().toISOString(),
      last_seen_at: createdAt ?? new Date().toISOString(),
      meta: author ? { authors: [author] } : {},
    })
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id as string;
}

async function updateClusterStats(cluster: ClusterRow, embedding: number[], createdAt: string | null, author?: string | null) {
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
  const authors: string[] = Array.isArray(meta.authors) ? meta.authors : [];
  if (author && !authors.includes(author)) authors.push(author);
  meta.authors = authors;

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
}

async function insertMember(signalId: string, clusterId: string, similarity: number) {
  const { error } = await supabase
    .from('signal_cluster_members')
    .insert({ signal_id: signalId, cluster_id: clusterId, similarity });
  if (error) throw new Error(error.message);
}

async function refreshEvidence(clusterId: string) {
  const { data, error } = await supabase
    .from('signal_cluster_members')
    .select(
      'similarity, signals(content, url, author, signal_created_at)',
    )
    .eq('cluster_id', clusterId)
    .order('similarity', { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  const members = (data ?? []) as { similarity: number; signals: MemberRow }[];
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

  const { error: updateError } = await supabase
    .from('signal_clusters')
    .update({
      evidence,
      meta: { authors, unique_authors: authors.length },
    })
    .eq('id', clusterId);
  if (updateError) throw new Error(updateError.message);
}

async function main() {
  const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 50));
  const threshold = Number(process.env.CLUSTER_SIM_THRESHOLD || 0.86);
  let processed = 0;
  let attached = 0;
  let created = 0;
  while (true) {
    const signals = await fetchNextSignals(batchSize);
    const candidates = await filterUnclustered(signals);
    if (candidates.length === 0) break;

    const clusters = await fetchClusters();
    const touched = new Set<string>();

    for (const signal of candidates) {
      if (!signal.embedding || signal.embedding.length === 0) continue;
      processed += 1;
      let bestId: string | null = null;
      let bestSim = -1;
      let bestCluster: ClusterRow | null = null;

      for (const cluster of clusters) {
        if (!cluster.centroid) continue;
        const sim = cosineSimilarity(cluster.centroid, signal.embedding);
        if (sim > bestSim) {
          bestSim = sim;
          bestId = cluster.id;
          bestCluster = cluster;
        }
      }

      if (!bestId || bestSim < threshold) {
        const newId = await insertCluster(
          signal.embedding,
          signal.signal_created_at ?? null,
          signal.author ?? null,
        );
        clusters.push({
          id: newId,
          centroid: signal.embedding,
          signal_count: 1,
          first_seen_at: signal.signal_created_at ?? null,
          last_seen_at: signal.signal_created_at ?? null,
          meta: signal.author ? { authors: [signal.author] } : {},
        });
        touched.add(newId);
        created += 1;
        await insertMember(signal.id, newId, 1);
        continue;
      }

      await updateClusterStats(
        bestCluster!,
        signal.embedding,
        signal.signal_created_at ?? null,
        signal.author ?? null,
      );
      await insertMember(signal.id, bestId, bestSim);
      touched.add(bestId);
      attached += 1;
    }

    console.log(
      `[cluster] processed=${processed} attached=${attached} created=${created} touched=${touched.size}`,
    );

    for (const id of touched) {
      try {
        await refreshEvidence(id);
      } catch (err) {
        console.warn(
          `Failed to refresh evidence for cluster ${id}:`,
          err instanceof Error ? err.message : err,
        );
      }
    }

    if (candidates.length < batchSize) break;
  }

  console.log(
    `[cluster] done processed=${processed} attached=${attached} created=${created}`,
  );
}

main().catch((err) => {
  console.error('Cluster script failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
