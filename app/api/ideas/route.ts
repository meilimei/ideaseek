// app/api/ideas/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import { computeIdeaSignals } from '@/lib/server/ideaSignals';

type SortParam = 'newest' | 'oldest' | 'published' | 'pinned' | 'featured';

function applySort(query: ReturnType<typeof supabase.from>, sort?: SortParam) {
  switch (sort) {
    case 'oldest':
      return query.order('created_at', { ascending: true });
    case 'published':
      return query
        .order('published', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });
    case 'pinned':
      return query
        .order('pinned', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });
    case 'featured':
      return query
        .order('featured', { ascending: false, nullsLast: true })
        .order('created_at', { ascending: false });
    case 'newest':
    default:
      return query.order('created_at', { ascending: false });
  }
}

// 列表：GET /api/ideas
export async function GET(request: Request) {
  const url = new URL(request.url);
  const sort = (url.searchParams.get('sort') as SortParam) ?? 'newest';

  let query = supabase
    .from('ideas')
    .select(
      'id, title, one_liner, tags, difficulty, market_size, demand_strength, source_type, source_url, created_at, created_by, published, pinned, featured'
    );

  try {
    query = applySort(query, sort);
  } catch {
    query = applySort(query, 'newest');
  }

  const { data, error } = await query;

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
  keywords?: string[];
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

  const signals = computeIdeaSignals({
    title: body.title,
    one_liner: body.one_liner ?? null,
    description: body.description ?? null,
    tags: body.tags ?? null,
    demand_strength: body.demand_strength ?? null,
    market_size: body.market_size ?? null,
    difficulty: body.difficulty ?? null,
    source_type: body.source_type ?? 'generated',
  });

  const mergedTags =
    body.tags && body.tags.length > 0
      ? Array.from(new Set([...body.tags, ...signals.tags])).slice(0, 3)
      : signals.tags;

  const payload = {
    title: body.title,
    one_liner: body.one_liner ?? null,
    description: body.description ?? null,
    tags: mergedTags,
    keywords: signals.keywords,
    score: signals.score,
    status: signals.status,
    status_reason: signals.status_reason,
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
