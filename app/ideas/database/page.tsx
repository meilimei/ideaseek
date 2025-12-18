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
  difficulty: number | null;
  market_size: string | null;
  demand_strength?: string | null;
  source_type: string | null;
  source_url: string | null;
  created_at: string | null;
  created_by: string | null;
};

export default function IdeasDatabasePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') ?? '');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>(
    (searchParams.get('sort') as 'newest' | 'oldest') ?? 'newest',
  );
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'reddit' | 'trends' | 'youtube' | 'generated' | 'curated'
  >(
    (searchParams.get('source') as
      | 'all'
      | 'reddit'
      | 'trends'
      | 'youtube'
      | 'generated'
      | 'curated') ?? 'all',
  );
  const [difficultyFilter, setDifficultyFilter] = useState<
    'all' | 'easy' | 'medium' | 'hard'
  >(
    (searchParams.get('difficulty') as 'all' | 'easy' | 'medium' | 'hard') ?? 'all',
  );
  const [viewMode, setViewMode] = useState<'all' | 'mine'>(
    (searchParams.get('view') as 'all' | 'mine') ?? 'all',
  );
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const isDefaultState =
    !searchQuery &&
    sourceFilter === 'all' &&
    difficultyFilter === 'all' &&
    sortBy === 'newest' &&
    viewMode === 'all';
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get('page') ?? 1) || 1,
  );
  const PAGE_SIZE = 10;
  const handleResetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setDifficultyFilter('all');
    setSortBy('newest');
    setViewMode('all');
    setCurrentPage(1);
    router.replace(pathname);
  };
  const scrollToListTop = useCallback(() => {
    if (listTopRef.current) {
      listTopRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, []);
  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);
      const params = new URLSearchParams(searchParams.toString());
      if (page > 1) {
        params.set('page', String(page));
      } else {
        params.delete('page');
      }
      router.replace(`${pathname}?${params.toString()}`);
      scrollToListTop();
    },
    [pathname, router, scrollToListTop, searchParams],
  );

  useEffect(() => {
    async function fetchIdeas() {
      try {
        const res = await fetch('/api/ideas');
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
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
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
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((idea) => {
        const src = idea.source_type ?? 'curated';
        return src === sourceFilter;
      });
    }
    // Difficulty filter
    if (difficultyFilter !== 'all') {
      filtered = filtered.filter((idea) => {
        const d = idea.difficulty ?? null;
        if (d == null) return false;
        if (difficultyFilter === 'easy') return d >= 1 && d <= 2;
        if (difficultyFilter === 'medium') return d === 3;
        if (difficultyFilter === 'hard') return d >= 4;
        return true;
      });
    }
    // View mode filter
    filtered = filtered.filter((idea) => {
      if (viewMode === 'all') return true;
      if (!currentUserId) return false;
      return idea.created_by === currentUserId;
    });
    // Sort.
    if (sortBy === 'newest') {
      return filtered;
    } else {
      return filtered.slice().reverse();
    }
  }, [
    ideas,
    searchQuery,
    sortBy,
    ideaOfTheDay,
    sourceFilter,
    difficultyFilter,
    viewMode,
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

  useEffect(() => {
    handlePageChange(1);
  }, [
    searchQuery,
    sourceFilter,
    difficultyFilter,
    sortBy,
    viewMode,
    currentUserId,
    handlePageChange,
  ]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (difficultyFilter !== 'all') params.set('difficulty', difficultyFilter);
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (viewMode !== 'all') params.set('view', viewMode);
    if (currentPage > 1) params.set('page', String(currentPage));
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, sourceFilter, difficultyFilter, sortBy, viewMode, currentPage]);

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
      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((card) => (
          <div
            key={card}
            className="rounded-2xl border border-amber-100/70 bg-white/70 p-4 shadow-sm backdrop-blur"
          >
            <div className="h-4 w-16 rounded-full bg-amber-100" />
            <div className="mt-3 h-3 w-24 rounded-full bg-gray-100" />
            <div className="mt-2 h-16 rounded-xl bg-gradient-to-br from-amber-50 via-white to-indigo-50" />
          </div>
        ))}
      </div>

      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => handlePageChange(1)}
        sourceFilter={sourceFilter}
        onSourceChange={(v) => {
          setSourceFilter(v);
          handlePageChange(1);
        }}
        sortBy={sortBy}
        onSortChange={(v) => {
          setSortBy(v);
          handlePageChange(1);
        }}
        viewMode={viewMode}
        onViewModeChange={(v) => {
          setViewMode(v);
          handlePageChange(1);
        }}
        difficultyFilter={difficultyFilter}
        onDifficultyChange={(v) => {
          setDifficultyFilter(v);
          handlePageChange(1);
        }}
        onReset={handleResetFilters}
        isDefaultState={isDefaultState}
        totalCount={filteredIdeas.length}
      />

      {/* Idea of the Day spotlight */}
      {ideaOfTheDay && (
        <div ref={listTopRef}>
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
