'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import TrendSparkline from './[slug]/TrendSparkline';
import TrendBookmarkButton from './TrendBookmarkButton';
import { cardInteractive } from '@/lib/ui-classes';

type TrendCard = {
  id: string;
  slug: string;
  title: string;
  keyword?: string | null;
  geo?: string | null;
  timeframe?: string | null;
  latest_value?: number | null;
  peak_value?: number | null;
  avg_value?: number | null;
  growth_pct?: number | null;
  tags?: string[] | null;
  score?: number | null;
  status?: string | null;
  summary?: string | null;
  enriched_at?: string | null;
  source_primary: string;
  sparkline?: number[] | null;
  volume_display: string | null;
  growth_display: string | null;
  growth_label: string | null;
  categories: string[];
  overall_score: number | null;
};

type TrendCardItemProps = {
  trend: TrendCard;
  bookmarked: boolean;
  onBookmarkChange?: (bookmarked: boolean) => void;
};

export default function TrendCardItem({
  trend,
  bookmarked,
  onBookmarkChange,
}: TrendCardItemProps) {
  const isGoogle = trend.source_primary === 'google_trends';
  const displayTitle = trend.title || trend.keyword || trend.slug;

  const sparkValues = Array.isArray(trend.sparkline) ? trend.sparkline : [];
  const hasSparkline = sparkValues.length > 0;

  const interestValue =
    trend.latest_value ?? trend.peak_value ?? trend.avg_value ?? null;

  const formatInterest = (value: number | null) => {
    if (value == null) return '—';
    return `${Math.round(value)}`;
  };

  const formatGrowth = (growth: number | null) => {
    if (growth == null) return '—';
    const pct = Math.round(growth * 100);
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct}%`;
  };

  const growthValue = trend.growth_pct ?? null;
  const growthDisplay = trend.growth_display ?? formatGrowth(growthValue);
  const growthPositive = growthValue != null && growthValue > 0;
  const growthNegative = growthValue != null && growthValue < 0;

  const sourceLabel =
    trend.source_primary === 'google_trends'
      ? 'Google Trends'
      : trend.source_primary === 'youtube'
        ? 'YouTube'
        : trend.source_primary === 'reddit'
          ? 'Reddit'
          : trend.source_primary ?? 'Unknown';

  const statusChip = trend.status || trend.growth_label || null;

  const topicTags = Array.from(
    new Set([...(trend.categories ?? []), ...(trend.tags ?? [])]),
  ).filter(Boolean);
  const visibleTags = topicTags.slice(0, 3);
  const hiddenTagCount = Math.max(topicTags.length - visibleTags.length, 0);

  const scoreValue = trend.score ?? trend.overall_score ?? null;
  const interestDisplay = isGoogle
    ? formatInterest(interestValue)
    : trend.volume_display ?? null;
  const contextText = [trend.geo, trend.timeframe].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/trends/${trend.slug}`}
      className="group block h-full"
    >
      <div className={cn(cardInteractive, "relative flex h-full flex-col gap-4 rounded-2xl border-white/8 bg-white/[0.035] p-5 shadow-sm transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0")}>
        <div className="flex items-start gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-white/90">
                  {displayTitle}
                </h3>
                {trend.summary && (
                  <p className="line-clamp-2 text-sm text-white/70">
                    {trend.summary}
                  </p>
                )}
              </div>
              <div
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
              >
                <TrendBookmarkButton
                  slug={trend.slug}
                  trendId={trend.id}
                  initialBookmarked={bookmarked}
                  onChange={onBookmarkChange}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/65">
              {interestDisplay && (
                <span className="inline-flex items-center gap-1">
                  <span>{isGoogle ? 'Interest' : 'Volume'}</span>
                  <span className="font-semibold text-white/90">
                    {interestDisplay}
                  </span>
                </span>
              )}
              {growthDisplay && growthDisplay !== '—' && (
                <span
                  className={`inline-flex items-center gap-1 ${
                    growthPositive
                      ? 'text-emerald-200/90'
                      : growthNegative
                        ? 'text-rose-200/90'
                        : 'text-white/60'
                  }`}
                >
                  <span>Growth</span>
                  <span className="font-semibold">{growthDisplay}</span>
                </span>
              )}
              {scoreValue != null && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-200/90">
                  <span>Score</span>
                  <span>{scoreValue.toFixed(1)}</span>
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-white/75">
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1">
                {sourceLabel}
              </span>
              {statusChip && (
                <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1">
                  {statusChip}
                </span>
              )}
              {contextText && (
                <span className="text-[11px] text-white/60">{contextText}</span>
              )}
            </div>

            {topicTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {visibleTags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 font-medium text-white/70"
                  >
                    {tag}
                  </span>
                ))}
                {hiddenTagCount > 0 && (
                  <span
                    className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-1 font-medium text-white/60"
                    title={topicTags.slice(visibleTags.length).join(', ')}
                  >
                    +{hiddenTagCount}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] md:h-24 md:w-40">
            {hasSparkline ? (
              <TrendSparkline
                values={sparkValues}
                className="h-full w-full rounded-none border-0 bg-transparent p-1 !bg-transparent"
              />
            ) : (
              <div className="h-full w-full animate-pulse bg-gradient-to-br from-secondary/20 via-background/40 to-secondary/30" />
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-black/20 to-black/40" />
          </div>
        </div>
      </div>
    </Link>
  );
}
