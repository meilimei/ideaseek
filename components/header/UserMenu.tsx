'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Database, CreditCard, LogOut, ChevronDown } from "@/components/ui/icons";

type UserMenuProps = {
  userEmail: string | null;
  userName: string | null;
  avatarUrl: string | null;
};

function getInitials(name?: string | null, fallback?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || null;
  }
  if (fallback && fallback.trim()) {
    return fallback[0]?.toUpperCase() ?? null;
  }
  return null;
}

function truncateEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const shortUser = user.length > 4 ? `${user.slice(0, 3)}…` : user;
  return `${shortUser}@${domain}`;
}

export default function UserMenu({ userEmail, userName, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", escHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", escHandler);
    };
  }, []);

  const initials = useMemo(() => getInitials(userName, userEmail), [userEmail, userName]);
  const displayLabel = useMemo(() => {
    if (userName && userName.trim()) return userName;
    if (userEmail) return truncateEmail(userEmail);
    return "Account";
  }, [userEmail, userName]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        className="group inline-flex h-10 max-w-[220px] items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm font-medium text-white/85 shadow-sm transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
      >
        <span className="relative inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/[0.06] text-sm font-semibold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={userName ?? userEmail ?? "User"} className="h-full w-full object-cover" />
          ) : (
            initials ?? "U"
          )}
        </span>
        <span className="hidden max-w-[160px] truncate text-sm font-semibold text-white/90 sm:inline">
          {displayLabel}
        </span>
        <ChevronDown className="hidden h-4 w-4 text-white/70 sm:inline" />
      </button>

      {open && (
        <div
          className="absolute right-0 z-20 mt-2 min-w-[240px] w-[280px] rounded-2xl border border-white/10 bg-white/[0.04] p-2 text-sm text-white shadow-sm backdrop-blur-md"
          style={{ transformOrigin: "top right" }}
        >
          <div className="space-y-1 rounded-xl px-2 py-1">
            <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Signed in as</p>
            <p className="line-clamp-1 text-xs font-semibold text-white/80">{userEmail ?? displayLabel}</p>
          </div>
          <div className="space-y-1 pt-1">
            <Link
              href="/ideas/database"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-white/85 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              onClick={() => setOpen(false)}
            >
              <Database className="h-4 w-4 text-white/70" />
              <span>Go to Database</span>
            </Link>
            <Link
              href="/pricing"
              className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm text-white/85 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              onClick={() => setOpen(false)}
            >
              <CreditCard className="h-4 w-4 text-white/70" />
              <span>Pricing</span>
            </Link>
            {userEmail && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard?.writeText(userEmail);
                  } catch {
                    // silent
                  }
                }}
                className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <span className="h-4 w-4" />
                <span>Copy email</span>
              </button>
            )}
          </div>
          <div className="my-2 h-px bg-white/10" />
          <form action="/auth/signout" method="post" className="space-y-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm font-semibold text-rose-300 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
