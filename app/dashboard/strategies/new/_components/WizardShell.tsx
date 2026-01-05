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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Step {safeStep} of {totalSteps}
          </p>
        </div>
        {rightSlot && <div className="w-full sm:w-auto">{rightSlot}</div>}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-secondary/40">
        <div
          className="h-full rounded-full bg-primary/80 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div>{children}</div>

      <div className="flex flex-wrap items-center gap-2">
        {backHref && !disableBack ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={backHref}>Back</Link>
          </Button>
        ) : (
          <Button type="button" variant="ghost" size="sm" disabled>
            Back
          </Button>
        )}
        {nextHref && !disableNext ? (
          <Button asChild size="sm">
            <Link href={nextHref}>Next</Link>
          </Button>
        ) : (
          <Button type="button" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
