'use client';

import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type IdeasFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function IdeasFiltersSheet({
  open,
  onOpenChange,
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
}: IdeasFiltersSheetProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) {
      document.addEventListener("keydown", onKeyDown);
    }
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  const searchRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-pointer"
        aria-label="Close filters"
        onClick={() => onOpenChange(false)}
      />
      <div
        className="relative z-10 flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-border/60 bg-background/90 p-5 shadow-glow"
        onAnimationEnd={() => searchRef.current?.focus()}
        onTransitionEnd={() => searchRef.current?.focus()}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-foreground">Filters</div>
            <div className="text-xs text-muted-foreground">{totalCount} ideas</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full px-3 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>

        <form
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            onSearchSubmit();
          }}
        >
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            🔍
          </span>
          <Input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search ideas…"
            className="h-10 w-full pl-10 pr-3 text-sm"
          />
        </form>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(e) =>
                onSortChange(
                  e.target.value as IdeasFiltersSheetProps["sortBy"]
                )
              }
              className="rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-ring/40"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="published">Published</option>
              <option value="pinned">Pinned</option>
              <option value="featured">Featured</option>
            </select>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">Source</div>
            <div className="flex flex-wrap items-center gap-2">
              {sourceOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={sourceFilter === opt.value ? "pill" : "ghostPill"}
                  onClick={() =>
                    onSourceChange(
                      opt.value as IdeasFiltersSheetProps["sourceFilter"]
                    )
                  }
                  className="px-3 py-1 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-muted-foreground">View</div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={viewMode === "all" ? "pill" : "ghostPill"}
                onClick={() => onViewModeChange("all")}
                className="px-3 text-xs"
              >
                All ideas
              </Button>
              <Button
                type="button"
                variant={viewMode === "mine" ? "pill" : "ghostPill"}
                onClick={() => onViewModeChange("mine")}
                className="px-3 text-xs"
              >
                Saved
              </Button>
            </div>
          </div>

          <details className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
              More filters
            </summary>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {difficultyOptions.map((opt) => (
                <Button
                  key={opt.value}
                  type="button"
                  variant={difficultyFilter === opt.value ? "pill" : "ghostPill"}
                  onClick={() =>
                    onDifficultyChange(
                      opt.value as IdeasFiltersSheetProps["difficultyFilter"]
                    )
                  }
                  className="px-3 py-1 text-xs"
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </details>

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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="text-[11px]">
            Reset clears search & filters.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-full px-3 text-xs"
              onClick={onReset}
            >
              Reset
            </Button>
            <Button
              type="button"
              variant="pill"
              size="sm"
              className="px-3 text-xs"
              onClick={() => {
                onSearchSubmit();
                onOpenChange(false);
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
