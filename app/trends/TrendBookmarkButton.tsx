'use client';

import { useState, MouseEvent } from 'react';
import { pillButton } from '@/lib/ui-classes';
import { cn } from '@/lib/utils/cn';

type TrendBookmarkButtonProps = {
  slug: string;
  trendId: string;
  initialBookmarked: boolean;
  onChange?: (bookmarked: boolean) => void;
};

export default function TrendBookmarkButton({
  slug,
  initialBookmarked,
  onChange,
}: TrendBookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState<boolean>(initialBookmarked);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trends/${slug}/bookmark`, {
        method: 'POST',
      });
      if (res.status === 401) {
        alert('Please sign in to save trends.');
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to toggle bookmark');
      }
      setBookmarked(Boolean(json.bookmarked));
      onChange?.(Boolean(json.bookmarked));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to toggle bookmark';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isActive = bookmarked;
  const label = isActive ? 'Remove from saved' : 'Save trend';

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    void handleToggle();
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        aria-label={label}
        title={isActive ? 'Saved' : 'Save'}
        onClick={handleClick}
        disabled={loading}
        className={cn(
          pillButton,
          "h-8 px-3 py-1 text-xs",
          isActive ? "border-amber-400/60 bg-amber-400/15 text-amber-100 hover:bg-amber-400/10" : "",
          loading ? "cursor-not-allowed opacity-60" : "active:scale-95"
        )}
      >
        <span>{isActive ? '★' : '☆'}</span>
      </button>
      {loading && <span className="text-gray-500">...</span>}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
