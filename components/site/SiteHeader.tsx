'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: '/ideas/database', label: 'Find Ideas' },
  { href: '/trends', label: 'Trends' },
  { href: '/market-insights', label: 'Market Insights' },
  { href: '/pricing', label: 'Pricing' },
];

function SearchButton({ className }: { className?: string }) {
  const handleClick = () => {
    if (typeof window === 'undefined') return;
    const evt = new CustomEvent('command-palette:open');
    window.dispatchEvent(evt);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${className ?? ''}`}
      aria-label="Open search"
    >
      <span className="text-sm">Search</span>
      <kbd className="ml-2 rounded-md border border-border/60 bg-secondary/20 px-1.5 py-0.5 text-[10px] font-medium text-foreground/70">
        /
      </kbd>
    </button>
  );
}

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [mobileOpen, setMobileOpen] = useState(false);
  if (pathname.startsWith('/admin')) return null;

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

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
          <nav className="hidden items-center gap-2 lg:flex">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-full px-3 py-1.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 ${
                    active
                      ? 'border border-primary/25 bg-primary/12 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                      : 'border border-transparent text-foreground/80 hover:bg-secondary/10 hover:text-foreground'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <SearchButton className="hidden md:inline-flex" />
          <Link
            href="/login"
            className="hidden rounded-full border border-border/60 bg-secondary/10 px-3 py-1.5 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0 md:inline-flex"
          >
            Sign in
          </Link>
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
            <nav className="mt-4 flex flex-col gap-2">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`rounded-xl px-3 py-2 text-sm transition ${
                      active
                        ? 'border border-primary/25 bg-primary/12 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
                        : 'border border-transparent text-foreground/80 hover:bg-secondary/10 hover:text-foreground'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="mt-auto flex flex-col gap-2 pt-6">
              <SearchButton className="w-full justify-center" />
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="inline-flex items-center justify-center rounded-full border border-border/60 bg-secondary/10 px-3 py-2 text-sm font-semibold text-foreground/85 shadow-soft transition hover:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0"
              >
                Sign in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
