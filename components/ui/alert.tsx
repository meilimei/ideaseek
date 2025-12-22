import * as React from "react";
import { cn } from "@/lib/utils/cn";

export type AlertProps = React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive";
};

export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full gap-3 rounded-2xl border px-3 py-2 text-sm shadow-soft",
        variant === "destructive"
          ? "border-rose-400/50 bg-rose-500/10 text-rose-50"
          : "border-emerald-400/50 bg-emerald-500/10 text-emerald-50",
        className,
      )}
      {...props}
    />
  );
}
