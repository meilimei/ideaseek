'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { deleteStrategy } from './actions';

export default function DeleteStrategyButton({
  strategyId,
  align = 'end',
}: {
  strategyId: string;
  align?: 'start' | 'end';
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const alignClass = useMemo(() => (align === 'end' ? 'items-end' : 'items-start'), [align]);

  const handleDelete = () => {
    setError(null);
    const confirmed = window.confirm(
      'Delete strategy? This hides it from your list. Existing jobs remain.',
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteStrategy(strategyId);
      if (!result || !result.ok) {
        setError(result?.error || 'Failed to delete strategy');
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className={`flex flex-col gap-1 ${alignClass}`}>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        className="rounded-full px-3"
        onClick={handleDelete}
        disabled={isPending}
      >
        {isPending ? 'Deleting…' : 'Delete'}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
