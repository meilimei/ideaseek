'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import TrendCardItem from './TrendCardItem';
import { createBrowserSupabaseClient } from '@/lib/supabase/client';
import PageShell from '@/components/site/PageShell';
import { chipActive, chipBase, inputBase, pillButton } from '@/lib/ui-classes';
import { cn } from '@/lib/utils/cn';
import AppPagination from '@/components/site/AppPagination';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton } from '@/components/ui/card-skeleton';

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
  tags?: string[] | null;
  score?: number | null;
  status?: string | null;
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
  const [savedOnly, setSavedOnly] = useState(false);
  const [savedCount, setSavedCount] = useState<number>(0);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters = Boolean(
    searchQuery || sourceFilter !== 'all' || savedOnly,
  );

  useEffect(() => {
    setSavedOnly(searchParams.get('saved') === '1');
    setSearchQuery(searchParams.get('q') ?? '');
    const sortParam = searchParams.get('sort') as typeof sort | null;
    if (sortParam) setSort(sortParam);
    const sourceParam = searchParams.get('source') as typeof sourceFilter | null;
    if (sourceParam) setSourceFilter(sourceParam);
    const pageParam = Number(searchParams.get('page') ?? '1');
    setPage(pageParam > 0 ? pageParam : 1);
  }, [searchParams]);

  const updateQuery = (patch: Record<string, string | null>, resetPage = false) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v === null) params.delete(k);
      else params.set(k, v);
    });
    if (resetPage) params.set('page', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/trends?q=${encodeURIComponent(
          searchQuery,
        )}&sort=${sort}&source=${sourceFilter}&page=${page}&pageSize=${pageSize}&saved=${savedOnly ? '1' : '0'}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Failed to load trends');
        }
        const json = await res.json();
        setTrends(Array.isArray(json.trends) ? json.trends : []);
        setTotal(typeof json.total === 'number' ? json.total : 0);
        setSavedCount(typeof json.savedCount === 'number' ? json.savedCount : 0);
        if (Array.isArray(json.bookmarkedIds)) {
          setBookmarkedIds(new Set(json.bookmarkedIds));
        } else {
          setBookmarkedIds(new Set());
        }
        if (json.requireAuth) {
          setError('Please sign in to view saved trends.');
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load trends';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [page, pageSize, searchQuery, sort, sourceFilter, savedOnly]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, sort, sourceFilter, savedOnly]);

  useEffect(() => {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PUBLIC_DEBUG !== '1'
    ) {
      return;
    }
    const supabase = createBrowserSupabaseClient();
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (data.user) setUserId(data.user.id);
      })
      .catch(() => {})
      .finally(() => {});
  }, []);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setSavedOnly(false);
    updateQuery({ q: null, source: null, saved: null, page: '1' });
  };

  const showSavedSummary = Number.isFinite(savedCount) && savedCount > 0;

  return (
    <PageShell
      title="Trends"
      description="Discover emerging signals and opportunities from Google, YouTube, and the community."
    >
      <div className="mb-2 text-sm text-white/65">{total} results</div>
      {showSavedSummary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.04] p-4 shadow-sm backdrop-blur-sm">
            <div className="text-sm font-semibold text-white/90">Saved trends</div>
            <div className="mt-3 text-3xl font-bold text-white">
              {savedCount ?? 0}
            </div>
            <div className="mt-2 text-sm text-white/65">Bookmarked signals</div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-white/8 bg-white/[0.035] p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search trends..."
              className={cn(inputBase, "md:w-72 rounded-xl border-white/15 bg-white/[0.04] text-white placeholder:text-white/45")}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-white/65">
            <span>Sort</span>
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
              className={cn(inputBase, "h-9 w-auto rounded-xl border-white/15 bg-white/[0.04] px-2 text-white")}
            >
              <option value="recent">Most Recent</option>
              <option value="growth">Highest Growth</option>
              <option value="volume">Highest Volume</option>
              <option value="score">Highest Score</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
                updateQuery({ source: opt.value, page: '1' });
              }}
              className={cn(
                sourceFilter === opt.value ? chipActive : chipBase,
                "h-8"
              )}
            >
              {opt.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const next = !savedOnly;
              setSavedOnly(next);
              updateQuery({ saved: next ? '1' : null, page: '1' });
            }}
            className={cn(savedOnly ? chipActive : chipBase, "h-8")}
          >
            My saved
          </button>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/65">
          {searchQuery && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-white/80">
              Search: {searchQuery}
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  updateQuery({ q: null, page: '1' });
                }}
                aria-label="Clear search"
                className="text-white/60 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          {sourceFilter !== 'all' && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-white/80">
              Source: {sourceFilter === 'google_trends' ? 'Google' : sourceFilter}
              <button
                type="button"
                onClick={() => {
                  setSourceFilter('all');
                  updateQuery({ source: null, page: '1' });
                }}
                aria-label="Clear source filter"
                className="text-white/60 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          {savedOnly && (
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1 text-white/80">
              Saved
              <button
                type="button"
                onClick={() => {
                  setSavedOnly(false);
                  updateQuery({ saved: null, page: '1' });
                }}
                aria-label="Clear saved filter"
                className="text-white/60 hover:text-white"
              >
                ×
              </button>
            </span>
          )}
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs font-semibold text-white/60 underline-offset-4 hover:text-white hover:underline"
          >
            Clear all
          </button>
        </div>
      )}

      {error && <div className="text-sm text-rose-300">{error}</div>}
      {loading && trends.length === 0 ? (
        <ListSkeleton gridClassName="md:grid-cols-2 lg:grid-cols-3" count={6} />
      ) : !loading && trends.length === 0 && !error ? (
        <EmptyState
          title="No trends found"
          description="Try clearing filters or searching for a different topic."
          primaryAction={{ label: "Clear filters", onClick: clearAllFilters }}
          secondaryAction={{ label: "Browse trends", href: "/trends" }}
        />
      ) : (
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
      )}

      <AppPagination
        currentPage={page}
        totalPages={totalPages}
        makeHref={(p) => {
          const params = new URLSearchParams(searchParams.toString());
          if (p > 1) params.set('page', String(p));
          else params.delete('page');
          const qs = params.toString();
          return qs ? `${pathname}?${qs}` : pathname;
        }}
        onNavigate={(p) => setPage(p)}
        className="text-sm"
      />
    </PageShell>
  );
}
