'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: '/ideas/database', label: 'Find Ideas' },
  { href: '/trends', label: 'Trends' },
  { href: '/market-insights', label: 'Market Insights' },
  { href: '/pricing', label: 'Pricing' },
];

function CommandButton() {
  const handleClick = () => {
    if (typeof window === 'undefined') return;
    const evt = new CustomEvent('command-palette:open');
    window.dispatchEvent(evt);
  };
  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-slate-100 hover:border-[var(--primary)] hover:text-[var(--primary)]"
      aria-label="Open command palette"
    >
      <span className="text-base">🔍</span>
      <span className="hidden text-xs text-slate-400 sm:inline">⌘K</span>
    </button>
  );
}

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  if (pathname.startsWith('/admin')) return null;

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(15,23,36,0.9)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            className="text-base font-semibold uppercase tracking-[0.2em] text-[var(--primary)]"
          >
            IdeaSignal
          </Link>
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  isActive(item.href)
                    ? 'border border-[var(--primary)]/60 bg-[rgba(85,175,210,0.14)] text-[var(--primary)]'
                    : 'border border-transparent text-slate-200 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <CommandButton />
          <Link
            href="/login"
            className="hidden rounded-full border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-semibold text-slate-100 hover:border-[var(--primary)] hover:text-[var(--primary)] sm:inline-flex"
          >
            Sign in
          </Link>
        </div>
      </div>
    </header>
  );
}
