'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseBrowserClient';
import type { User } from '@supabase/supabase-js';

type NavItem = { href: string; label: string };

const navItems: NavItem[] = [
  { href: '/ideas/database', label: 'Find Ideas' },
  { href: '/trends', label: 'Trends' },
  { href: '/market-insights', label: 'Market Insights' },
  { href: '/pricing', label: 'Pricing' },
];

export default function SiteHeader() {
  const pathname = usePathname() || '/';
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(async ({ data }) => {
        const nextUser = data.user ?? null;
        setUser(nextUser);
        if (nextUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', nextUser.id)
            .maybeSingle();
          if (profile?.role === 'admin') setIsAdmin(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.reload();
    } catch {
      setSigningOut(false);
    }
  };

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname === href || pathname.startsWith(`${href}/`);

  const activeClasses = 'text-gray-900 font-semibold';
  const inactiveClasses =
    'text-gray-600 hover:text-gray-900 transition-colors';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="md:hidden rounded-md border px-2 py-1 text-sm text-gray-700"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <Link href="/" className="text-lg font-semibold text-gray-900">
            IdeaSignal
          </Link>
          <div className="hidden items-center gap-4 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm ${isActive(item.href) ? activeClasses : inactiveClasses}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/ideas/generator"
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Generate
          </Link>
          {user ? (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-md px-3 py-1.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                >
                  Admin
                </Link>
              )}
              <span className="hidden text-sm text-gray-700 sm:inline">
                {user.user_metadata?.full_name || user.email}
              </span>
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-gray-200 bg-white px-4 py-3 md:hidden">
          <div className="flex flex-col gap-3">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm ${isActive(item.href) ? activeClasses : inactiveClasses}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href="/ideas/generator"
              className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              onClick={() => setMenuOpen(false)}
            >
              Generate
            </Link>
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-md border px-3 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                    onClick={() => setMenuOpen(false)}
                  >
                    Admin
                  </Link>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    await handleSignOut();
                    setMenuOpen(false);
                  }}
                  disabled={signingOut}
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 text-left"
                >
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
