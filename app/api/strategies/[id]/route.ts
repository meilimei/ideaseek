import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ParamsPromise =
  | { params: Promise<{ id: string }> }
  | { params: { id: string } };

function normalizeSource(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'trends') return 'google_trends';
  return normalized;
}

function parseConfig(raw: unknown) {
  if (typeof raw === 'string') {
    const input = raw.trim();
    if (!input) return { ok: true as const, value: {} };
    try {
      return { ok: true as const, value: JSON.parse(input) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Invalid JSON',
      };
    }
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ok: true as const, value: raw as Record<string, unknown> };
  }
  return { ok: true as const, value: {} };
}

function parseStrategyId(context: ParamsPromise) {
  const paramsPromise =
    'params' in context && context.params instanceof Promise
      ? context.params
      : Promise.resolve((context as { params: { id: string } }).params);
  return paramsPromise.then((p) => {
    const strategyId = p?.id?.trim();
    const isUuid =
      typeof strategyId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        strategyId,
      );
    if (!strategyId || !isUuid) {
      throw new Error('Invalid strategy id');
    }
    return strategyId;
  });
}

export async function GET(
  _req: Request,
  context: ParamsPromise,
) {
  let strategyId: string;
  try {
    strategyId = await parseStrategyId(context);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid strategy id' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy fetch:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('ingest_strategies')
    .select('id, name, source, description, is_active, cron_expr, config, created_by')
    .eq('id', strategyId)
    .eq('created_by', user.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('Failed to load strategy for edit:', error.message);
    return NextResponse.json({ error: 'Failed to load strategy' }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ strategy: data });
}

export async function PATCH(req: Request, context: ParamsPromise) {
  let strategyId: string;
  try {
    strategyId = await parseStrategyId(context);
  } catch (err) {
    return NextResponse.json({ error: 'Invalid strategy id' }, { status: 400 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Failed to get user for strategy update:', userError.message);
  }

  const user = userData?.user ?? null;
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const update: Record<string, unknown> = {};

  if (typeof body.name === 'string') {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    update.name = name;
  }

  if ('description' in body) {
    if (body.description === null) {
      update.description = null;
    } else if (typeof body.description === 'string') {
      const desc = body.description.trim();
      update.description = desc || null;
    }
  }

  if (typeof body.isActive === 'boolean') {
    update.is_active = body.isActive;
  }

  if (typeof body.cronExpr === 'string') {
    const cron = body.cronExpr.trim();
    if (!cron) {
      return NextResponse.json({ error: 'Cron expression is required' }, { status: 400 });
    }
    update.cron_expr = cron;
  }

  if (typeof body.source === 'string') {
    const source = normalizeSource(body.source);
    if (!source) {
      return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    }
    update.source = source;
  }

  if ('configText' in body || 'config' in body) {
    const parsed = parseConfig(
      typeof body.configText === 'string' ? body.configText : body.config,
    );
    if (!parsed.ok) {
      return NextResponse.json(
        { error: `Config JSON error: ${parsed.error}` },
        { status: 400 },
      );
    }
    update.config = parsed.value;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('ingest_strategies')
    .update(update)
    .eq('id', strategyId)
    .eq('created_by', user.id)
    .is('deleted_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Failed to update strategy:', error.message);
    return NextResponse.json({ error: 'Failed to update strategy' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, strategyId: data?.id ?? strategyId });
}
