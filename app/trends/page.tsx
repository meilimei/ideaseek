'use client';

import { useEffect, useState } from 'react';
import TrendCardItem from './TrendCardItem';
import { createClient } from '@/lib/supabaseBrowserClient';

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
  source_primary: string;
  sparkline?: number[] | null;
  volume_display: string | null;
  growth_display: string | null;
  growth_label: string | null;
  categories: string[];
  overall_score: number | null;
};

export default function TrendsPage() {
  const [trends, setTrends] = useState<TrendCard[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'growth' | 'volume' | 'score'>(
    'recent',
  );
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'google_trends' | 'youtube' | 'reddit'
  >('all');
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/trends?q=${encodeURIComponent(
          searchQuery,
        )}&sort=${sort}&source=${sourceFilter}&page=${page}&pageSize=${pageSize}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to load trends');
        }
        const json = await res.json();
        setTrends(Array.isArray(json.trends) ? json.trends : []);
        setTotal(typeof json.total === 'number' ? json.total : 0);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load trends';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, pageSize, searchQuery, sort, sourceFilter]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sort, sourceFilter]);

  useEffect(() => {
    let cancelled = false;
    async function loadBookmarks() {
      try {
        const res = await fetch('/api/trends/bookmarks', {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && Array.isArray(json.trendIds)) {
          setBookmarkedIds(new Set(json.trendIds));
        }
      } catch {
        // ignore
      }
    }
    loadBookmarks();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_DEBUG !== '1'
    ) {
      return;
    }
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      })
      .catch(() => {})
      .finally(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Trends</h1>
        <p className="text-gray-600">
          Discover emerging trends and opportunities.
        </p>
        {(process.env.NODE_ENV !== 'production' ||
          process.env.NEXT_PUBLIC_DEBUG === '1') && (
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-gray-700 bg-gray-50">
            Debug User:{' '}
            <span className="font-semibold">
              {userId ?? 'not logged in'}
            </span>
          </div>
        )}
      </header>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-600">{total} trends</div>
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search trends..."
              className="w-full md:w-64 rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span>Sort by:</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
              className="rounded-lg border px-2 py-1 text-sm"
            >
              <option value="recent">Most Recent</option>
              <option value="growth">Highest Growth</option>
              <option value="volume">Highest Volume</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            {[
              { label: 'All', value: 'all' as const },
              { label: 'Google', value: 'google_trends' as const },
              { label: 'YouTube', value: 'youtube' as const },
              { label: 'Reddit', value: 'reddit' as const },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setSourceFilter(opt.value);
                  setPage(1);
                }}
                className={`rounded-full border px-3 py-1 text-xs ${
                  sourceFilter === opt.value
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}
      {loading && trends.length === 0 && (
        <div className="text-sm text-gray-600">Loading trends...</div>
      )}
      {!loading && trends.length === 0 && !error && (
        <div className="text-sm text-gray-500">No trends found.</div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trends.map((trend) => (
          <TrendCardItem
            key={trend.id}
            trend={trend}
            bookmarked={bookmarkedIds.has(trend.id)}
            onBookmarkChange={(next) => {
              setBookmarkedIds((prev) => {
                const copy = new Set(prev);
                if (next) {
                  copy.add(trend.id);
                } else {
                  copy.delete(trend.id);
                }
                return copy;
              });
            }}
          />
        ))}
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={`px-3 py-1 rounded-full border ${
              page === 1
                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={`px-3 py-1 rounded-full border ${
              page === totalPages
                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Next
          </button>
        </div>
        {totalPages <= 7 && (
          <div className="flex items-center gap-2 flex-wrap justify-center">
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`px-3 py-1 rounded-full border ${
                    page === p
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
