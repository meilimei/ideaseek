'use client';

import Link from 'next/link';
import TrendSparkline from './[slug]/TrendSparkline';
import TrendBookmarkButton from './TrendBookmarkButton';

type TrendCard = {
  id: string;
  slug: string;
  title: string;
  source_primary: string;
  sparkline?: number[] | null;
  volume_display: string | null;
  growth_display: string | null;
  growth_label: string | null;
  categories: string[];
  overall_score: number | null;
};

type SparkPoint = { date: string; value: number };

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
  const points: SparkPoint[] =
    Array.isArray(trend.sparkline) && trend.sparkline.length > 0
      ? trend.sparkline.map((value, idx) => ({
          date: `${idx}`,
          value,
        }))
      : [];

  return (
    <div className="flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2 md:flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              href={`/trends/${trend.slug}`}
              className="text-lg font-semibold hover:underline"
            >
              {trend.title}
            </Link>
            <TrendBookmarkButton
              slug={trend.slug}
              trendId={trend.id}
              initialBookmarked={bookmarked}
              onChange={onBookmarkChange}
            />
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-700">
            {trend.volume_display && (
              <span className="text-blue-600">{trend.volume_display}</span>
            )}
            {trend.growth_display && (
              <span className="text-green-600">{trend.growth_display}</span>
            )}
          </div>
          {trend.growth_label && (
            <span className="inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 border border-green-100">
              {trend.growth_label}
            </span>
          )}
        </div>
        {points.length > 0 && (
          <div className="md:w-40 md:flex-shrink-0 md:pl-3">
            <TrendSparkline
              points={points}
              className="h-16 w-full mt-2 md:mt-0"
            />
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-700">
        {trend.categories.map((cat) => (
          <span
            key={cat}
            className="rounded-full border px-2 py-0.5"
          >
            {cat}
          </span>
        ))}
        {trend.overall_score != null && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            Score: {trend.overall_score} / 5
          </span>
        )}
      </div>
    </div>
  );
}
