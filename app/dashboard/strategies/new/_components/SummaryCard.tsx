'use client';

import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDraft } from '../_draft/context';
import OpportunityPipelineCard from './OpportunityPipelineCard';

export default function SummaryCard() {
  const { draft } = useDraft();

  const subredditsCount = draft.subreddits?.length ?? 0;
  const keywordsCount = draft.keywords?.length ?? 0;

  const rows: Array<{ label: string; value: string }> = [];

  if (draft.name) rows.push({ label: 'Name', value: draft.name });
  if (draft.source) rows.push({ label: 'Source', value: draft.source });
  if (draft.track) rows.push({ label: 'Track', value: draft.track });
  if (subredditsCount) rows.push({ label: 'Subreddits', value: String(subredditsCount) });
  if (keywordsCount) rows.push({ label: 'Keywords', value: String(keywordsCount) });
  if (draft.sort || draft.timeRange || draft.limit) {
    const parts = [
      draft.sort ? `Sort: ${draft.sort}` : null,
      draft.timeRange ? `Range: ${draft.timeRange}` : null,
      typeof draft.limit === 'number' ? `Limit: ${draft.limit}` : null,
    ].filter(Boolean);
    if (parts.length) {
      rows.push({ label: 'Filters', value: parts.join(' · ') });
    }
  }
  if (draft.signals) {
    const parts = [
      typeof draft.signals.minUpvotes === 'number'
        ? `Upvotes ≥ ${draft.signals.minUpvotes}`
        : null,
      typeof draft.signals.minComments === 'number'
        ? `Comments ≥ ${draft.signals.minComments}`
        : null,
      typeof draft.signals.maxAgeDays === 'number'
        ? `Max age ${draft.signals.maxAgeDays}d`
        : null,
    ].filter(Boolean);
    if (parts.length) {
      rows.push({ label: 'Signals', value: parts.join(' · ') });
    }
  }
  if (draft.cron) rows.push({ label: 'Cron', value: draft.cron });
  if (typeof draft.active === 'boolean') {
    rows.push({ label: 'Active', value: draft.active ? 'Yes' : 'No' });
  }

  const searchParams = useSearchParams();
  const strategyId = searchParams.get('strategyId') || '';

  return (
    <div className="space-y-3">
      <Card className="bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Draft summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {rows.length === 0 ? (
            <span>No selections yet.</span>
          ) : (
            rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4">
                <span className="text-xs uppercase tracking-wide text-muted-foreground/80">
                  {row.label}
                </span>
                <span className="text-right text-foreground/90">{row.value}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {strategyId && <OpportunityPipelineCard strategyId={strategyId} />}
    </div>
  );
}
