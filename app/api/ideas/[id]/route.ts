import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Params = { params: Promise<{ id: string }> };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const supabaseServer = await createServerSupabaseClient();
  const { data, error } = await supabaseServer
    .from('ideas')
    .select(
      [
        'id',
        'title',
        'one_liner',
        'description',
        'tags',
        'difficulty',
        'market_size',
        'source_type',
        'source_url',
        'demand_strength',
        'pain_points',
        'target_users',
        'market_stage',
        'competition',
        'monetization',
        'key_risks',
        'next_steps',
      ].join(', ')
    )
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    console.error(`[API] Error fetching idea ${id}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch idea' },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
  }

  const { data: evidence, error: evidenceError } = await supabaseServer
    .from('idea_evidence')
    .select('id, source_type, title, url, excerpt, metrics, created_at')
    .eq('idea_id', id)
    .order('created_at', { ascending: false, nullsFirst: true });

  if (evidenceError) {
    console.error(`[API] Error fetching idea evidence ${id}:`, evidenceError);
    return NextResponse.json(
      { error: 'Failed to fetch idea evidence' },
      { status: 500 },
    );
  }

  return NextResponse.json({ item: data, evidence: evidence ?? [] });
}
