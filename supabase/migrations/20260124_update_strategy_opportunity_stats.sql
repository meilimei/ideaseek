drop function if exists public.strategy_opportunity_stats(uuid);

create or replace function public.strategy_opportunity_stats(strategy_id uuid)
returns table (
  signals_count bigint,
  clusters_count bigint,
  gate_passed_count bigint,
  briefs_count bigint
)
language sql
stable
security invoker
as $$
  with strategy_signals as (
    select s.id
    from public.signals s
    where coalesce(s.meta->>'strategyId', s.meta->>'strategy_id') = strategy_id::text
  ),
  cluster_ids as (
    select distinct m.cluster_id
    from public.signal_cluster_members m
    join strategy_signals ss on ss.id = m.signal_id
  )
  select
    (select count(*)::bigint from strategy_signals) as signals_count,
    (select count(*)::bigint from cluster_ids) as clusters_count,
    (select count(*)::bigint
     from public.opportunity_briefs ob
     where ob.cluster_id in (select cluster_id from cluster_ids)
       and coalesce((ob.brief->>'gate_passed')::boolean, false) is true
    ) as gate_passed_count,
    (select count(*)::bigint
     from public.opportunity_briefs ob
     where ob.cluster_id in (select cluster_id from cluster_ids)
    ) as briefs_count;
$$;
