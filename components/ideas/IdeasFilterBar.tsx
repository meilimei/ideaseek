'use client';

import { ChangeEvent, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type IdeasFilterBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  sourceFilter: "all" | "reddit" | "trends" | "youtube" | "generated" | "curated";
  onSourceChange: (
    value: "all" | "reddit" | "trends" | "youtube" | "generated" | "curated",
  ) => void;
  sortBy: "newest" | "oldest" | "published" | "pinned" | "featured";
  onSortChange: (
    value: "newest" | "oldest" | "published" | "pinned" | "featured",
  ) => void;
  viewMode: "all" | "mine";
  onViewModeChange: (value: "all" | "mine") => void;
  difficultyFilter: "all" | "easy" | "medium" | "hard";
  onDifficultyChange: (value: "all" | "easy" | "medium" | "hard") => void;
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

const sourceOptions = [
  { label: "All", value: "all" },
  { label: "Reddit", value: "reddit" },
  { label: "Google Trends", value: "trends" },
  { label: "YouTube", value: "youtube" },
  { label: "AI Generator", value: "generated" },
  { label: "Curated", value: "curated" },
] as const;

const difficultyOptions = [
  { label: "All", value: "all" },
  { label: "Easy (1-2)", value: "easy" },
  { label: "Medium (3)", value: "medium" },
  { label: "Hard (4-5)", value: "hard" },
] as const;

const sortOptions = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
  { label: "Published", value: "published" },
  { label: "Pinned", value: "pinned" },
  { label: "Featured", value: "featured" },
] as const;

export default function IdeasFilterBar({
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
}: IdeasFilterBarProps) {
  const [showMore, setShowMore] = useState(false);

  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 shadow-soft backdrop-blur sm:p-4 space-y-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between lg:flex-nowrap lg:gap-4">
        <form
          className="relative w-full flex-1 min-w-[320px]"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <span className="text-sm">🔍</span>
          </span>
          <Input
            value={searchQuery}
            onChange={handleSearch}
            placeholder="Search ideas…"
            className="h-10 w-full pl-10 pr-3 text-sm"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap lg:justify-end lg:gap-3">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-nowrap">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(e) =>
                onSortChange(
                  e.target.value as
                    | "newest"
                    | "oldest"
                    | "published"
                    | "pinned"
                    | "featured",
                )
              }
              className="rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-sm text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-ring/40 shrink-0"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 flex-nowrap">
            <Button
              type="button"
              variant={viewMode === "all" ? "pill" : "ghostPill"}
              onClick={() => onViewModeChange("all")}
              className="px-3 shrink-0"
            >
              All ideas
            </Button>
            <Button
              type="button"
              variant={viewMode === "mine" ? "pill" : "ghostPill"}
              onClick={() => onViewModeChange("mine")}
              className="px-3 shrink-0"
            >
              Saved
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full border-border/60 px-3 text-xs shrink-0"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? "Hide filters" : "More filters"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="rounded-full border-border/60 px-3 text-sm shrink-0"
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {sourceOptions.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={sourceFilter === opt.value ? "pill" : "ghostPill"}
            onClick={() =>
              onSourceChange(
                opt.value as
                  | "all"
                  | "reddit"
                  | "trends"
                  | "youtube"
                  | "generated"
                  | "curated",
              )
            }
            className="px-3 py-1 text-xs"
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {showMore && (
        <div className="flex flex-wrap items-center gap-1.5">
          {difficultyOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={difficultyFilter === opt.value ? "pill" : "ghostPill"}
              onClick={() =>
                onDifficultyChange(opt.value as "all" | "easy" | "medium" | "hard")
              }
              className="px-3 py-1 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              className="flex items-center gap-2 bg-card/70 text-foreground"
            >
              <span>{chip.label}</span>
              <button
                type="button"
                onClick={chip.onRemove}
                className="text-muted-foreground transition hover:text-foreground"
                aria-label={`Remove ${chip.label}`}
              >
                ×
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="rounded-full px-3 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="inline-flex items-center gap-2">
          <Badge className="bg-background/50 text-foreground">Total</Badge>
          <span className="text-foreground">{totalCount} ideas</span>
        </div>
        {!isDefaultState && (
          <span className="text-[11px] leading-tight text-muted-foreground">
            Reset clears search & filters.
          </span>
        )}
      </div>
    </div>
  );
}
