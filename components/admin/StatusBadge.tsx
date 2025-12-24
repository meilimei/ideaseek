import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';

const STATUS_STYLES: Record<string, string> = {
  queued: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  running: 'bg-blue-500/15 text-blue-200 border-blue-500/30',
  success: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  failed: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
};

export function StatusBadge({ status }: { status?: string | null }) {
  if (!status) {
    return <Badge variant="secondary">Unknown</Badge>;
  }
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key] ?? 'bg-secondary/40 text-foreground border-border/50';

  return (
    <Badge className={cn('capitalize', style)}>
      {status}
    </Badge>
  );
}
