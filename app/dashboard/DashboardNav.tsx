'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { chipActive, chipBase } from '@/lib/ui-classes';
import { cn } from '@/lib/utils/cn';

const navItems = [
  { href: '/dashboard/ideas', label: 'Ideas' },
  { href: '/dashboard/opportunities', label: 'Opportunities' },
  { href: '/dashboard/jobs', label: 'Jobs' },
  { href: '/dashboard/strategies', label: 'Strategies' },
];

export default function DashboardNav() {
  const pathname = usePathname() || '/';

  return (
    <div className="border-b border-border/30 bg-background/40">
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap gap-2 px-4 py-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(active ? chipActive : chipBase, 'px-3 py-2 text-sm')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
