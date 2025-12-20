import type { ElementType, ReactNode } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";

export type IdeaCardProps = {
  idea: {
    id: string;
    title: string;
    one_liner: string | null;
    description?: string | null;
    tags: string[] | null;
    difficulty: number | null;
    market_size: string | null;
    demand_strength?: string | null;
    source_type: string | null;
    created_at: string | null;
  };
  href?: string;
  sourceLabel: string;
  saveControl?: ReactNode;
  className?: string;
};

export default function IdeaCard({
  idea,
  href,
  sourceLabel,
  saveControl,
  className,
}: IdeaCardProps) {
  const Wrapper: ElementType = href ? Link : "div";
  const dateDisplay = idea.created_at
    ? new Date(idea.created_at).toLocaleDateString()
    : null;

  const handleSaveClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-5 shadow-soft transition hover:-translate-y-[1px] hover:border-border/80 hover:shadow-glow",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold leading-snug text-foreground group-hover:text-foreground">
            {idea.title}
          </h3>
          {idea.one_liner && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {idea.one_liner}
            </p>
          )}
        </div>
        {saveControl && (
          <div className="flex-shrink-0" onClick={handleSaveClick}>
            {saveControl}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-xs text-foreground">
          {sourceLabel}
        </span>
        {dateDisplay && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-xs text-foreground">
            {dateDisplay}
          </span>
        )}
        {idea.difficulty != null && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-xs text-foreground">
            Difficulty: {idea.difficulty}
          </span>
        )}
        {idea.market_size && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-xs text-foreground">
            Market: {idea.market_size}
          </span>
        )}
        {idea.demand_strength && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-secondary/30 px-2.5 py-1 text-xs text-foreground">
            Demand: {idea.demand_strength}
          </span>
        )}
      </div>

      {idea.tags && idea.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {idea.tags.map((tag) => (
            <Badge
              key={tag}
              className="border border-border/40 bg-background/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );

  if (href) {
    return (
      <Wrapper href={href} className="block h-full no-underline">
        {content}
      </Wrapper>
    );
  }

  return content;
}
