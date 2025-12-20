'use client';

import Link from 'next/link';
import { useState } from 'react';

type ShareButtonsProps = {
  title: string;
  className?: string;
};

export function ShareButtons({ title, className }: ShareButtonsProps) {
  const [url] = useState(
    typeof window !== 'undefined' ? window.location.href : '',
  );
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      alert('Link copied');
    } catch {
      alert('Failed to copy link');
    }
  };

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    title,
  )}&url=${encodeURIComponent(url)}`;
  const liHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    url,
  )}`;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 text-xs text-gray-600 ${className ?? ''}`}
    >
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <Link
        href={tweetHref}
        target="_blank"
        className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        Share on X
      </Link>
      <Link
        href={liHref}
        target="_blank"
        className="rounded-md border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
      >
        Share on LinkedIn
      </Link>
    </div>
  );
}
