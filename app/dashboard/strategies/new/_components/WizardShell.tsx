'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

type WizardShellProps = {
  title: string;
  step: number;
  totalSteps?: number;
  backHref?: string;
  nextHref?: string;
  disableBack?: boolean;
  disableNext?: boolean;
  rightSlot?: ReactNode;
  children: ReactNode;
};

export default function WizardShell({
  title,
  step,
  totalSteps = 4,
  backHref,
  nextHref,
  disableBack,
  disableNext,
  rightSlot,
  children,
}: WizardShellProps) {
  const safeStep = Math.min(Math.max(step, 1), totalSteps);
  const progress = (safeStep / totalSteps) * 100;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{title}</h1>
        <p className="text-sm text-muted-foreground">
          Step {safeStep} of {totalSteps}
        </p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full rounded-full bg-primary/80 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          <div>{children}</div>
          <div className="flex flex-wrap items-center gap-3">
            {backHref && !disableBack ? (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="rounded-full px-4 transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                <Link href={backHref}>Back</Link>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled
                className="rounded-full px-4"
              >
                Back
              </Button>
            )}
            {nextHref && !disableNext ? (
              <Button
                asChild
                size="sm"
                className="rounded-full px-5 transition hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
              >
                <Link href={nextHref}>Next</Link>
              </Button>
            ) : (
              <Button type="button" size="sm" disabled className="rounded-full px-5">
                Next
              </Button>
            )}
          </div>
        </div>
        {rightSlot && (
          <div className="lg:col-span-4 lg:sticky lg:top-24 lg:self-start">
            {rightSlot}
          </div>
        )}
      </div>
    </div>
  );
}
