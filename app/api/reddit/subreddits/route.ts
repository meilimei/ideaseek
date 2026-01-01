import { NextResponse } from 'next/server';

// Requires APIFY_TOKEN in .env.local and your deployment env (e.g. Vercel).

type ApifyResultItem = Record<string, unknown>;

function normalizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutPrefix = trimmed.startsWith('r/')
    ? trimmed.slice(2)
    : trimmed.startsWith('/r/')
      ? trimmed.slice(3)
      : trimmed;
  const cleaned = withoutPrefix.replace(/^\/+|\/+$/g, '').trim();
  return cleaned ? cleaned : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeItem(item: ApifyResultItem) {
  const name = normalizeName(
    item.name ?? item.communityName ?? item.subreddit ?? item.displayName,
  );
  if (!name) return null;

  const title = firstString(
    item.title,
    item.communityTitle,
    item.description,
    item.about,
  );
  const url =
    firstString(item.url, item.communityUrl, item.subredditUrl) ??
    `https://www.reddit.com/r/${name}/`;
  const members =
    toNumber(item.members) ??
    toNumber(item.subscribers) ??
    toNumber(item.memberCount) ??
    toNumber(item.subscriberCount);

  return {
    name,
    title: title ?? null,
    url,
    members: members ?? null,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get('q') ?? '').trim();

  if (q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const token = process.env.APIFY_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'missing_apify_token' },
      { status: 500 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/trudax~reddit-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(
        token,
      )}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          searches: [q],
          searchCommunities: true,
          searchPosts: false,
          searchComments: false,
          searchUsers: false,
          maxItems: 15,
          maxCommunitiesCount: 1,
          scrollTimeout: 10,
          includeNSFW: false,
          proxy: {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
          },
          debugMode: false,
        }),
      },
    );

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 1000);
      return NextResponse.json(
        { error: 'apify_failed', detail },
        { status: 502 },
      );
    }

    const data = (await res.json()) as ApifyResultItem[];
    const items = Array.isArray(data)
      ? data
          .map((item) => normalizeItem(item))
          .filter((item): item is NonNullable<ReturnType<typeof normalizeItem>> =>
            Boolean(item),
          )
      : [];

    return NextResponse.json({ items });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'apify_failed', detail: message.slice(0, 1000) },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
