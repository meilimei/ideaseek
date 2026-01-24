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
  signals_total: number | null;
  signals_30d: number | null;
  clusters_total: number | null;
  clusters_gate_passed: number | null;
  briefs_total: number | null;
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

  useEffect(() => {
    let active = true;
    if (!normalizedId) {
      setStats(null);
      setLoading(false);
      setHasError(false);
      setUpdatedAt(null);
      return () => {
        active = false;
      };
    }
    if (!isValid) {
      setStats(null);
      setLoading(false);
      setHasError(true);
      setUpdatedAt(null);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    setHasError(false);
    supabase
      .rpc('strategy_opportunity_stats', { p_strategy_id: normalizedId })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setStats(null);
          setHasError(true);
          setUpdatedAt(null);
        } else {
          setStats((data as OpportunityStats | null) ?? null);
          setUpdatedAt(new Date());
        }
      })
      .catch(() => {
        if (!active) return;
        setStats(null);
        setHasError(true);
        setUpdatedAt(null);
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
    signals_total: stats?.signals_total ?? 0,
    signals_30d: stats?.signals_30d ?? 0,
    clusters_total: stats?.clusters_total ?? 0,
    clusters_gate_passed: stats?.clusters_gate_passed ?? 0,
    briefs_total: stats?.briefs_total ?? 0,
  };

  const statusLine = (() => {
    if (safeStats.signals_total === 0) return 'No signals ingested yet';
    if (safeStats.clusters_total === 0) return 'Not clustered yet';
    if (safeStats.clusters_gate_passed === 0) return 'All clusters failed gating';
    if (safeStats.briefs_total === 0) return 'Brief generation not run';
    return 'Pipeline looks healthy';
  })();

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
            <div className="text-xs text-muted-foreground">Stats unavailable.</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.signals_total}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Signals (30d: {safeStats.signals_30d})
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.clusters_total}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Clusters
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.clusters_gate_passed}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Gate passed
                </div>
              </div>
              <div className="rounded-xl border border-border/40 bg-background/40 p-3">
                <div className="text-2xl font-semibold text-foreground">
                  {safeStats.briefs_total}
                </div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Briefs
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground">{statusLine}</div>
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
