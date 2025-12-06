import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

type Params = { params: Promise<{ id: string }> };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  if (!id || !uuidPattern.test(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const { data, error } = await supabase
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

  return NextResponse.json({ item: data });
}
