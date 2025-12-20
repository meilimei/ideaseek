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
import SectionTitle from '@/components/site/SectionTitle';
import IdeaCard from '@/components/ideas/IdeaCard';
import IdeaCardSkeleton from '@/components/ideas/IdeaCardSkeleton';
import IdeasToolbar from '@/components/ideas/IdeasToolbar';
import IdeasFiltersSheet from '@/components/ideas/IdeasFiltersSheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

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
    <Card className="h-full bg-card/70 p-4 shadow-soft backdrop-blur">
      <div className="text-sm font-semibold text-foreground/80">{label}</div>
      <div
        className={`mt-3 rounded-xl bg-gradient-to-br ${accent} px-3 py-4 text-3xl font-bold text-foreground`}
      >
        {value}
      </div>
      {subtext && <div className="mt-2 text-sm text-muted-foreground">{subtext}</div>}
    </Card>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
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
  const currentPage = Math.max(1, Number(searchParams.get('page') ?? '1') || 1);
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

  const displayedCount = filteredIdeas.length + (ideaOfTheDay ? 1 : 0);
  const isEmpty = !loading && filteredIdeas.length === 0;

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isInputLike =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.isContentEditable;
        if (isInputLike) return;
      }

      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setFiltersOpen(true);
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setFiltersOpen(true);
        return;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <PageShell
      title="Find Your Next Startup Idea"
      description="Browse validated opportunities with research, market analysis, execution plans, and more."
    >
      {error && (
        <Card className="border-destructive/60 bg-destructive/10 p-4 text-destructive-foreground shadow-soft">
          <div className="font-semibold">Error loading ideas</div>
          <div className="text-sm text-destructive-foreground/80">{error}</div>
        </Card>
      )}

      <SectionTitle
        title="Idea library"
        description="Browse validated opportunities sourced from trends, communities, and curated research."
        actions={<div className="text-sm text-muted-foreground">{displayedCount} ideas</div>}
      />

      <IdeasToolbar
        totalCount={displayedCount}
        sortValue={currentSort}
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
        onOpenFilters={() => setFiltersOpen(true)}
      />

      <IdeasFiltersSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
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
        totalCount={displayedCount}
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

      <div ref={listTopRef} className="h-0" />

      {ideaOfTheDay && (
        <section className="space-y-3">
          <SectionTitle
            title="Idea of the Day"
            description="A spotlighted opportunity worth reading first."
            actions={
              <Button variant="pill" asChild>
                <Link href={`/ideas/${ideaOfTheDay.id}`}>View full report</Link>
              </Button>
            }
          />
          <IdeaCard
            idea={ideaOfTheDay}
            href={`/ideas/${ideaOfTheDay.id}`}
            sourceLabel={`Source: ${sourceLabel(ideaOfTheDay.source_type)}`}
          />
        </section>
      )}

      <section className="space-y-3">
        <SectionTitle
          title="All ideas"
          description="Recent opportunities with tags, difficulty, and demand notes."
        />
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, idx) => (
              <IdeaCardSkeleton key={idx} />
            ))}
          </div>
        ) : !isEmpty ? (
          <div className="grid gap-4 md:grid-cols-2">
            {pagedIdeas.map((idea) => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                href={`/ideas/${idea.id}`}
                sourceLabel={`Source: ${sourceLabel(idea.source_type)}`}
              />
            ))}
          </div>
        ) : (
          <Card className="border border-border/60 bg-card/60 p-8 text-center shadow-soft">
            <p className="text-base font-semibold text-foreground">
              No ideas match your search.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Try broadening keywords or clearing filters to see more opportunities.
            </p>
            <div className="mt-4 flex justify-center">
              <Button variant="pill" onClick={handleResetFilters}>
                Clear filters
              </Button>
            </div>
          </Card>
        )}
      </section>

      {totalPages > 1 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 text-sm text-muted-foreground shadow-soft">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              variant="ghostPill"
              onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="shrink-0 px-4 py-2 text-xs md:text-sm bg-secondary/10 border border-border/50 hover:bg-secondary/20"
            >
              Previous
            </Button>
            <span className="text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              type="button"
              variant="ghostPill"
              onClick={() =>
                handlePageChange(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              className="shrink-0 px-4 py-2 text-xs md:text-sm bg-secondary/10 border border-border/50 hover:bg-secondary/20"
            >
              Next
            </Button>
          </div>
          {totalPages <= 7 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
                (page) => (
                  <Button
                    key={page}
                    type="button"
                    variant={currentPage === page ? 'pill' : 'ghostPill'}
                    onClick={() => handlePageChange(page)}
                    aria-current={currentPage === page ? 'page' : undefined}
                    className={cn(
                      'px-3 py-1 text-sm border border-border/50',
                      currentPage === page
                        ? 'bg-primary/15 border-primary/30 text-foreground'
                        : 'bg-secondary/10 text-muted-foreground hover:bg-secondary/20'
                    )}
                  >
                    {page}
                  </Button>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
