'use client';

import { useRouter } from "next/navigation";
import Link from "next/link";
import { MouseEvent } from "react";
import { cn } from "@/lib/utils/cn";

type BackLinkProps = {
  fallback: string;
  label: string;
  className?: string;
};

export default function BackLink({ fallback, label, className }: BackLinkProps) {
  const router = useRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <Link
      href={fallback}
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-0",
        className
      )}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </Link>
  );
}
