// Improved Ideas Database page inspired by IdeaBrowser.
// This page fetches ideas from our API and renders a hero section,
// filtering tabs, an "Idea of the Day" spotlight card, and the rest of the ideas.
// It attempts to mirror the structure of https://www.ideabrowser.com/database
// with a focus on clear copy and basic styling. You can extend the functionality
// by adding real filters, sorting, and categories.

'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseBrowserClient';
import PageShell from '@/components/site/PageShell';
import FilterBar from './FilterBar';

type Idea = {
  id: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  score?: number | null;
  status?: string | null;
  status_reason?: string | null;
  difficulty: number | null;
  market_size: string | null;
  demand_strength?: string | null;
  source_type: string | null;
  source_url: string | null;
  created_at: string | null;
  created_by: string | null;
  published?: boolean | null;
  pinned?: boolean | null;
  featured?: boolean | null;
};

type IdeaStats = {
  totalIdeas: number;
  publishedIdeas: number;
  newLast7d: number;
  sourceCounts: Record<string, number>;
  mySavedIdeas?: number;
};

function StatCard({
  label,
  value,
  accent,
  subtext,
}: {
  label: string;
  value: number | string;
  accent: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div
        className={`mt-3 rounded-xl bg-gradient-to-br ${accent} px-3 py-4 text-3xl font-bold text-gray-900`}
      >
        {value}
      </div>
      {subtext && <div className="mt-2 text-sm text-gray-600">{subtext}</div>}
    </div>
  );
}

