'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type IdeaResult = {
  id: string;
  title: string;
  one_liner: string | null;
  tags: string[] | null;
  status: string | null;
  score: number | null;
  created_at: string;
};

type TrendResult = {
  id: string;
  slug: string | null;
  keyword: string | null;
  title: string | null;
  tags: string[] | null;
  status: string | null;
  score: number | null;
  last_snapshot_at: string | null;
};

type SearchResponse = {
  ideas: IdeaResult[];
  trends: TrendResult[];
  meta?: { tookMs?: number };
};

type CommandItem =
  | { type: 'idea'; data: IdeaResult }
  | { type: 'trend'; data: TrendResult }
  | { type: 'quick'; label: string; href: string };

const quickLinks: CommandItem[] = [
  { type: 'quick', label: 'Find Ideas', href: '/ideas/database' },
  { type: 'quick', label: 'Trends', href: '/trends' },
  { type: 'quick', label: 'Pricing', href: '/pricing' },
  { type: 'quick', label: 'Market Insights', href: '/market-insights' },
];

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse>({
    ideas: [],
    trends: [],
  });
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    const openListener = () => setOpen(true);
    window.addEventListener('open-command-palette', openListener as EventListener);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('open-command-palette', openListener as EventListener);
    };
  }, []);

  useEffect(() => {
    if (pathname.startsWith('/admin')) {
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults({ ideas: [], trends: [] });
      setActiveIndex(0);
      return;
    }
    if (!query.trim()) {
      setResults({ ideas: [], trends: [] });
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/search?q=${encodeURIComponent(query)}&limit=6`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          const json = (await res.json()) as SearchResponse;
          setResults(json);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open]);

  const items: CommandItem[] = useMemo(() => {
    const list: CommandItem[] = [...quickLinks];
    results.ideas.forEach((idea) => list.push({ type: 'idea', data: idea }));
    results.trends.forEach((trend) => list.push({ type: 'trend', data: trend }));
    return list;
  }, [results]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, open]);

  const goTo = (item: CommandItem) => {
    if (item.type === 'quick') {
      router.push(item.href);
    } else if (item.type === 'idea') {
      router.push(`/ideas/${item.data.id}`);
    } else {
      router.push(item.data.slug ? `/trends/${item.data.slug}` : `/trends?id=${item.data.id}`);
    }
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((idx) => Math.min(items.length - 1, idx + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((idx) => Math.max(0, idx - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) goTo(item);
    }
  };

  if (pathname.startsWith('/admin')) return null;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 px-4 py-10 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <span className="text-gray-400">🔍</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ideas and trends…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400"
              />
              <span className="text-[11px] text-gray-400">Esc</span>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!query && (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  Type to search
                </div>
              )}
              {query && loading && (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  Searching…
                </div>
              )}
              {query && !loading && items.length === quickLinks.length && (
                <div className="px-3 py-6 text-center text-sm text-gray-500">
                  No results
                </div>
              )}

              {items.map((item, idx) => {
                const isActive = idx === activeIndex;
                const baseClasses =
                  'flex cursor-pointer items-start gap-3 rounded-lg px-3 py-2 text-sm hover:bg-indigo-50';
                if (item.type === 'quick') {
                  return (
                    <div
                      key={`${item.type}-${item.label}-${idx}`}
                      className={`${baseClasses} ${isActive ? 'bg-indigo-50' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => goTo(item)}
                    >
                      <span className="text-gray-500">↗</span>
                      <div>
                        <div className="font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500">{item.href}</div>
                      </div>
                    </div>
                  );
                }

                if (item.type === 'idea') {
                  return (
                    <div
                      key={`idea-${item.data.id}`}
                      className={`${baseClasses} ${isActive ? 'bg-indigo-50' : ''}`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => goTo(item)}
                    >
                      <div className="h-6 w-6 rounded-full bg-amber-50 text-center text-xs leading-6 text-amber-700">
                        I
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {item.data.title}
                        </div>
                        {item.data.one_liner && (
                          <div className="text-xs text-gray-600 line-clamp-1">
                            {item.data.one_liner}
                          </div>
                        )}
                        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                          {item.data.tags?.slice(0, 3).map((t) => (
                            <span key={t} className="rounded-full border px-2 py-0.5">
                              {t}
                            </span>
                          ))}
                          {item.data.status && (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                              {item.data.status}
                            </span>
                          )}
                          {item.data.score != null && (
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                              {item.data.score.toFixed(1)} / 5
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={`trend-${item.data.id}`}
                    className={`${baseClasses} ${isActive ? 'bg-indigo-50' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => goTo(item)}
                  >
                    <div className="h-6 w-6 rounded-full bg-blue-50 text-center text-xs leading-6 text-blue-700">
                      T
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {item.data.title || item.data.keyword}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {item.data.tags?.slice(0, 3).map((t) => (
                          <span key={t} className="rounded-full border px-2 py-0.5">
                            {t}
                          </span>
                        ))}
                        {item.data.status && (
                          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                            {item.data.status}
                          </span>
                        )}
                        {item.data.score != null && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                            {item.data.score.toFixed(1)} / 5
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
