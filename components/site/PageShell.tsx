'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type PageShellProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export default function PageShell({
  title,
  description,
  actions,
  children,
  className,
}: PageShellProps) {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_16%_18%,rgba(86,212,230,0.14),transparent_26%),radial-gradient(circle_at_82%_10%,rgba(0,186,206,0.12),transparent_32%)]" />
      <div
        className={cn(
          'mx-auto w-full max-w-6xl px-4 pb-12 pt-10 md:pt-14 space-y-8',
          className,
        )}
      >
        {(title || description || actions) && (
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              {title && (
                <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                  {title}
                </h1>
              )}
              {description && (
                <p className="max-w-2xl text-base text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex items-center gap-3">{actions}</div>}
          </div>
        )}
        <div className="space-y-8">{children}</div>
      </div>
    </div>
  );
}
