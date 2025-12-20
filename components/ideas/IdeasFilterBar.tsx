'use client';

import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

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
  const handleSearch = (e: ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  return (
    <div className="sticky top-16 z-10">
      <div className="rounded-2xl border border-border/60 bg-background/50 p-4 shadow-soft backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <form
            className="relative w-full md:max-w-xl"
            onSubmit={(e) => {
              e.preventDefault();
              onSearchSubmit();
            }}
          >
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              🔍
            </span>
            <Input
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search ideas…"
              className="h-11 w-full pl-10 pr-3"
            />
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
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
                className="rounded-xl border border-border/60 bg-card/60 px-3 py-2 text-sm text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-ring/40"
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "all" ? "pill" : "ghostPill"}
                onClick={() => onViewModeChange("all")}
                className={cn("px-3")}
              >
                All ideas
              </Button>
              <Button
                type="button"
                variant={viewMode === "mine" ? "pill" : "ghostPill"}
                onClick={() => onViewModeChange("mine")}
                className={cn("px-3")}
              >
                Saved
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              className="rounded-full border-border/60 px-3"
              onClick={onReset}
            >
              Reset
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
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

        <div className="mt-3 flex flex-wrap items-center gap-2">
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

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Badge className="bg-background/50 text-foreground">Total</Badge>
            <span className="text-foreground">{totalCount} ideas</span>
          </div>
          {!isDefaultState && (
            <span className="text-xs text-muted-foreground">
              Reset clears search & filters.
            </span>
          )}
        </div>

        {activeChips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
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
      </div>
    </div>
  );
}
