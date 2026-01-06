import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ParamsPromise =
  | { params: Promise<{ id: string }> }
  | { params: { id: string } };

export async function GET(
  _req: Request,
  context: ParamsPromise,
) {
  const params =
    'params' in context && context.params instanceof Promise
      ? await context.params
      : (context as { params: { id: string } }).params;

  const strategyId = params?.id?.trim();
  const isUuid =
    typeof strategyId === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      strategyId,
    );
  if (!strategyId || !isUuid) {
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
