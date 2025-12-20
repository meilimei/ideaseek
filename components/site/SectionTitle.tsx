import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type SectionTitleProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export default function SectionTitle({
  title,
  description,
  actions,
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className
      )}
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground md:text-2xl">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
