'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import type { StrategyDraft } from '../_draft/types';
import { useDraft } from '../_draft/context';

function coerceStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function coerceNumber(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveSource(value: unknown): StrategyDraft['source'] {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'google_trends') return 'trends';
  if (normalized === 'trends' || normalized === 'reddit' || normalized === 'youtube') {
    return normalized as StrategyDraft['source'];
  }
  return undefined;
}

export default function DraftPrefill({
  children,
}: {
  children: React.ReactNode;
}) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode');
  const strategyId = searchParams.get('strategyId');
  const { draft, updateDraft, resetDraft } = useDraft();
  const loadingRef = useRef<string | null>(null);
  const loadedRef = useRef<string | null>(draft.strategyId ?? null);

  useEffect(() => {
    if (mode !== 'edit') return;
    const normalizedId = (strategyId ?? '').trim();
    if (!normalizedId || !uuidRegex.test(normalizedId)) return;
    if (draft.strategyId === normalizedId || loadedRef.current === normalizedId) {
      return;
    }
    if (loadingRef.current === normalizedId) return;
    loadingRef.current = normalizedId;

    const fetchAndHydrate = async () => {
      try {
        const res = await fetch(`/api/strategies/${encodeURIComponent(normalizedId)}`);
        if (!res.ok) {
          console.error('Failed to fetch strategy for edit:', res.statusText);
          return;
        }
        const json = await res.json();
        const strategy = json?.strategy;
        if (!strategy) return;

        const config =
          strategy.config && typeof strategy.config === 'object' && !Array.isArray(strategy.config)
            ? strategy.config
            : {};
        const subreddits = coerceStringArray(config.subreddits);
        const keywords = coerceStringArray(config.keywords);
        const sort =
          typeof config.sort === 'string' && ['top', 'new'].includes(config.sort)
            ? (config.sort as StrategyDraft['sort'])
            : undefined;
        const timeRange =
          typeof config.timeRange === 'string' &&
          ['day', 'week', 'month'].includes(config.timeRange)
            ? (config.timeRange as StrategyDraft['timeRange'])
            : undefined;
        const limit = coerceNumber(config.limit);
        const signalsRaw =
          config.signals && typeof config.signals === 'object' && !Array.isArray(config.signals)
            ? config.signals
            : undefined;
        const signals =
          signalsRaw && typeof signalsRaw === 'object'
            ? {
                minUpvotes: coerceNumber((signalsRaw as any).minUpvotes),
                minComments: coerceNumber((signalsRaw as any).minComments),
                maxAgeDays: coerceNumber((signalsRaw as any).maxAgeDays),
              }
            : undefined;

        const patch: StrategyDraft = {
          strategyId: normalizedId,
          name: typeof strategy.name === 'string' ? strategy.name : undefined,
          source: resolveSource(strategy.source),
          track: typeof config.track === 'string' ? config.track : undefined,
          description:
            typeof strategy.description === 'string' ? strategy.description : undefined,
          subreddits,
          keywords,
          sort,
          timeRange,
          limit,
          signals,
          cron: typeof strategy.cron_expr === 'string' ? strategy.cron_expr : undefined,
          active:
            typeof strategy.is_active === 'boolean' ? strategy.is_active : undefined,
        };

        resetDraft();
        updateDraft(patch);
        loadedRef.current = normalizedId;
      } catch (err) {
        console.error('Failed to hydrate strategy draft:', err);
      } finally {
        loadingRef.current = null;
      }
    };

    fetchAndHydrate();
  }, [draft.strategyId, mode, resetDraft, strategyId, updateDraft]);

  return <>{children}</>;
}
