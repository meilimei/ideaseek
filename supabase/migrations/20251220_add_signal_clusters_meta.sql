alter table public.signal_clusters
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.signal_clusters.meta is
  'Stores lightweight cluster metadata (e.g., rolling author list or recent signal ids).';
