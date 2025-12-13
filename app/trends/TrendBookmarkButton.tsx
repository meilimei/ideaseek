'use client';

import { useState } from 'react';

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

  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        aria-label={label}
        onClick={handleToggle}
        disabled={loading}
        className={`rounded-full border px-2 py-1 flex items-center gap-1 ${
          isActive
            ? 'bg-yellow-400 text-black border-yellow-400'
            : 'bg-white text-gray-700 border-gray-300'
        } ${loading ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span>{isActive ? '★' : '☆'}</span>
      </button>
      {loading && <span className="text-gray-500">...</span>}
      {error && <span className="text-red-500">{error}</span>}
    </div>
  );
}
