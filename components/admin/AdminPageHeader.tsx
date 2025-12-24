import Link from 'next/link';
import type { ReactNode } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { SectionHeader } from './primitives';

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  backHref?: string;
  hideBackLink?: boolean;
};

export function AdminPageHeader({
  title,
  description,
  actions,
  backHref = '/admin',
  hideBackLink = false,
}: AdminPageHeaderProps) {
  const mergedActions = (
    <>
      {actions}
      {!hideBackLink && (
        <Link
          href={backHref}
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'rounded-full shadow-none')}
        >
          Back to dashboard
        </Link>
      )}
    </>
  );

  return (
    <SectionHeader title={title} description={description} actions={mergedActions} />
  );
}
