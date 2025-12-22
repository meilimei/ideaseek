'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { chipActive, chipBase, pillButton } from '@/lib/ui-classes';
import { cn } from '@/lib/utils/cn';

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: '/ideas/database', label: 'Find Ideas' },
  { href: '/trends', label: 'Trends' },
  { href: '/market-insights', label: 'Market Insights' },
  { href: '/pricing', label: 'Pricing' },
];

function SearchButton({ className, onPress }: { className?: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      className={cn(pillButton, "px-3 py-1.5 text-sm shadow-soft", className)}
      aria-label="Open search"
    >
      <span className="text-sm">Search</span>
      <kbd className="ml-2 rounded-md border border-border/60 bg-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
        /
      </kbd>
    </button>
  );
}

export default function SiteHeaderClient({ isAuthenticated }: { isAuthenticated: boolean }) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdminPath = useMemo(() => pathname.startsWith('/admin'), [pathname]);
  const isAuthPage = useMemo(() => pathname === '/login' || pathname === '/signup', [pathname]);
  const visibleNavItems = useMemo(
    () => (isAuthPage ? navItems.filter((item) => item.href === '/pricing') : navItems),
    [isAuthPage],
  );

  const isActive = useCallback(
    (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`)),
    [pathname],
  );

  const openFilters = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (pathname.startsWith('/ideas/database')) {
      window.dispatchEvent(new CustomEvent('ideas:open-filters'));
    } else {
      router.push('/ideas/database?search=1');
    }
  }, [pathname, router]);

  const handleGlobalShortcuts = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable) {
          return;
        }
      }

      const isSlash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey;
      const isCmdK = (event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey);
      if (isSlash || isCmdK) {
        event.preventDefault();
        openFilters();
      }
    },
    [openFilters],
  );

  useEffect(() => {
    if (isAuthPage) return;
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [handleGlobalShortcuts, isAuthPage]);

  if (isAdminPath) return null;

  return (
    <header className="relative sticky top-0 z-50 h-16 w-full bg-background/60 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b1221]/85 via-[#0c1a2c]/80 to-[#0f2739]/80 opacity-90" />
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground/80 transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
          >
            Ideasignal
          </Link>
          {visibleNavItems.length > 0 && (
            <nav className="hidden items-center gap-2 lg:flex">
              {visibleNavItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      active ? chipActive : chipBase,
                      "px-3 py-1.5 text-sm shadow-none",
                      active ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : ""
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isAuthPage && <SearchButton className="hidden md:inline-flex" onPress={openFilters} />}
          {isAuthenticated ? (
            <form action="/auth/signout" method="post" className="hidden md:block">
              <button
                type="submit"
                className="rounded-full border border-border/60 bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
              >
                Sign out
              </button>
            </form>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full border border-border/60 bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 md:inline-flex"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 lg:hidden"
            aria-label="Open menu"
          >
            ☰
          </button>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-b from-white/6 to-transparent opacity-40" />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />
          <div className="relative z-10 flex h-full w-full max-w-xs flex-col border-l border-border/60 bg-background/95 p-5 shadow-glow backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-foreground/80 transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            {visibleNavItems.length > 0 && (
              <nav className="mt-4 flex flex-col gap-2">
                {visibleNavItems.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        active ? chipActive : chipBase,
                        "w-full px-3 py-2 text-sm shadow-none",
                        active ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : ""
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-6">
              {!isAuthPage && <SearchButton className="w-full justify-center" onPress={openFilters} />}
              {isAuthenticated ? (
                <form action="/auth/signout" method="post" className="w-full">
                  <button
                    type="submit"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-border/60 bg-secondary/10 px-3 py-2 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/10 px-3 py-2 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
