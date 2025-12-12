'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import TrendSparkline from './[slug]/TrendSparkline';
import TrendBookmarkButton from './TrendBookmarkButton';

type TrendCard = {
  id: string;
  slug: string;
  title: string;
  source_primary: string;
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
  const [points, setPoints] = useState<SparkPoint[]>([]);
  const [loadingSparkline, setLoadingSparkline] = useState(false);
  void loadingSparkline;

  useEffect(() => {
    let cancelled = false;
    async function loadSparkline() {
      try {
        setLoadingSparkline(true);
        const res = await fetch(`/api/trends/${trend.slug}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        const ts: SparkPoint[] = Array.isArray(json.timeseries)
          ? json.timeseries.slice(-12)
          : [];
        if (!cancelled) {
          setPoints(ts);
        }
      } catch {
        // ignore sparkline errors for now
      } finally {
        if (!cancelled) setLoadingSparkline(false);
      }
    }
    loadSparkline();
    return () => {
      cancelled = true;
    };
  }, [trend.slug]);

  return (
    <div className="flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="space-y-2">
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
        <TrendSparkline
          points={points}
          className="mt-3 h-20"
        />
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
