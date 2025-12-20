import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

type Props = {
  className?: string;
};

export default function IdeaCardSkeleton({ className }: Props) {
  return (
    <Card
      className={cn(
        "h-full animate-pulse border-border/60 bg-card/50 p-5 shadow-soft",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="h-4 w-48 rounded-full bg-muted/60" />
          <div className="h-3 w-64 rounded-full bg-muted/50" />
        </div>
        <div className="h-7 w-20 rounded-full bg-muted/60" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-muted/40" />
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-5 w-24 rounded-full bg-muted/50" />
        <div className="h-5 w-16 rounded-full bg-muted/50" />
      </div>
    </Card>
  );
}
