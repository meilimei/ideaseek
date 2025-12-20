'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const sections = [
  { id: "summary", label: "Summary" },
  { id: "scores", label: "Scores" },
  { id: "business-fit", label: "Business Fit" },
  { id: "offer", label: "Offer" },
  { id: "why-now", label: "Why Now" },
  { id: "proof-signals", label: "Proof & Signals" },
  { id: "market-gap", label: "Market Gap" },
  { id: "execution", label: "Execution Plan" },
  { id: "framework-fit", label: "Framework Fit" },
];

export default function IdeaToc() {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        rootMargin: "-40% 0px -40% 0px",
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="sticky top-24 hidden lg:block">
      <div className="rounded-2xl border border-border/60 bg-card/50 p-4 shadow-soft">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          On this page
        </div>
        <div className="mt-3 space-y-1.5">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`#${section.id}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-2 text-xs text-muted-foreground transition hover:bg-secondary/20",
                activeId === section.id && "bg-secondary/25 text-foreground"
              )}
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span>{section.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
