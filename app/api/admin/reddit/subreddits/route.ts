import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

type SearchItem = {
  name: string;
  title?: string;
  subscribers?: number;
  over18?: boolean;
};

function buildHeaders() {
  return {
    'User-Agent': process.env.REDDIT_USER_AGENT ?? 'IdeaSeek/0.1 (admin search)',
    Accept: 'application/json',
  };
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ items: [], error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ items: [], error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();
  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const headers = buildHeaders();
  const endpointA = `https://www.reddit.com/api/search_reddit_names.json?query=${encodeURIComponent(
    q,
  )}&include_over_18=on`;

  try {
    const res = await fetch(endpointA, { headers, cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { names?: string[] };
      const names = Array.isArray(data?.names) ? data.names : [];
      const items = names
        .map((name) => (typeof name === 'string' ? name.trim() : ''))
        .filter(Boolean)
        .map((name) => ({ name }));
      return NextResponse.json({ items });
    }
  } catch {
    // fall through to endpoint B
  }

  const endpointB = `https://www.reddit.com/subreddits/search.json?q=${encodeURIComponent(
    q,
  )}&limit=10&include_over_18=on&raw_json=1`;

  try {
    const res = await fetch(endpointB, { headers, cache: 'no-store' });
    if (!res.ok) {
      return NextResponse.json({ items: [], error: 'reddit_search_failed' });
    }
    const data = (await res.json()) as {
      data?: { children?: Array<{ data?: Record<string, unknown> }> };
    };
    const children = Array.isArray(data?.data?.children) ? data.data?.children : [];
    const items: SearchItem[] = children
      .map((child) => {
        const raw = child?.data ?? {};
        const name = typeof raw.display_name === 'string' ? raw.display_name.trim() : '';
        if (!name) return null;
        const title = typeof raw.title === 'string' ? raw.title : undefined;
        const subscribers =
          typeof raw.subscribers === 'number' ? raw.subscribers : undefined;
        const over18 = typeof raw.over18 === 'boolean' ? raw.over18 : undefined;
        return { name, title, subscribers, over18 };
      })
      .filter((item): item is SearchItem => Boolean(item));

    items.sort((a, b) => (b.subscribers ?? 0) - (a.subscribers ?? 0));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [], error: 'reddit_search_failed' });
  }
}
