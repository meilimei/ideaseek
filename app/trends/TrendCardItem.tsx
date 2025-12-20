'use client';

import Link from 'next/link';
import TrendSparkline from './[slug]/TrendSparkline';
import TrendBookmarkButton from './TrendBookmarkButton';

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

  const interestValue =
    trend.latest_value ??
    trend.peak_value ??
    trend.avg_value ??
    null;

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

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--card)]/90 p-4 shadow-sm transition-transform hover:-translate-y-[1px] hover:border-[var(--primary)]/50 hover:shadow-lg">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 md:flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/trends/${trend.slug}`}
              className="text-lg font-semibold text-white hover:text-[var(--primary)]"
            >
              {displayTitle}
            </Link>
            <TrendBookmarkButton
              slug={trend.slug}
              trendId={trend.id}
              initialBookmarked={bookmarked}
              onChange={onBookmarkChange}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
            <span className="text-[var(--primary)]">
              {isGoogle
                ? `Interest: ${formatInterest(interestValue)}`
                : `Volume: ${trend.volume_display ?? '—'}`}
            </span>
            <span className="text-emerald-400">
              Growth: {formatGrowth(trend.growth_pct)}
            </span>
            {trend.growth_label && (
              <span className="rounded-full border border-[var(--border)] bg-[var(--muted)] px-2 py-0.5 text-xs text-slate-200">
                {trend.growth_label}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
              {trend.source_primary === 'google_trends'
                ? 'Google Trends'
                : trend.source_primary}
            </span>
            {(trend.geo || trend.timeframe) && (
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5">
                {[trend.geo, trend.timeframe].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
        </div>
        <div className="md:w-40 md:flex-shrink-0 md:pl-3">
          <TrendSparkline
            values={sparkValues}
            className="h-16 w-full mt-2 md:mt-0"
          />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-200">
        {trend.status && (
          <span className="rounded-full border border-[var(--primary)]/40 bg-[rgba(85,175,210,0.14)] px-2 py-0.5 text-[var(--primary)]">
            {trend.status}
          </span>
        )}
        {trend.score != null && (
          <span className="rounded-full border border-amber-200/60 bg-[rgba(251,191,36,0.15)] px-2 py-0.5 text-amber-200">
            Score: {trend.score.toFixed(1)} / 5
          </span>
        )}
        {trend.categories.map((cat) => (
          <span
            key={cat}
            className="rounded-full border border-[var(--border)] px-2 py-0.5"
          >
            {cat}
          </span>
        ))}
        {trend.overall_score != null && (
          <span className="rounded-full border border-amber-200/60 bg-[rgba(251,191,36,0.15)] px-2 py-0.5 text-amber-200">
            Score: {trend.overall_score} / 5
          </span>
        )}
        {trend.tags &&
          trend.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-[var(--border)] px-2 py-0.5"
            >
              {tag}
            </span>
          ))}
      </div>
    </div>
  );
}
