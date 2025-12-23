'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

type NavItem = { href: string; label: string };

export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() || "/";

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="hidden items-center gap-2 lg:flex">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 text-sm rounded-full transition",
              active
                ? "bg-white/[0.06] text-white/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                : "text-white/70 hover:text-white/90 hover:bg-white/[0.04]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
