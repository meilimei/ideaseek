import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { supabaseServiceClient as supabase } from '@/lib/supabaseServiceClient';

type SnapshotRow = {
  id: number;
  snapshot_key: string | null;
  strategy_name: string | null;
  keyword: string | null;
  geo: string | null;
  timeframe: string | null;
  source: string | null;
  processed: boolean | null;
  processed_at: string | null;
  last_error: string | null;
  created_at: string | null;
  raw_payload?: unknown;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const { data, error } = await supabase
    .from('raw_trends_snapshots')
    .select(
      'id, snapshot_key, strategy_name, keyword, geo, timeframe, source, processed, processed_at, last_error, created_at, raw_payload',
    )
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch trends snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(data as SnapshotRow);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  if (typeof body.processed === 'boolean') {
    updates.processed = body.processed;
    updates.processed_at = body.processed ? new Date().toISOString() : null;
  }
  if (body.reset_error === true) {
    updates.last_error = null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('raw_trends_snapshots')
    .update(updates)
    .eq('id', id)
    .select(
      'id, snapshot_key, strategy_name, keyword, geo, timeframe, source, processed, processed_at, last_error, created_at',
    )
    .single();

  if (error) {
    console.error('Failed to update trends snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data as SnapshotRow);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if (auth.status === 'unauthenticated') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (auth.status === 'forbidden') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await context.params;

  const { error } = await supabase.from('raw_trends_snapshots').delete().eq('id', id);

  if (error) {
    console.error('Failed to delete trends snapshot:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
