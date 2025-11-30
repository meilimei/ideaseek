// app/api/ideas/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// 列表：GET /api/ideas
export async function GET() {
  const { data, error } = await supabase
    .from('ideas')
    .select(
      'id, title, one_liner, tags, difficulty, market_size, demand_strength'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[API] Error fetching ideas:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ideas' },
      { status: 500 }
    );
  }

  return NextResponse.json({ items: data ?? [] });
}

// 新增：POST /api/ideas 保存一条 idea
type InsertIdeaPayload = {
  title: string;
  one_liner?: string;
  description?: string;
  tags?: string[];
  difficulty?: number;
  market_size?: string;
  demand_strength?: string;
  pain_points?: string[];
  target_users?: string;
  market_stage?: string;
  competition?: string;
  monetization?: string[];
  key_risks?: string[];
  next_steps?: string;
  source_type?: string;
};

export async function POST(req: Request) {
  let body: InsertIdeaPayload;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  if (!body.title || body.title.trim().length === 0) {
    return NextResponse.json(
      { error: 'title is required' },
      { status: 400 }
    );
  }

  const payload = {
    title: body.title,
    one_liner: body.one_liner ?? null,
    description: body.description ?? null,
    tags: body.tags ?? null,
    difficulty: body.difficulty ?? null,
    market_size: body.market_size ?? null,
    demand_strength: body.demand_strength ?? null,
    pain_points: body.pain_points ?? null,
    target_users: body.target_users ?? null,
    market_stage: body.market_stage ?? null,
    competition: body.competition ?? null,
    monetization: body.monetization ?? null,
    key_risks: body.key_risks ?? null,
    next_steps: body.next_steps ?? null,
    source_type: body.source_type ?? 'generated',
  };

  const { data, error } = await supabase
    .from('ideas')
    .insert(payload)
    .select('id')
    .single();

  if (error || !data) {
    console.error('[API] Error inserting idea:', error);
    return NextResponse.json(
      { error: 'Failed to save idea' },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: data.id });
}
