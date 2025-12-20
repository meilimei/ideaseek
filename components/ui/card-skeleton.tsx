import { cn } from "@/lib/utils/cn";
import { cardBase } from "@/lib/ui-classes";

type CardSkeletonProps = {
  className?: string;
};

export function CardSkeleton({ className }: CardSkeletonProps) {
  return (
    <div className={cn(cardBase, "animate-pulse p-4 space-y-3", className)}>
      <div className="h-4 w-2/3 rounded-full bg-secondary/15" />
      <div className="space-y-2">
        <div className="h-3 w-11/12 rounded-full bg-secondary/12" />
        <div className="h-3 w-9/12 rounded-full bg-secondary/12" />
      </div>
      <div className="h-3 w-3/4 rounded-full bg-secondary/12" />
      <div className="flex flex-wrap gap-2">
        <div className="h-6 w-16 rounded-full bg-secondary/15" />
        <div className="h-6 w-20 rounded-full bg-secondary/15" />
        <div className="h-6 w-14 rounded-full bg-secondary/15" />
      </div>
    </div>
  );
}

type ListSkeletonProps = {
  count?: number;
  className?: string;
  gridClassName?: string;
};

export function ListSkeleton({
  count = 6,
  className,
  gridClassName,
}: ListSkeletonProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2", gridClassName, className)}>
      {Array.from({ length: count }).map((_, idx) => (
        <CardSkeleton key={idx} />
      ))}
    </div>
  );
}
