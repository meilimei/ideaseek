import { cn } from "@/lib/utils/cn";

export const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/30 focus-visible:ring-offset-0";

export const cardBase = "rounded-3xl border border-border/25 bg-secondary/5";
export const cardInteractive = cn(
  cardBase,
  "transition-all duration-200 hover:-translate-y-0.5 hover:border-border/60 hover:bg-secondary/8 cursor-pointer",
);

export const chipBase = cn(
  "inline-flex items-center gap-1 rounded-full border border-border/25 bg-secondary/8 px-3 py-1 text-xs text-foreground/80",
  focusRing,
  "transition-colors",
);
export const chipActive = cn(chipBase, "border-teal-400/30 bg-teal-400/10 text-foreground");

export const pillButton = cn(
  "inline-flex items-center justify-center rounded-full border border-border/25 bg-secondary/8 px-4 py-2 text-sm text-foreground/90",
  focusRing,
  "transition-colors hover:bg-secondary/12 hover:border-border/50 active:bg-secondary/16",
);

export const ghostButton = cn(
  "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm text-foreground/80",
  focusRing,
  "transition-colors hover:bg-secondary/10 active:bg-secondary/14",
);

export const inputBase = cn(
  "h-9 w-full rounded-full border border-border/25 bg-secondary/5 px-4 text-sm text-foreground placeholder:text-muted-foreground/80",
  focusRing,
  "transition-colors hover:border-border/40 focus:border-teal-400/25",
);
