'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type IdeasToolbarProps = {
  totalCount: number;
  filteredCount?: number;
  activeFiltersCount?: number;
  sortValue: "newest" | "oldest" | "published" | "pinned" | "featured";
  onSortChange: (value: IdeasToolbarProps["sortValue"]) => void;
  onOpenFilters: () => void;
  viewMode?: "all" | "mine";
  onViewModeChange?: (value: "all" | "mine") => void;
};

export default function IdeasToolbar({
  totalCount,
  filteredCount,
  activeFiltersCount = 0,
  sortValue,
  onSortChange,
  onOpenFilters,
  viewMode = "all",
  onViewModeChange,
}: IdeasToolbarProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-3 shadow-soft backdrop-blur lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-foreground">All ideas</span>
        <span className="rounded-full border border-border/60 bg-secondary/20 px-2.5 py-0.5 text-xs text-muted-foreground">
          {filteredCount ?? totalCount}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
        {onViewModeChange && (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={viewMode === "all" ? "pill" : "ghostPill"}
              onClick={() => onViewModeChange("all")}
              className="px-3 text-xs shrink-0"
            >
              All
            </Button>
            <Button
              type="button"
              variant={viewMode === "mine" ? "pill" : "ghostPill"}
              onClick={() => onViewModeChange("mine")}
              className="px-3 text-xs shrink-0"
            >
              Saved
            </Button>
          </div>
        )}

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span>Sort</span>
          <select
            value={sortValue}
            onChange={(e) =>
              onSortChange(
                e.target.value as IdeasToolbarProps["sortValue"]
              )
            }
            className={cn(
              "rounded-xl border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-foreground shadow-soft focus:outline-none focus:ring-2 focus:ring-ring/40 shrink-0"
            )}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="published">Published</option>
            <option value="pinned">Pinned</option>
            <option value="featured">Featured</option>
          </select>
        </div>

        <Button
          type="button"
          variant="pill"
          className="px-3 text-xs shrink-0"
          onClick={onOpenFilters}
        >
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-1 inline-flex items-center rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[10px] text-foreground">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        <span className="hidden text-[11px] text-muted-foreground sm:inline-flex items-center gap-1">
          <kbd className="rounded border border-border/60 bg-secondary/20 px-1.5 py-0.5 text-[10px]">/</kbd>
          <span className="text-[11px]">or</span>
          <kbd className="rounded border border-border/60 bg-secondary/20 px-1.5 py-0.5 text-[10px]">Ctrl/Cmd K</kbd>
        </span>
      </div>
    </div>
  );
}
