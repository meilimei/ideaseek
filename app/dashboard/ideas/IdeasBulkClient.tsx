"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { DataTable } from "@/components/admin/primitives";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type IdeaRow = {
  id: string;
  title: string;
  review_state: "new" | "reviewed" | "archived" | string;
  status?: string | null;
  tags?: string[] | null;
  score_overall?: number | null;
  created_at?: string | null;
  enriched_at?: string | null;
  latest_job_id: string;
  latest_produced_at: string | null;
  enrich_job_id?: string | number | null;
  enrich_job_status?: string | null;
};

type BulkInput = { ids: string[]; to: "new" | "reviewed" | "archived" };

function formatRelative(isoDate: string | null | undefined) {
  if (!isoDate) return "—";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  if (Math.abs(diffSeconds) < 30) return "just now";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
    { unit: "year", seconds: 60 * 60 * 24 * 365 },
    { unit: "month", seconds: 60 * 60 * 24 * 30 },
    { unit: "week", seconds: 60 * 60 * 24 * 7 },
    { unit: "day", seconds: 60 * 60 * 24 },
    { unit: "hour", seconds: 60 * 60 },
    { unit: "minute", seconds: 60 },
    { unit: "second", seconds: 1 },
  ];

  for (const { unit, seconds } of units) {
    if (Math.abs(diffSeconds) >= seconds || unit === "second") {
      return rtf.format(Math.round(diffSeconds / seconds), unit);
    }
  }

  return "just now";
}

function enrichBadgeFor(enrichedAt: string | null | undefined, jobStatus?: string | null) {
  if (enrichedAt) {
    return {
      label: "Enriched",
      className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
    };
  }
  if (!jobStatus) {
    return { label: "Not queued", className: "bg-secondary/40 text-foreground border-border/50" };
  }
  const status = jobStatus.toLowerCase();
  if (status === "queued") {
    return { label: "Queued", className: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
  }
  if (status === "running") {
    return { label: "Running", className: "bg-blue-500/15 text-blue-200 border-blue-500/30" };
  }
  if (status === "success") {
    return { label: "Done", className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/30" };
  }
  if (status === "error") {
    return { label: "Error", className: "bg-rose-500/15 text-rose-200 border-rose-500/30" };
  }
  return { label: "Not queued", className: "bg-secondary/40 text-foreground border-border/50" };
}

export default function IdeasBulkClient({
  ideas,
  onBulkUpdate,
}: {
  ideas: IdeaRow[];
  onBulkUpdate: (input: BulkInput) => Promise<any>;
}) {
  const router = useRouter();
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
      router.refresh();
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
      <DataTable>
        <thead className="bg-secondary/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={(event) => {
                  event.stopPropagation();
                  toggleAllVisible();
                }}
                onClick={(event) => event.stopPropagation()}
                aria-label="Select all"
                className="h-4 w-4"
              />
            </th>
            <th className="px-3 py-2 font-medium">Idea</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Enrich</th>
            <th className="px-3 py-2 font-medium">Score</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Produced</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/30">
          {ideas.map((idea) => {
            const tags = idea.tags ?? [];
            const visibleTags = tags.slice(0, 6);
            const overflowCount = Math.max(0, tags.length - visibleTags.length);
            const enrichBadge = enrichBadgeFor(idea.enriched_at, idea.enrich_job_status ?? null);
            const ideaHref = idea.latest_job_id
              ? `/dashboard/ideas/${idea.id}?job=${idea.latest_job_id}`
              : `/dashboard/ideas/${idea.id}`;
            const jobHref = idea.latest_job_id ? `/dashboard/jobs/${idea.latest_job_id}` : "/dashboard/jobs";
            const enrichJobId = idea.enrich_job_id != null ? String(idea.enrich_job_id) : null;
            return (
              <tr key={idea.id} className="align-top">
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(idea.id)}
                    onChange={(event) => {
                      event.stopPropagation();
                      toggleOne(idea.id);
                    }}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${idea.title}`}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={ideaHref}
                    className="text-sm font-semibold text-foreground hover:underline"
                  >
                    {idea.title}
                  </Link>
                </td>
                <td className="px-3 py-3">
                  {idea.status ? (
                    <StatusBadge status={idea.status} />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  {enrichJobId ? (
                    <Link href={`/dashboard/jobs/${enrichJobId}`} className="hover:underline">
                      <Badge className={enrichBadge.className}>{enrichBadge.label}</Badge>
                    </Link>
                  ) : (
                    <Badge className={enrichBadge.className}>{enrichBadge.label}</Badge>
                  )}
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground">
                  {idea.score_overall != null ? Number(idea.score_overall).toFixed(2) : "—"}
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {visibleTags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="capitalize">
                        {tag}
                      </Badge>
                    ))}
                    {overflowCount > 0 && (
                      <span className="text-xs text-muted-foreground">
                        +{overflowCount}
                      </span>
                    )}
                    {tags.length === 0 && (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 text-sm text-muted-foreground static">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={jobHref}
                      className="text-xs text-primary hover:underline"
                    >
                      Produced by Job #{idea.latest_job_id}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      Produced {formatRelative(idea.latest_produced_at)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
          {ideas.length === 0 && (
            <tr>
              <td className="px-4 py-4 text-sm text-muted-foreground" colSpan={7}>
                No ideas match these filters.
              </td>
            </tr>
          )}
        </tbody>
      </DataTable>
    </div>
  );
}
