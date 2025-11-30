// Improved Ideas Database page inspired by IdeaBrowser.
// This page fetches ideas from our API and renders a hero section,
// filtering tabs, an "Idea of the Day" spotlight card, and the rest of the ideas.
// It attempts to mirror the structure of https://www.ideabrowser.com/database
// with a focus on clear copy and basic styling. You can extend the functionality
// by adding real filters, sorting, and categories.

'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

type Idea = {
  id: string;
  title: string;
  one_liner: string | null;
  description: string | null;
  tags: string[] | null;
  difficulty: number | null;
  market_size: string | null;
  demand_strength?: string | null;
};

export default function IdeasDatabasePage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  useEffect(() => {
    async function fetchIdeas() {
      try {
        const res = await fetch('/api/ideas');
        if (!res.ok) {
          throw new Error('Failed to fetch ideas');
        }
        const json = await res.json();
        setIdeas(json.items);
      } catch (err: any) {
        setError(err.message ?? 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchIdeas();
  }, []);

  // Pick the first idea as "Idea of the Day".
  const ideaOfTheDay = ideas.length > 0 ? ideas[0] : null;

  const filteredIdeas = useMemo(() => {
    let filtered = ideas.slice();
    // Filter out the idea of the day from the list.
    if (ideaOfTheDay) {
      filtered = filtered.filter((i) => i.id !== ideaOfTheDay.id);
    }
    // Search by keyword.
    const keyword = search.trim().toLowerCase();
    if (keyword) {
      filtered = filtered.filter((idea) => {
        const inTitle = idea.title.toLowerCase().includes(keyword);
        const inOneLiner = idea.one_liner?.toLowerCase().includes(keyword);
        const inTags = idea.tags?.some((tag) =>
          tag.toLowerCase().includes(keyword)
        );
        return inTitle || inOneLiner || inTags;
      });
    }
    // Sort.
    if (sortBy === 'newest') {
      return filtered;
    } else {
      return filtered.slice().reverse();
    }
  }, [ideas, search, sortBy, ideaOfTheDay]);

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
      <nav className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          {/* Placeholder filter tabs. These are non‑functional but give the page context similar to IdeaBrowser */}
          <button className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">For You (BETA)</button>
          <button className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Interested</button>
          <button className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Saved</button>
          <button className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Building</button>
          <button className="px-3 py-1 rounded-full bg-gray-100 text-gray-700">Hidden</button>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">{ideas.length} ideas</span>
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
      </nav>

      {/* Search input */}
      <div className="flex">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ideas..."
          className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {/* Idea of the Day spotlight */}
      {ideaOfTheDay && (
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
      )}

      {/* Ideas list */}
      <section className="space-y-4">
        {filteredIdeas.map((idea) => (
          <Link
            href={`/ideas/${idea.id}`}
            key={idea.id}
            className="block border rounded-xl p-4 hover:shadow-sm transition bg-white"
          >
            <h3 className="text-lg font-semibold mb-1">{idea.title}</h3>
            {idea.one_liner && (
              <p className="text-gray-700 mb-2">{idea.one_liner}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-gray-600">
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
  );
}