import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, children, ...props }, ref) => {
    return (
      <label className="inline-flex items-center gap-2 text-sm text-slate-200">
        <input
          type="checkbox"
          ref={ref}
          className={cn(
            "h-4 w-4 rounded border border-white/20 bg-slate-950/60 text-teal-400 ring-offset-background transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/50 focus-visible:ring-offset-0",
            className,
          )}
          {...props}
        />
        <span className="select-none text-xs text-slate-300">{label ?? children}</span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
