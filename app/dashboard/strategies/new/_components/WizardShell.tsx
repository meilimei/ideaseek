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
    <div className="mx-auto w-full max-w-4xl space-y-8 px-6 py-8 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Step {safeStep} of {totalSteps}
          </p>
        </div>
        {rightSlot && <div className="w-full sm:w-auto">{rightSlot}</div>}
      </div>

      <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full rounded-full bg-primary/80 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

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
  );
}
