'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

type MetaPill = {
  label: string;
  value: string;
};

type IdeaDetailHeaderProps = {
  title: string;
  subtitle?: string | null;
  tags?: string[] | null;
  meta?: MetaPill[];
  sourceUrl?: string | null;
  shareUrl?: string;
};

export default function IdeaDetailHeader({
  title,
  subtitle,
  tags,
  meta = [],
  sourceUrl,
  shareUrl,
}: IdeaDetailHeaderProps) {
  const handleShare = () => {
    const url = shareUrl || (typeof window !== "undefined" ? window.location.href : "");
    const payload = { title, text: subtitle || title, url };
    if (navigator.share) {
      navigator.share(payload).catch(() => {});
    } else if (navigator.clipboard && url) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <header className="relative space-y-4 rounded-2xl border border-border/60 bg-card/50 p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/ideas/database"
          className="text-xs font-semibold text-muted-foreground transition hover:text-foreground"
        >
          ← Back to database
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="rounded-full border border-border/60 px-3 text-xs"
            onClick={handleShare}
          >
            Share
          </Button>
          {sourceUrl && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="rounded-full border border-border/60 px-3 text-xs"
            >
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                View original thread
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold leading-tight text-foreground md:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-foreground/85 md:text-base">{subtitle}</p>
        )}
      </div>

      {meta.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {meta.map((item) => (
            <span
              key={item.label}
              className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/20 px-3 py-1 text-xs text-foreground"
            >
              <span className="text-muted-foreground">{item.label}:</span>
              <span>{item.value}</span>
            </span>
          ))}
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag}
              className={cn(
                "border border-border/40 bg-secondary/15 px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </header>
  );
}
