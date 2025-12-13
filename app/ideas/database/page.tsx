// Improved Ideas Database page inspired by IdeaBrowser.
// This page fetches ideas from our API and renders a hero section,
// filtering tabs, an "Idea of the Day" spotlight card, and the rest of the ideas.
// It attempts to mirror the structure of https://www.ideabrowser.com/database
// with a focus on clear copy and basic styling. You can extend the functionality
// by adding real filters, sorting, and categories.

'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseBrowserClient';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [sourceFilter, setSourceFilter] = useState<
    'all' | 'reddit' | 'trends' | 'youtube' | 'generated' | 'curated'
  >('all');
  const [difficultyFilter, setDifficultyFilter] = useState<
    'all' | 'easy' | 'medium' | 'hard'
  >('all');
  const [viewMode, setViewMode] = useState<'all' | 'mine'>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const listTopRef = useRef<HTMLDivElement | null>(null);
  const isDefaultState =
    !searchQuery &&
    sourceFilter === 'all' &&
    difficultyFilter === 'all' &&
    sortBy === 'newest' &&
    viewMode === 'all';
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;
  const handleResetFilters = () => {
    setSearchQuery('');
    setSourceFilter('all');
    setDifficultyFilter('all');
    setSortBy('newest');
    setViewMode('all');
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
      scrollToListTop();
    },
    [scrollToListTop],
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
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Hero section */}
      <header className="text-center space-y-3">
        <h1 className="text-4xl font-bold">Find Your Next Startup Idea</h1>
        <p className="text-gray-600">
          Browse validated opportunities with research, market analysis, execution plans and more.
        </p>
      </header>

      {/* Filter & sort bar */}
      <nav className="space-y-3 border-b pb-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm text-gray-600">
              {filteredIdeas.length} ideas{' '}
              {searchQuery && (
                <span className="text-sm text-gray-500">
                  matching &quot;{searchQuery}&quot;
                </span>
              )}
            </div>
            <label className="text-sm text-gray-600">
              Sort by:&nbsp;
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
                className="rounded-md border px-2 py-1 text-sm bg-white"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </label>
          </div>

          <div className="flex flex-col w-full md:w-auto gap-2">
            <div className="flex gap-2 w-full md:w-auto">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ideas..."
                className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="px-4 py-2 rounded-lg border bg-gray-100 text-sm hover:bg-gray-200"
              >
                Search
              </button>
              {!isDefaultState && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="px-4 py-2 rounded-lg border bg-gray-50 text-sm hover:bg-gray-100"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="inline-flex rounded-full border text-xs overflow-hidden self-start md:self-end">
              <button
                type="button"
                onClick={() => setViewMode('all')}
                className={`px-3 py-1 ${
                  viewMode === 'all'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                All ideas
              </button>
              <button
                type="button"
                onClick={() => setViewMode('mine')}
                className={`px-3 py-1 ${
                  viewMode === 'mine'
                    ? 'bg-black text-white'
                    : 'bg-white text-gray-700'
                }`}
              >
                My saved
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'All', value: 'all' },
            { label: 'Reddit', value: 'reddit' },
            { label: 'Google Trends', value: 'trends' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'AI Generator', value: 'generated' },
            { label: 'Curated', value: 'curated' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setSourceFilter(
                  opt.value as
                    | 'all'
                    | 'reddit'
                    | 'trends'
                    | 'youtube'
                    | 'generated'
                    | 'curated',
                )
              }
              className={`px-3 py-1 rounded-full border text-xs cursor-pointer ${
                sourceFilter === opt.value
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-white text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { label: 'All', value: 'all' },
            { label: 'Easy (1-2)', value: 'easy' },
            { label: 'Medium (3)', value: 'medium' },
            { label: 'Hard (4-5)', value: 'hard' },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() =>
                setDifficultyFilter(
                  opt.value as 'all' | 'easy' | 'medium' | 'hard',
                )
              }
              className={`px-3 py-1 rounded-full border text-xs cursor-pointer ${
                difficultyFilter === opt.value
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-white text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Idea of the Day spotlight */}
      {ideaOfTheDay && (
        <div ref={listTopRef}>
          <section className="rounded-xl bg-indigo-50 p-6 border shadow-sm">
            <h2 className="text-xl font-semibold mb-2">
              Idea of the Day
            </h2>
            <h3 className="text-2xl font-bold mb-2">
              {ideaOfTheDay.title}
            </h3>
            {ideaOfTheDay.one_liner && (
              <p className="text-gray-800 mb-2">
                {ideaOfTheDay.one_liner}
              </p>
            )}
            {/* Use the description as teaser. Ensure we show truncated content */}
            {ideaOfTheDay.description && (
              <p className="text-gray-700 mb-4">
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
          <section className="space-y-4 mt-4">
            {pagedIdeas.map((idea) => (
              <Link
                href={`/ideas/${idea.id}`}
                key={idea.id}
                className="block border rounded-xl p-4 hover:shadow-sm transition bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold mb-1">{idea.title}</h3>
                  <div className="text-xs text-gray-500">
                    {idea.created_at
                      ? new Date(idea.created_at).toLocaleDateString()
                      : ''}
                  </div>
                </div>
                {idea.one_liner && (
                  <p className="text-gray-700 mb-2">{idea.one_liner}</p>
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
    </div>
  );
}
