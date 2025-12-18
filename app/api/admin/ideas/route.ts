import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { listIdeas } from '@/lib/server/adminIdeas';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search') || url.searchParams.get('q') || undefined;
  const sourceType = url.searchParams.get('sourceType') || undefined;
  const status = (url.searchParams.get('status') as
    | 'all'
    | 'published'
    | 'unpublished'
    | 'deleted'
    | null) || undefined;
  const createdBy = url.searchParams.get('createdBy') || undefined;
  const includeDeleted = url.searchParams.get('includeDeleted') === 'true';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);

  try {
    const { items, total } = await listIdeas({
      search,
      sourceType,
      status: status ?? 'all',
      createdBy,
      includeDeleted,
      page,
      pageSize,
    });

    return NextResponse.json({ items, total, page, pageSize });
  } catch (err) {
    console.error('Failed to list ideas:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
