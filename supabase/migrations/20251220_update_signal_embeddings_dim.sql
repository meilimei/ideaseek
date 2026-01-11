begin;

do $$
declare
  idx record;
begin
  for idx in
    select schemaname, indexname
    from pg_indexes
    where tablename = 'signals'
      and indexdef ilike '%embedding%'
      and indexdef ilike '%ivfflat%'
  loop
    execute format('drop index if exists %I.%I', idx.schemaname, idx.indexname);
  end loop;

  for idx in
    select schemaname, indexname
    from pg_indexes
    where tablename = 'signal_clusters'
      and indexdef ilike '%centroid%'
      and indexdef ilike '%ivfflat%'
  loop
    execute format('drop index if exists %I.%I', idx.schemaname, idx.indexname);
  end loop;
end $$;

alter table public.signals
  alter column embedding type vector(1024) using null;

alter table public.signal_clusters
  alter column centroid type vector(1024) using null;

create index if not exists signals_embedding_ivfflat_idx
  on public.signals using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create index if not exists signal_clusters_centroid_ivfflat_idx
  on public.signal_clusters using ivfflat (centroid vector_cosine_ops) with (lists = 100);

commit;
