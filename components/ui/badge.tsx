import * as React from "react";
import { cn } from "@/lib/utils/cn";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type BadgeOptions = {
  variant?: BadgeVariant;
  className?: string;
};

const baseClasses =
  "inline-flex items-center gap-1 rounded-full border border-border/60 bg-secondary/40 px-3 py-1 text-xs font-medium text-foreground shadow-soft transition-colors duration-200 hover:border-border/80 hover:bg-secondary/60 whitespace-nowrap";

const variantClasses: Record<BadgeVariant, string> = {
  default: "",
  secondary: "bg-background/40 text-muted-foreground hover:bg-background/60",
  destructive:
    "border-destructive/70 bg-destructive/80 text-destructive-foreground hover:bg-destructive",
  outline: "bg-transparent text-foreground hover:bg-white/5",
};

export const badgeVariants = ({ variant = "default", className }: BadgeOptions = {}) =>
  cn(baseClasses, variantClasses[variant], className);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & BadgeOptions;

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={badgeVariants({ variant, className })}
      {...props}
    />
  )
);
Badge.displayName = "Badge";
