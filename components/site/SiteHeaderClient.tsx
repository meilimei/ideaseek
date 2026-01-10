'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { chipActive, chipBase, pillButton } from '@/lib/ui-classes';
import { cn } from '@/lib/utils/cn';
import NavLinks from '@/components/header/NavLinks';
import UserMenu from '@/components/header/UserMenu';

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: '/ideas/database', label: 'Find Ideas' },
  { href: '/strategies', label: 'Strategies' },
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

export default function SiteHeaderClient({
  isAuthenticated,
  userEmail,
  userName,
  avatarUrl,
}: {
  isAuthenticated: boolean;
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
}) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdminPath = useMemo(() => pathname.startsWith('/admin'), [pathname]);
  const isAuthPage = useMemo(
    () => pathname === '/login' || pathname === '/signup' || pathname.startsWith('/auth/'),
    [pathname],
  );
  const isMarketingPage = useMemo(() => pathname === '/' || pathname === '/pricing', [pathname]);
  const visibleNavItems = useMemo(
    () => (isAuthPage ? navItems.filter((item) => item.href === '/pricing') : navItems),
    [isAuthPage],
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
    <header className="relative sticky top-0 z-50 h-14 w-full bg-background/70 backdrop-blur-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b1221]/70 via-[#0c1a2c]/70 to-[#0f2739]/70 opacity-90" />
      <div className="relative mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm font-semibold uppercase tracking-[0.24em] text-white/80 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
          >
            Ideasignal
          </Link>
          {!isAuthPage && visibleNavItems.length > 0 && <NavLinks items={visibleNavItems} />}
        </div>

        <div className="flex items-center gap-2">
          {!isAuthPage && !isMarketingPage && <SearchButton className="hidden md:inline-flex" onPress={openFilters} />}
          {isAuthenticated ? (
            <div className="hidden items-center gap-2 md:flex">
              <UserMenu userEmail={userEmail ?? null} userName={userName ?? null} avatarUrl={avatarUrl ?? null} />
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 md:inline-flex"
            >
              Sign in
            </Link>
          )}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0 lg:hidden"
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
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        chipBase,
                        "w-full px-3 py-2 text-sm shadow-none text-white/80 hover:border-white/20 hover:bg-white/10",
                        active && "border-white/25 bg-white/10 text-white",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            )}
            <div className="mt-auto flex flex-col gap-2 pt-6">
              {!isAuthPage && !isMarketingPage && <SearchButton className="w-full justify-center" onPress={openFilters} />}
              {isAuthenticated ? (
                <form action="/auth/signout" method="post" className="w-full">
                  <button
                    type="submit"
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
                  >
                    Sign out
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
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
