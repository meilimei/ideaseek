import Link from "next/link";
import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { cardBase, pillButton } from "@/lib/ui-classes";

type Action = {
  label: string;
  onClick?: () => void;
  href?: string;
};

type EmptyStateProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  primaryAction?: Action;
  secondaryAction?: Action;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        cardBase,
        "flex flex-col items-center justify-center gap-3 p-8 text-center shadow-soft",
        className,
      )}
    >
      {icon}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {primaryAction &&
            (primaryAction.href ? (
              <Link
                href={primaryAction.href}
                onClick={primaryAction.onClick}
                className={pillButton}
              >
                {primaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={pillButton}
              >
                {primaryAction.label}
              </button>
            ))}
          {secondaryAction &&
            (secondaryAction.href ? (
              <Link
                href={secondaryAction.href}
                onClick={secondaryAction.onClick}
                className={cn(pillButton, "bg-secondary/6 text-foreground/80")}
              >
                {secondaryAction.label}
              </Link>
            ) : (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className={cn(pillButton, "bg-secondary/6 text-foreground/80")}
              >
                {secondaryAction.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
