import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type StrategyOpportunityCardProps = {
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function StrategyOpportunityCard({
  strategyId,
}: StrategyOpportunityCardProps) {
  const trimmedId = strategyId.trim();
  if (!trimmedId || !isUuid(trimmedId)) {
    return (
      <Card className="bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Opportunity pipeline</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Strategy ID is missing or invalid.
        </CardContent>
      </Card>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('Failed to get user for strategy pipeline card:', userError.message);
  }

  if (!userData?.user) {
    return (
      <Card className="bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Opportunity pipeline</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Sign in to view opportunity stats.
        </CardContent>
      </Card>
    );
  }

  const { data, error } = await supabase.rpc('strategy_opportunity_stats', {
    strategy_id: trimmedId,
  });

  if (error) {
    console.error('Failed to load strategy opportunity stats:', error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const stats = (row ?? null) as OpportunityStats | null;
  const errorMessage = error?.message ?? null;
  const safeStats = stats
    ? {
        signals_count: stats.signals_count ?? stats.signals_total ?? 0,
        signals_30d: stats.signals_30d ?? null,
        clusters_count: stats.clusters_count ?? stats.clusters_total ?? 0,
        gate_passed_count: stats.gate_passed_count ?? stats.clusters_gate_passed ?? 0,
        briefs_count: stats.briefs_count ?? stats.briefs_total ?? 0,
      }
    : null;

  return (
    <Card className="bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Opportunity pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <div className="text-xs text-muted-foreground">
            Unable to load opportunity stats. {errorMessage}
          </div>
        ) : !safeStats ? (
          <div className="text-xs text-muted-foreground">
            No opportunity data yet.
          </div>
        ) : (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {safeStats.signals_30d !== null ? 'Signals (30d)' : 'Signals'}
              </div>
              <div className="text-foreground">
                {safeStats.signals_30d ?? safeStats.signals_count}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Signals (total)
              </div>
              <div className="text-foreground">{safeStats.signals_count}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Need clusters
              </div>
              <div className="text-foreground">{safeStats.clusters_count}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Gate passed
              </div>
              <div className="text-foreground">{safeStats.gate_passed_count}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Opportunity briefs
              </div>
              <div className="text-foreground">{safeStats.briefs_count}</div>
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/strategies/${trimmedId}/clusters`}>View clusters</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
