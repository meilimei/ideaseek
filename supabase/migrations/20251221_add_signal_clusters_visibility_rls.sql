alter table public.signal_clusters
  add column if not exists owner_id uuid,
  add column if not exists visibility text not null default 'public';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'signal_clusters_visibility_check'
  ) then
    alter table public.signal_clusters
      add constraint signal_clusters_visibility_check
      check (visibility in ('public', 'private'));
  end if;
end $$;

update public.signal_clusters
set owner_id = coalesce(
  owner_id,
  case
    when (meta->>'owner_id') ~* '^[0-9a-f-]{36}$' then (meta->>'owner_id')::uuid
    when (meta->>'user_id') ~* '^[0-9a-f-]{36}$' then (meta->>'user_id')::uuid
    when (meta->>'created_by') ~* '^[0-9a-f-]{36}$' then (meta->>'created_by')::uuid
    else null
  end
)
where owner_id is null;

update public.signal_clusters sc
set owner_id = s.created_by
from public.ingest_strategies s
where sc.owner_id is null
  and s.created_by is not null
  and (
    ((sc.meta->>'strategy_id') ~* '^[0-9a-f-]{36}$' and s.id = (sc.meta->>'strategy_id')::uuid)
    or ((sc.meta->>'strategyId') ~* '^[0-9a-f-]{36}$' and s.id = (sc.meta->>'strategyId')::uuid)
  );

create index if not exists signal_clusters_owner_id_idx on public.signal_clusters (owner_id);
create index if not exists signal_clusters_visibility_idx on public.signal_clusters (visibility);

alter table public.signal_clusters enable row level security;
alter table public.opportunity_briefs enable row level security;

drop policy if exists signal_clusters_select_visible on public.signal_clusters;
create policy signal_clusters_select_visible
  on public.signal_clusters
  for select
  using (visibility = 'public' or owner_id = auth.uid());

drop policy if exists signal_clusters_insert_owner on public.signal_clusters;
create policy signal_clusters_insert_owner
  on public.signal_clusters
  for insert
  with check (owner_id = auth.uid());

drop policy if exists signal_clusters_update_owner on public.signal_clusters;
create policy signal_clusters_update_owner
  on public.signal_clusters
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists signal_clusters_delete_owner on public.signal_clusters;
create policy signal_clusters_delete_owner
  on public.signal_clusters
  for delete
  using (owner_id = auth.uid());

drop policy if exists opportunity_briefs_select_visible on public.opportunity_briefs;
create policy opportunity_briefs_select_visible
  on public.opportunity_briefs
  for select
  using (
    exists (
      select 1
      from public.signal_clusters sc
      where sc.id = opportunity_briefs.cluster_id
        and (sc.visibility = 'public' or sc.owner_id = auth.uid())
    )
  );

drop policy if exists opportunity_briefs_insert_owner on public.opportunity_briefs;
create policy opportunity_briefs_insert_owner
  on public.opportunity_briefs
  for insert
  with check (
    exists (
      select 1
      from public.signal_clusters sc
      where sc.id = opportunity_briefs.cluster_id
        and sc.owner_id = auth.uid()
    )
  );

drop policy if exists opportunity_briefs_update_owner on public.opportunity_briefs;
create policy opportunity_briefs_update_owner
  on public.opportunity_briefs
  for update
  using (
    exists (
      select 1
      from public.signal_clusters sc
      where sc.id = opportunity_briefs.cluster_id
        and sc.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.signal_clusters sc
      where sc.id = opportunity_briefs.cluster_id
        and sc.owner_id = auth.uid()
    )
  );

drop policy if exists opportunity_briefs_delete_owner on public.opportunity_briefs;
create policy opportunity_briefs_delete_owner
  on public.opportunity_briefs
  for delete
  using (
    exists (
      select 1
      from public.signal_clusters sc
      where sc.id = opportunity_briefs.cluster_id
        and sc.owner_id = auth.uid()
    )
  );
