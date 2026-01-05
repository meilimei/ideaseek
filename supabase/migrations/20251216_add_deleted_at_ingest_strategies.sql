alter table public.ingest_strategies
  add column if not exists deleted_at timestamptz;

create index if not exists ingest_strategies_created_by_deleted_at_idx
  on public.ingest_strategies (created_by, deleted_at);