export default function IdeasDatabasePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<IdeaStats | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const currentSort =
    (searchParams.get('sort') as
      | 'newest'
      | 'oldest'
      | 'published'
      | 'pinned'
      | 'featured') ?? 'newest';
  const currentSource =
    (searchParams.get('source') as
      | 'all'
      | 'reddit'
      | 'trends'
      | 'youtube'
      | 'generated'
      | 'curated') ?? 'all';
  const currentDifficulty =
    (searchParams.get('difficulty') as 'all' | 'easy' | 'medium' | 'hard') ?? 'all';
  const currentView = (searchParams.get('view') as 'all' | 'mine') ?? 'all';
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  const isDefaultState =
    !searchQuery &&
    currentSource === 'all' &&
    currentDifficulty === 'all' &&
    currentSort === 'newest' &&
    currentView === 'all';
  const PAGE_SIZE = 10;
  const handleResetFilters = () => {
    setSearchQuery('');
    updateQuery(
      {
        q: null,
        source: null,
        difficulty: null,
        sort: null,
        view: null,
        page: null,
      },
      { resetPage: true },
    );
  };
  const scrollToListTop = useCallback(() => {
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, []);
  const updateQuery = useCallback(
    (
      patch: Record<string, string | null>,
      options: { resetPage?: boolean } = {},
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value === null || value === '') {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      if (options.resetPage) {
        params.set('page', '1');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      if (page > 1) {
        params.set('page', String(page));
      } else {
        params.delete('page');
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: true });
      scrollToListTop();
    },
    [pathname, router, scrollToListTop, searchParams],
  );

  useEffect(() => {
    async function fetchIdeas() {
      try {
        const params = new URLSearchParams();
        if (currentSort) params.set('sort', currentSort);
        const res = await fetch(`/api/ideas?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to fetch ideas');
        }
        const json: { items: Idea[] } = await res.json();
        setIdeas(json.items);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
      } finally {
        setLoading(false);
      }
    }
    fetchIdeas();
  }, [currentSort]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    setSearchQuery(searchParams.get('q') ?? '');
  }, [searchParams]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/ideas/stats', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as IdeaStats;
        setStats(json);
      } catch {
        // ignore
      }
    }
    fetchStats();
  }, []);

  // Pick the first idea as "Idea of the Day".
  const ideaOfTheDay = ideas.length > 0 ? ideas[0] : null;

  const filteredIdeas = useMemo(() => {
    let filtered = ideas.slice();
    // Filter out the idea of the day from the list.
    if (ideaOfTheDay) {
      filtered = filtered.filter((i) => i.id !== ideaOfTheDay.id);
    }
    const sq = searchQuery.trim().toLowerCase();
    if (sq) {
      filtered = filtered.filter((idea) => {
        const inTitle = idea.title.toLowerCase().includes(sq);
        const inOneLiner = idea.one_liner?.toLowerCase().includes(sq);
        const inTags = idea.tags?.some((tag) =>
          tag.toLowerCase().includes(sq)
        );
        return inTitle || inOneLiner || inTags;
      });
    }
    // Source filter
    if (currentSource !== 'all') {
      filtered = filtered.filter((idea) => {
        const src = idea.source_type ?? 'curated';
        return src === currentSource;
      });
    }
    // Difficulty filter
    if (currentDifficulty !== 'all') {
      filtered = filtered.filter((idea) => {
        const d = idea.difficulty ?? null;
        if (d == null) return false;
        if (currentDifficulty === 'easy') return d >= 1 && d <= 2;
        if (currentDifficulty === 'medium') return d === 3;
        if (currentDifficulty === 'hard') return d >= 4;
        return true;
      });
    }
    // View mode filter
    filtered = filtered.filter((idea) => {
      if (currentView === 'all') return true;
      if (!currentUserId) return false;
      return idea.created_by === currentUserId;
    });
    const sorted = filtered.slice().sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      switch (currentSort) {
        case 'oldest':
          return dateA - dateB;
        case 'published': {
          const pa = a.published ? 1 : 0;
          const pb = b.published ? 1 : 0;
          if (pb !== pa) return pb - pa;
          return dateB - dateA;
        }
        case 'pinned': {
          const pa = a.pinned ? 1 : 0;
          const pb = b.pinned ? 1 : 0;
          if (pb !== pa) return pb - pa;
          return dateB - dateA;
        }
        case 'featured': {
          const pa = a.featured ? 1 : 0;
          const pb = b.featured ? 1 : 0;
          if (pb !== pa) return pb - pa;
          return dateB - dateA;
        }
        case 'newest':
        default:
          return dateB - dateA;
      }
    });

    return sorted;
  }, [
    ideas,
    searchQuery,
    currentSort,
    ideaOfTheDay,
    currentSource,
    currentDifficulty,
    currentView,
    currentUserId,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredIdeas.length / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const pagedIdeas = filteredIdeas.slice(startIndex, endIndex);

  const sourceLabel = (source: string | null) => {
    switch (source) {
      case 'reddit':
        return 'Reddit';
      case 'trends':
        return 'Google Trends';
      case 'youtube':
        return 'YouTube';
      case 'generated':
        return 'AI Generator';
      default:
        return 'Curated';
    }
  };

  if (loading) {
    return <div className="p-6">Loading ideas...</div>;
  }
  if (error) {
    return (
      <div className="p-6 text-red-500">
        Error loading ideas: {error}
      </div>
    );
  }

  return (
    <PageShell
      title="Find Your Next Startup Idea"
      description="Browse validated opportunities with research, market analysis, execution plans, and more."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total ideas"
          value={stats?.totalIdeas ?? 0}
          accent="from-amber-50 via-white to-indigo-50"
        />
        <StatCard
          label="Published"
          value={stats?.publishedIdeas ?? 0}
          accent="from-green-50 via-white to-emerald-50"
        />
        <StatCard
          label="New (7d)"
          value={stats?.newLast7d ?? 0}
          accent="from-blue-50 via-white to-indigo-50"
        />
        {typeof stats?.mySavedIdeas === 'number' && (
          <StatCard
            label="My saved"
            value={stats.mySavedIdeas}
            accent="from-purple-50 via-white to-indigo-50"
            subtext="Ideas you've bookmarked"
          />
        )}
        <div className="rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
          <div className="text-sm font-semibold text-gray-900">Sources</div>
          <div className="mt-3 space-y-2 text-sm text-gray-700">
            {stats?.sourceCounts
              ? Object.entries(stats.sourceCounts).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between">
                    <span className="capitalize">{src || 'unknown'}</span>
                    <span className="text-gray-900 font-semibold">{count}</span>
                  </div>
                ))
              : [1, 2, 3].map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between text-gray-400"
                  >
                    <span className="h-3 w-20 rounded-full bg-gray-100" />
                    <span className="h-3 w-6 rounded-full bg-gray-100" />
                  </div>
                ))}
          </div>
        </div>
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          updateQuery({ q: searchQuery || null }, { resetPage: true });
          scrollToListTop();
        }}
        sourceFilter={currentSource}
        onSourceChange={(v) => {
          updateQuery({ source: v }, { resetPage: true });
          scrollToListTop();
        }}
        sortBy={currentSort}
        onSortChange={(v) => {
          if (v === currentSort) return;
          updateQuery({ sort: v }, { resetPage: true });
          scrollToListTop();
        }}
        viewMode={currentView}
        onViewModeChange={(v) => {
          updateQuery({ view: v }, { resetPage: true });
          scrollToListTop();
        }}
        difficultyFilter={currentDifficulty}
        onDifficultyChange={(v) => {
          updateQuery({ difficulty: v }, { resetPage: true });
          scrollToListTop();
        }}
        onReset={handleResetFilters}
        isDefaultState={isDefaultState}
        totalCount={filteredIdeas.length}
        activeChips={[
          ...(searchQuery
            ? [
                {
                  label: `Search: ${searchQuery}`,
                  key: 'search',
                  onRemove: () => {
                    setSearchQuery('');
                    updateQuery({ q: null }, { resetPage: true });
                    scrollToListTop();
                  },
                },
              ]
            : []),
          ...(currentSource !== 'all'
            ? [
                {
                  label: `Source: ${sourceLabel(currentSource)}`,
                  key: 'source',
                  onRemove: () => {
                    updateQuery({ source: null }, { resetPage: true });
                    scrollToListTop();
                  },
                },
              ]
            : []),
          ...(currentDifficulty !== 'all'
            ? [
                {
                  label: `Difficulty: ${currentDifficulty}`,
                  key: 'difficulty',
                  onRemove: () => {
                    updateQuery({ difficulty: null }, { resetPage: true });
                    scrollToListTop();
                  },
                },
              ]
            : []),
          ...(currentSort !== 'newest'
            ? [
                {
                  label: `Sort: ${currentSort}`,
                  key: 'sort',
                  onRemove: () => {
                    updateQuery({ sort: null }, { resetPage: true });
                    scrollToListTop();
                  },
                },
              ]
            : []),
          ...(currentView !== 'all'
            ? [
                {
                  label: `View: ${currentView}`,
                  key: 'view',
                  onRemove: () => {
                    updateQuery({ view: null }, { resetPage: true });
                    scrollToListTop();
                  },
                },
              ]
            : []),
        ]}
        onClearAll={() => {
          handleResetFilters();
        }}
      />

      {/* Idea of the Day spotlight */}
      {ideaOfTheDay && (
        <div ref={listTopRef}>
          <div id="ideas-top" />
          <section className="rounded-2xl border border-indigo-100 bg-white/80 p-6 shadow-sm backdrop-blur">
            <h2 className="mb-2 text-xl font-semibold">
              Idea of the Day
            </h2>
            <h3 className="mb-2 text-2xl font-bold">
              {ideaOfTheDay.title}
            </h3>
            {ideaOfTheDay.one_liner && (
              <p className="mb-2 text-gray-800">
                {ideaOfTheDay.one_liner}
              </p>
            )}
            {/* Use the description as teaser. Ensure we show truncated content */}
            {ideaOfTheDay.description && (
              <p className="mb-4 text-gray-700">
                {ideaOfTheDay.description.slice(0, 200)}...
              </p>
            )}
            <Link
              href={`/ideas/${ideaOfTheDay.id}`}
              className="text-indigo-600 underline"
            >
              View Full Report
            </Link>
          </section>

          {/* Ideas list */}
          <section className="mt-4 space-y-4">
            {pagedIdeas.map((idea) => (
              <Link
                href={`/ideas/${idea.id}`}
                key={idea.id}
                className="block rounded-xl border bg-white p-4 transition hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="mb-1 text-lg font-semibold">{idea.title}</h3>
                  <div className="text-xs text-gray-500">
                    {idea.created_at
                      ? new Date(idea.created_at).toLocaleDateString()
                      : ''}
                  </div>
                </div>
                {idea.one_liner && (
                  <p className="mb-2 text-gray-700">{idea.one_liner}</p>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  {idea.status && (
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700 border border-indigo-100">
                      {idea.status}
                    </span>
                  )}
                  {idea.score != null && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700 border border-amber-100">
                      Score: {idea.score.toFixed(1)} / 5
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 text-sm text-gray-600">
                  <span className="px-2 py-0.5 rounded-full border text-xs">
                    Source: {sourceLabel(idea.source_type)}
                  </span>
                  {idea.tags?.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-full border text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {idea.difficulty != null && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                      Difficulty: {idea.difficulty}
                    </span>
                  )}
                  {idea.market_size && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                      Market: {idea.market_size}
                    </span>
                  )}
                  {idea.demand_strength && (
                    <span className="px-2 py-0.5 rounded-full bg-gray-100 text-xs">
                      Demand: {idea.demand_strength}
                    </span>
                  )}
                </div>
              </Link>
            ))}
            {filteredIdeas.length === 0 && (
              <p className="text-gray-500">
                No ideas match your search. Try a different keyword.
              </p>
            )}
          </section>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-6 flex flex-col items-center justify-center gap-3 text-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`px-3 py-1 rounded-full border ${
              currentPage === 1
                ? 'text-gray-400 border-gray-200 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Previous
          </button>
          <span className="text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              handlePageChange(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className={`px-3 py-1 rounded-full border ${
              currentPage === totalPages
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
              (page) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => handlePageChange(page)}
                  className={`px-3 py-1 rounded-full border ${
                    currentPage === page
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {page}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
