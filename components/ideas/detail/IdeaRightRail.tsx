'use client';

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { toneFromValue, tonePillClasses } from "./semantic";

type IdeaRightRailProps = {
  idea: {
    market_size: string | null;
    demand_strength: string | null;
    difficulty: number | null;
    source_type: string | null;
    source_url: string | null;
    created_at?: string | null;
  };
  sections: { id: string; label: string }[];
  onSave?: () => void;
  shareUrl?: string;
  backHref?: string;
  readingMinutes?: number;
};

export default function IdeaRightRail({
  idea,
  sections,
  onSave,
  shareUrl,
  backHref = "/ideas/database",
  readingMinutes,
}: IdeaRightRailProps) {
  const stats = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (readingMinutes) items.push({ label: "Read time", value: `~${readingMinutes} min` });
    if (idea.market_size) items.push({ label: "Market", value: idea.market_size });
    if (idea.demand_strength) items.push({ label: "Demand", value: idea.demand_strength });
    if (idea.difficulty != null) items.push({ label: "Difficulty", value: `${idea.difficulty}/10` });
    if (idea.source_type) items.push({ label: "Source", value: idea.source_type });
    if (idea.created_at) items.push({ label: "Date", value: new Date(idea.created_at).toLocaleDateString() });
    return items;
  }, [idea, readingMinutes]);

  const handleShare = () => {
    const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    const payload = { title: "Idea", text: "Check out this idea", url };
    if (navigator.share) {
      navigator.share(payload).catch(() => {});
    } else if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <aside className="hidden w-[320px] flex-none lg:block">
      <div className="sticky top-20 space-y-4">
        <Card className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft">
          <div className="text-sm font-semibold text-foreground">Quick actions</div>
          <div className="mt-3 space-y-2">
            <Button
              type="button"
              variant="pill"
              className="w-full justify-center text-xs"
              onClick={onSave}
              disabled={!onSave}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full justify-center rounded-full border border-border/60 text-xs"
              onClick={handleShare}
            >
              Share
            </Button>
            {idea.source_url && (
              <Button
                variant="ghost"
                className="w-full justify-center rounded-full border border-border/60 text-xs"
                asChild
              >
                <a href={idea.source_url} target="_blank" rel="noreferrer">
                  View original
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full justify-center rounded-full border border-border/60 text-xs"
              asChild
            >
              <Link href={backHref}>Back to database</Link>
            </Button>
          </div>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft">
          <div className="text-sm font-semibold text-foreground">Key stats</div>
          <dl className="mt-3 space-y-2 text-xs text-muted-foreground">
            {stats.length === 0 && <div className="text-muted-foreground">No stats available.</div>}
            {stats.map((item) => {
              const tone = toneFromValue(item.label, item.value);
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center justify-between rounded-full border px-3 py-1.5",
                    tonePillClasses(tone)
                  )}
                >
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="text-xs font-semibold text-foreground/90">{item.value}</dd>
                </div>
              );
            })}
          </dl>
        </Card>

        <Card className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft">
          <div className="text-sm font-semibold text-foreground">On this page</div>
          <div className="mt-3 space-y-1.5">
            {sections.map((section) => (
              <Link
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground transition hover:bg-secondary/20"
                )}
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                <span>{section.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </aside>
  );
}
