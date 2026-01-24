'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';

type OpportunityPipelineCardProps = {
  strategyId: string;
};

type OpportunityStats = {
  signals_count?: number | null;
  clusters_count?: number | null;
  gate_passed_count?: number | null;
  briefs_count?: number | null;
  signals_total?: number | null;
  signals_30d?: number | null;
  clusters_total?: number | null;
  clusters_gate_passed?: number | null;
  briefs_total?: number | null;
};

type BlockerKey =
  | 'repeat_score'
  | 'paid_intent_score'
  | 'buyer_clarity_score'
  | 'reachability_score';

type BlockerInsight = {
  key: BlockerKey;
  label: string;
  hint: string;
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function OpportunityPipelineCard({
  strategyId,
}: OpportunityPipelineCardProps) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const normalizedId = strategyId.trim();
  const isValid = uuidRegex.test(normalizedId);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [blocker, setBlocker] = useState<BlockerInsight | null>(null);
  const [blockerLoading, setBlockerLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!normalizedId) {
      setStats(null);
      setLoading(false);
      setHasError(false);
      setUpdatedAt(null);
      setBlocker(null);
      setBlockerLoading(false);
      return () => {
        active = false;
      };
    }
    if (!isValid) {
      setStats(null);
      setLoading(false);
      setHasError(true);
      setUpdatedAt(null);
      setBlocker(null);
      setBlockerLoading(false);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setHasError(false);
    supabase
      .rpc('strategy_opportunity_stats', { strategy_id: normalizedId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStats(null);
          setHasError(true);
          setUpdatedAt(null);
          setBlocker(null);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          setStats(null);
          setHasError(true);
          setUpdatedAt(null);
          setBlocker(null);
          return;
        }
        setStats(row as OpportunityStats);
        setUpdatedAt(new Date());
      })
      .catch(() => {
        if (!active) return;
        setStats(null);
        setHasError(true);
        setUpdatedAt(null);
        setBlocker(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [normalizedId, isValid, supabase]);

  const safeStats = {
    signals_count: stats?.signals_count ?? stats?.signals_total ?? 0,
    signals_30d: stats?.signals_30d ?? null,
    clusters_count: stats?.clusters_count ?? stats?.clusters_total ?? 0,
    gate_passed_count: stats?.gate_passed_count ?? stats?.clusters_gate_passed ?? 0,
    briefs_count: stats?.briefs_count ?? stats?.briefs_total ?? 0,
  };

  const statusLine = (() => {
    if (safeStats.signals_count === 0) return 'No signals ingested yet';
    if (safeStats.clusters_count === 0) return 'Not clustered yet';
    if (safeStats.gate_passed_count === 0) return 'All clusters failed gating';
    if (safeStats.briefs_count === 0) return 'Brief generation not run';
    return 'Pipeline looks healthy';
  })();

  useEffect(() => {
    let active = true;
    if (!normalizedId || !isValid) {
      setBlocker(null);
      setBlockerLoading(false);
      return () => {
        active = false;
      };
    }
    if (!stats || hasError || loading) {
      setBlocker(null);
      setBlockerLoading(false);
      return () => {
        active = false;
      };
    }
    if (safeStats.clusters_count === 0 || safeStats.gate_passed_count > 0) {
      setBlocker(null);
      setBlockerLoading(false);
      return () => {
        active = false;
      };
    }

    setBlockerLoading(true);
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;

    supabase
      .rpc('strategy_clusters_list', {
        p_strategy_id: normalizedId,
        p_limit: 200,
        p_offset: 0,
      })
      .then(async ({ data, error }) => {
        if (!active) return;
        if (error || !Array.isArray(data)) {
          setBlocker(null);
          return;
        }
        const recentFailed = (data as Array<{
          cluster_id: string;
          gate_passed: boolean | null;
          last_seen_at: string | null;
        }>).filter((row) => {
          if (row.gate_passed !== false) return false;
          if (!row.last_seen_at) return false;
          const ts = new Date(row.last_seen_at).getTime();
          return Number.isFinite(ts) && ts >= cutoff;
        });
        if (recentFailed.length === 0) {
          setBlocker(null);
          return;
        }

        const ids = recentFailed.map((row) => row.cluster_id);
        const { data: scoreRows, error: scoreError } = await supabase
          .from('signal_clusters')
          .select('id, repeat_score, paid_intent_score, buyer_clarity_score, reachability_score')
          .in('id', ids);
        if (!active || scoreError || !Array.isArray(scoreRows)) {
          setBlocker(null);
          return;
        }

        const counts: Record<BlockerKey, number> = {
          repeat_score: 0,
          paid_intent_score: 0,
          buyer_clarity_score: 0,
          reachability_score: 0,
        };

        for (const row of scoreRows as Array<Record<string, unknown>>) {
          const repeat = typeof row.repeat_score === 'number' ? row.repeat_score : null;
          const paid = typeof row.paid_intent_score === 'number' ? row.paid_intent_score : null;
          const buyer =
            typeof row.buyer_clarity_score === 'number' ? row.buyer_clarity_score : null;
          const reach =
            typeof row.reachability_score === 'number' ? row.reachability_score : null;
          const candidates: Array<{ key: BlockerKey; value: number }> = [];
          if (repeat !== null) candidates.push({ key: 'repeat_score', value: repeat });
          if (paid !== null) candidates.push({ key: 'paid_intent_score', value: paid });
          if (buyer !== null) candidates.push({ key: 'buyer_clarity_score', value: buyer });
          if (reach !== null) candidates.push({ key: 'reachability_score', value: reach });
          if (candidates.length === 0) continue;
          candidates.sort((a, b) => a.value - b.value);
          const weakest = candidates[0]?.key;
          if (weakest) {
            counts[weakest] += 1;
          }
        }

        const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const topKey = ranked[0]?.[0] as BlockerKey | undefined;
        if (!topKey || counts[topKey] === 0) {
          setBlocker(null);
          return;
        }

        const labels: Record<BlockerKey, { label: string; hint: string }> = {
          repeat_score: {
            label: 'Repeatability',
            hint: 'broaden subreddits/time range or lower strict filters',
          },
          paid_intent_score: {
            label: 'Paid intent',
            hint: 'include tool/competitor keywords and B2B subreddits',
          },
          buyer_clarity_score: {
            label: 'Buyer clarity',
            hint: 'choose role-specific subreddits / add role keywords',
          },
          reachability_score: {
            label: 'Reachability',
            hint: 'ensure clear communities/tools ecosystems exist',
          },
        };

        const selected = labels[topKey];
        setBlocker({ key: topKey, label: selected.label, hint: selected.hint });
      })
      .catch(() => {
        if (!active) return;
        setBlocker(null);
      })
      .finally(() => {
        if (!active) return;
        setBlockerLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    normalizedId,
    isValid,
    stats,
    hasError,
    loading,
    safeStats.clusters_count,
    safeStats.gate_passed_count,
    supabase,
  ]);

  const updatedLabel = updatedAt
    ? (() => {
        const diffMs = Date.now() - updatedAt.getTime();
        if (!Number.isFinite(diffMs) || diffMs < 0) return null;
        const minutes = Math.floor(diffMs / 60000);
        if (minutes < 1) return 'Updated just now';
        if (minutes < 60) return `Updated ${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Updated ${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `Updated ${days}d ago`;
      })()
    : null;

  return (
    <Card className="bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Opportunity pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/40 bg-background/40 p-3"
              >
                <div className="h-5 w-12 rounded-full bg-secondary/25" />
                <div className="mt-2 h-2 w-16 rounded-full bg-secondary/20" />
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {['Signals', 'Clusters', 'Gate passed', 'Briefs'].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-border/40 bg-background/40 p-3"
                >
                  <div className="text-2xl font-semibold text-foreground">—</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground">Stats unavailable</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.signals_count}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {safeStats.signals_30d !== null
                    ? `Signals (30d: ${safeStats.signals_30d})`
                    : 'Signals'}
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.clusters_count}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Clusters
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.gate_passed_count}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Gate passed
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.briefs_count}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Briefs
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{statusLine}</div>
            {blockerLoading ? (
              <div className="h-3 w-4/5 rounded-full bg-secondary/15" />
            ) : (
              blocker && (
                <div className="text-xs text-muted-foreground">
                  Top blocker: {blocker.label} ({blocker.hint})
                </div>
              )
            )}
            {updatedLabel && (
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                {updatedLabel}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/strategies/${normalizedId}/clusters`}>
              Open opportunities
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
