import type { ElementType, MouseEvent, ReactNode } from "react";
import Link from "next/link";
import {
  subtleTonePillClasses,
  toneFromValue,
} from "@/components/ideas/list/semantic";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    overall_score?: number | null;
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

  const handleSaveClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const pillBase =
    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs";
  const neutralPill = `${pillBase} bg-secondary/10 text-foreground/75 border-border/50`;

  const content = (
    <Card
      className={cn(
        "group relative h-full overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft transition hover:-translate-y-[1px] hover:border-border/80 hover:shadow-glow",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="space-y-2">
          <h3 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">
            {idea.title}
          </h3>
          {idea.one_liner && (
            <p className="line-clamp-2 text-sm leading-relaxed text-foreground/75">
              {idea.one_liner}
            </p>
          )}
        </div>
      </div>

      {saveControl && (
        <div
          className="absolute right-3 top-3 opacity-80 transition group-hover:opacity-100 lg:opacity-0"
          onClick={handleSaveClick}
        >
          {saveControl}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[13px] text-foreground/70">
        <span className={neutralPill}>{sourceLabel}</span>
        {dateDisplay && <span className={neutralPill}>{dateDisplay}</span>}
        {idea.difficulty != null && (
          <span
            className={cn(
              pillBase,
              subtleTonePillClasses(toneFromValue("Difficulty", idea.difficulty)),
            )}
          >
            Difficulty: {idea.difficulty}
          </span>
        )}
        {idea.market_size && <span className={neutralPill}>Market: {idea.market_size}</span>}
        {idea.demand_strength && (
          <span
            className={cn(
              pillBase,
              subtleTonePillClasses(toneFromValue("Demand", idea.demand_strength)),
            )}
          >
            Demand: {idea.demand_strength}
          </span>
        )}
        {typeof idea.overall_score === "number" && (
          <span
            className={cn(
              pillBase,
              subtleTonePillClasses(toneFromValue("Score", idea.overall_score)),
            )}
          >
            Score: {idea.overall_score}
          </span>
        )}
      </div>

      {idea.tags && idea.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {idea.tags.map((tag) => (
            <Badge
              key={tag}
              className="border border-border/40 bg-secondary/10 px-2.5 py-1 text-[11px] font-medium text-foreground/65"
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
