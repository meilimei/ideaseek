'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminNavItems } from './nav-items';
import { cn } from '@/lib/utils/cn';
import UserMenu from '@/components/header/UserMenu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type AdminShellProps = {
  children: React.ReactNode;
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
};

export function AdminShell({ children, userName, userEmail, avatarUrl }: AdminShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const grouped = useMemo(
    () => ({
      core: adminNavItems.filter((item) => item.group === 'core'),
      data: adminNavItems.filter((item) => item.group === 'data'),
    }),
    [],
  );

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const sidebarWidth = collapsed ? '72px' : '240px';

  const renderNav = (onNavigate?: () => void) => (
    <nav className="space-y-6">
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
          Core
        </div>
        <div className="flex flex-col gap-1">
          {grouped.core.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 transition hover:bg-white/8 hover:text-foreground',
                  active && 'bg-white/10 text-foreground shadow-soft ring-1 ring-border/50',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
                )}
                {!collapsed && <span>{item.label}</span>}
                {collapsed && <span className="text-xs font-semibold">•</span>}
              </Link>
            );
          })}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
          Data
        </div>
        <div className="flex flex-col gap-1">
          {grouped.data.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground/80 transition hover:bg-white/8 hover:text-foreground',
                  active && 'bg-white/10 text-foreground shadow-soft ring-1 ring-border/50',
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary" />
                )}
                {!collapsed && <span>{item.label}</span>}
                {collapsed && <span className="text-xs font-semibold">•</span>}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_16%_18%,rgba(86,212,230,0.14),transparent_26%),radial-gradient(circle_at_82%_10%,rgba(0,186,206,0.12),transparent_32%)]" />

      <header className="sticky top-0 z-30 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => (typeof window !== 'undefined' && window.innerWidth < 1024 ? setMobileOpen(true) : setCollapsed((v) => !v))}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-secondary/30 text-sm text-foreground shadow-soft transition hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
              aria-label="Toggle navigation"
            >
              ☰
            </button>
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground/80">
                Ideasignal
              </span>
              <Badge variant="secondary" className="text-[11px] uppercase tracking-wide">
                Admin
              </Badge>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">
              {userName || userEmail || 'Admin'}
            </span>
            <UserMenu userName={userName ?? null} userEmail={userEmail ?? null} avatarUrl={avatarUrl ?? null} />
          </div>
        </div>
      </header>

      <div
        className="mx-auto grid w-full max-w-7xl gap-0 px-4 lg:grid"
        style={{ gridTemplateColumns: `minmax(${sidebarWidth}, ${sidebarWidth}) 1fr` }}
      >
        <aside
          className={cn(
            'relative hidden min-h-[calc(100vh-56px)] lg:flex',
            collapsed ? 'w-[72px]' : 'w-[240px]',
          )}
        >
          <div className="sticky top-16 h-[calc(100vh-72px)] w-full rounded-3xl border border-border/40 bg-card/40 p-4 shadow-soft backdrop-blur-xl">
            {renderNav()}
            <div className="mt-6">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full rounded-full"
                onClick={() => setCollapsed((v) => !v)}
              >
                {collapsed ? 'Expand' : 'Collapse'}
              </Button>
            </div>
          </div>
        </aside>

        <main className="flex-1 py-6">
          <div className="space-y-6">{children}</div>
        </main>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 w-full bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 w-[280px] bg-background/95 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3">
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Admin
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMobileOpen(false)}
                className="rounded-full"
              >
                Close
              </Button>
            </div>
            {renderNav(() => setMobileOpen(false))}
          </div>
        </div>
      )}
    </div>
  );
}
