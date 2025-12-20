import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { pillButton } from "@/lib/ui-classes";

type AppPaginationProps = {
  currentPage: number;
  totalPages: number;
  makeHref: (page: number) => string;
  onNavigate?: (page: number) => void;
  className?: string;
};

const rangeWithEllipsis = (current: number, total: number) => {
  const pages: (number | "...")[] = [];
  const addPage = (p: number | "...") => pages.push(p);

  addPage(1);
  if (current > 3) addPage("...");

  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    addPage(p);
  }

  if (current < total - 2) addPage("...");
  if (total > 1) addPage(total);

  return Array.from(new Set(pages.filter(Boolean)));
};

export default function AppPagination({
  currentPage,
  totalPages,
  makeHref,
  onNavigate,
  className,
}: AppPaginationProps) {
  if (totalPages <= 1) return null;

  const goTo = (page: number) => {
    if (onNavigate) onNavigate(page);
  };

  const pages = rangeWithEllipsis(currentPage, totalPages);

  return (
    <nav
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-sm",
        className,
      )}
      aria-label="Pagination"
    >
      <div className="flex items-center gap-2">
        <Link
          href={makeHref(Math.max(1, currentPage - 1))}
          aria-label="Previous page"
          className={cn(
            pillButton,
            "h-9 px-3 py-1",
            currentPage === 1 && "pointer-events-none opacity-50",
          )}
          onClick={(e) => {
            if (currentPage === 1) {
              e.preventDefault();
              return;
            }
            goTo(Math.max(1, currentPage - 1));
          }}
        >
          Previous
        </Link>
        <span className="text-slate-400">
          Page {currentPage} of {totalPages}
        </span>
        <Link
          href={makeHref(Math.min(totalPages, currentPage + 1))}
          aria-label="Next page"
          className={cn(
            pillButton,
            "h-9 px-3 py-1",
            currentPage === totalPages && "pointer-events-none opacity-50",
          )}
          onClick={(e) => {
            if (currentPage === totalPages) {
              e.preventDefault();
              return;
            }
            goTo(Math.min(totalPages, currentPage + 1));
          }}
        >
          Next
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        {pages.map((p, idx) =>
          p === "..." ? (
            <span key={`${p}-${idx}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <Link
              key={p}
              href={makeHref(p)}
              aria-label={`Go to page ${p}`}
              aria-current={currentPage === p ? "page" : undefined}
              className={cn(
                pillButton,
                "h-9 px-3 py-1",
                currentPage === p ? "border-primary/20 bg-primary/12 text-foreground" : "bg-secondary/8 text-foreground/80 hover:bg-secondary/12"
              )}
              onClick={() => goTo(p)}
            >
              {p}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
