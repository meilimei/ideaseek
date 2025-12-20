'use client';

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

type IdeasToolbarProps = {
  totalCount: number;
  filteredCount?: number;
  activeFiltersCount?: number;
  onOpenFilters: () => void;
  viewMode?: "all" | "mine";
  onViewModeChange?: (value: "all" | "mine") => void;
};

export default function IdeasToolbar({
  totalCount,
  filteredCount,
  activeFiltersCount = 0,
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
