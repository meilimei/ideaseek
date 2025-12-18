'use client';

import { ChangeEvent } from 'react';

type FilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  sourceFilter: 'all' | 'reddit' | 'trends' | 'youtube' | 'generated' | 'curated';
  onSourceChange: (
    value: 'all' | 'reddit' | 'trends' | 'youtube' | 'generated' | 'curated',
  ) => void;
  sortBy: 'newest' | 'oldest' | 'published' | 'pinned' | 'featured';
  onSortChange: (
    value: 'newest' | 'oldest' | 'published' | 'pinned' | 'featured',
  ) => void;
  viewMode: 'all' | 'mine';
  onViewModeChange: (value: 'all' | 'mine') => void;
  difficultyFilter: 'all' | 'easy' | 'medium' | 'hard';
  onDifficultyChange: (value: 'all' | 'easy' | 'medium' | 'hard') => void;
  onReset: () => void;
  isDefaultState: boolean;
  totalCount: number;
  activeChips: Array<{
    label: string;
    key: string;
    onRemove: () => void;
  }>;
  onClearAll: () => void;
};

export default function FilterBar({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  sourceFilter,
  onSourceChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  difficultyFilter,
  onDifficultyChange,
  onReset,
  isDefaultState,
  totalCount,
  activeChips,
  onClearAll,
}: FilterBarProps) {
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200/80 bg-white/80 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <form
          className="relative w-full md:max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search ideas…"
            className="w-full rounded-lg border px-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
          />
        </form>

        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) =>
              onSortChange(
                e.target.value as
                  | 'newest'
                  | 'oldest'
                  | 'published'
                  | 'pinned'
                  | 'featured',
              )
            }
            className="rounded-lg border px-2 py-1 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="published">Published</option>
            <option value="pinned">Pinned</option>
            <option value="featured">Featured</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="self-start rounded-md px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 md:self-auto"
        >
          Reset
        </button>
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
              onSourceChange(
                opt.value as
                  | 'all'
                  | 'reddit'
                  | 'trends'
                  | 'youtube'
                  | 'generated'
                  | 'curated',
              )
            }
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
              sourceFilter === opt.value
                ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
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
              onDifficultyChange(opt.value as 'all' | 'easy' | 'medium' | 'hard')
            }
            className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${
              difficultyFilter === opt.value
                ? 'border-indigo-200 bg-indigo-100 text-indigo-700'
                : 'bg-white text-gray-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-gray-600">{totalCount} ideas</div>
        <div className="inline-flex overflow-hidden rounded-full border text-xs">
          <button
            type="button"
            onClick={() => onViewModeChange('all')}
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
            onClick={() => onViewModeChange('mine')}
            className={`px-3 py-1 ${
              viewMode === 'mine'
                ? 'bg-black text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            My saved
          </button>
        </div>
        {!isDefaultState && (
          <span className="text-xs text-gray-500">
            Reset clears all filters and search.
          </span>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.onRemove}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <span>{chip.label}</span>
              <span className="text-gray-400">×</span>
            </button>
          ))}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-semibold text-gray-700 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
