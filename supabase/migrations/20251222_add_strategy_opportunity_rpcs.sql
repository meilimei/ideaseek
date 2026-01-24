create or replace function public.strategy_opportunity_stats(p_strategy_id uuid)
returns table (
  signals_total integer,
  signals_30d integer,
  clusters_total integer,
  clusters_gate_passed integer,
  briefs_total integer
)
language sql
stable
security invoker
as $$
  with strategy_signals as (
    select s.id, s.signal_created_at
    from public.signals s
    where (
      case
        when (s.meta->>'strategyId') ~* '^[0-9a-f-]{36}$' then (s.meta->>'strategyId')::uuid
        when (s.meta->>'strategy_id') ~* '^[0-9a-f-]{36}$' then (s.meta->>'strategy_id')::uuid
        else null
      end
    ) = p_strategy_id
  ),
  cluster_ids as (
    select distinct m.cluster_id
    from public.signal_cluster_members m
    join strategy_signals ss on ss.id = m.signal_id
  )
  select
    (select count(*)::int from strategy_signals) as signals_total,
    (select count(*)::int from strategy_signals where signal_created_at >= now() - interval '30 days') as signals_30d,
    (select count(*)::int from cluster_ids ci join public.signal_clusters sc on sc.id = ci.cluster_id) as clusters_total,
    (select count(*)::int from cluster_ids ci join public.signal_clusters sc on sc.id = ci.cluster_id where sc.gate_passed is true) as clusters_gate_passed,
    (select count(distinct ob.id)::int from cluster_ids ci join public.opportunity_briefs ob on ob.cluster_id = ci.cluster_id) as briefs_total;
$$;

create or replace function public.strategy_clusters_list(
  p_strategy_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  cluster_id uuid,
  title text,
  summary text,
  signal_count integer,
  unique_authors integer,
  score_total numeric,
  gate_passed boolean,
  last_seen_at timestamptz,
  brief_id uuid,
  brief_title text,
  updated_at timestamptz
)
language sql
stable
security invoker
as $$
  with strategy_signals as (
    select s.id
    from public.signals s
    where (
      case
        when (s.meta->>'strategyId') ~* '^[0-9a-f-]{36}$' then (s.meta->>'strategyId')::uuid
        when (s.meta->>'strategy_id') ~* '^[0-9a-f-]{36}$' then (s.meta->>'strategy_id')::uuid
        else null
      end
    ) = p_strategy_id
  ),
  cluster_ids as (
    select distinct m.cluster_id
    from public.signal_cluster_members m
    join strategy_signals ss on ss.id = m.signal_id
  ),
  ranked as (
    select
      sc.id as cluster_id,
      sc.title,
      sc.summary,
      sc.signal_count,
      sc.unique_authors,
      sc.score_total,
      sc.gate_passed,
      sc.last_seen_at,
      sc.updated_at
    from public.signal_clusters sc
    join cluster_ids ci on ci.cluster_id = sc.id
  )
  select
    r.cluster_id,
    r.title,
    r.summary,
    r.signal_count,
    r.unique_authors,
    r.score_total,
    r.gate_passed,
    r.last_seen_at,
    ob.id as brief_id,
    ob.title as brief_title,
    r.updated_at
  from ranked r
  left join public.opportunity_briefs ob on ob.cluster_id = r.cluster_id
  order by r.score_total desc nulls last, r.last_seen_at desc nulls last
  limit greatest(coalesce(p_limit, 50), 1)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
