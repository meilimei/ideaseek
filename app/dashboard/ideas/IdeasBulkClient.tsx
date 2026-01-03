"use client";

import { useTransition, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type IdeaRow = {
  id: string;
  title: string;
  review_state: "new" | "reviewed" | "archived" | string;
  score_overall?: number | null;
  created_at?: string;
};

type BulkInput = { ids: string[]; to: "new" | "reviewed" | "archived" };

type RenderTableArgs = {
  selectedIds: Set<string>;
  toggleOne: (id: string) => void;
  toggleAllVisible: () => void;
  allVisibleSelected: boolean;
};

export default function IdeasBulkClient({
  ideas,
  onBulkUpdate,
  renderTable,
}: {
  ideas: IdeaRow[];
  onBulkUpdate: (input: BulkInput) => Promise<any>;
  renderTable: (args: RenderTableArgs) => React.ReactNode;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const visibleIds = useMemo(() => ideas.map((idea) => idea.id), [ideas]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAllVisible = () => {
    setSelectedIds((prev) => {
      if (visibleIds.length === 0) return prev;
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) {
          next.delete(id);
        }
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulk = (to: BulkInput["to"]) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await onBulkUpdate({ ids, to });
      clearSelection();
    });
  };

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background p-3">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={() => handleBulk("reviewed")} disabled={isPending}>
              Mark reviewed
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={() => handleBulk("archived")}
              disabled={isPending}
            >
              Archive
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => handleBulk("new")}
              disabled={isPending}
            >
              Restore
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearSelection} disabled={isPending}>
              Clear
            </Button>
          </div>
        </div>
      )}
      {renderTable({
        selectedIds,
        toggleOne,
        toggleAllVisible,
        allVisibleSelected,
      })}
    </div>
  );
}
