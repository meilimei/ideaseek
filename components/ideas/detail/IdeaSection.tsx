'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type IdeaSectionProps = {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export default function IdeaSection({
  id,
  title,
  description,
  children,
  className,
}: IdeaSectionProps) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-28 space-y-3 rounded-2xl border border-border/60 bg-card/40 p-5 shadow-soft", className)}
    >
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground md:text-xl">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}
