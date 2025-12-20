'use client';

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type ScoreCardProps = {
  label: string;
  score: string | number;
  descriptor?: string;
  className?: string;
};

export default function ScoreCard({
  label,
  score,
  descriptor,
  className,
}: ScoreCardProps) {
  return (
    <Card
      className={cn(
        "flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft",
        className
      )}
    >
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
          {label}
        </div>
        <div className="text-3xl font-bold leading-tight text-primary/90">{score}</div>
        {descriptor && (
          <p className="text-sm text-muted-foreground">{descriptor}</p>
        )}
      </div>
    </Card>
  );
}
