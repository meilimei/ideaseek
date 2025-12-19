import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';
import { computeIdeaSignals } from '@/lib/server/ideaSignals';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      },
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => null);
    const idea = body?.idea;

    if (!idea || !idea.title || idea.title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid idea payload' },
        { status: 400 },
      );
    }

    const signals = computeIdeaSignals({
      title: idea.title,
      one_liner: idea.one_liner ?? null,
      description: idea.description ?? null,
      tags: idea.tags ?? [],
      demand_strength: idea.demand_strength ?? null,
      market_size: idea.market_size ?? null,
      difficulty: idea.difficulty ?? null,
      source_type: 'generator',
    });

    const mergedTags =
      idea.tags && idea.tags.length > 0
        ? Array.from(new Set([...(idea.tags ?? []), ...signals.tags])).slice(0, 3)
        : signals.tags;

    const insertData = {
      title: idea.title,
      one_liner: idea.one_liner ?? null,
      description: idea.description ?? null,
      tags: mergedTags,
      keywords: signals.keywords,
      score: signals.score,
      status: signals.status,
      status_reason: signals.status_reason,
      difficulty: idea.difficulty ?? null,
      market_size: idea.market_size ?? null,
      demand_strength: idea.demand_strength ?? null,
      pain_points: idea.pain_points ?? [],
      target_users: idea.target_users ?? null,
      market_stage: idea.market_stage ?? null,
      competition: idea.competition ?? null,
      monetization: idea.monetization ?? [],
      key_risks: idea.key_risks ?? [],
      next_steps: idea.next_steps ?? null,
      source_type: 'generator',
      source_url: null,
      created_by: user.id,
    };

    const { data, error } = await supabaseService
      .from('ideas')
      .insert(insertData)
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to save idea:', error);
      return NextResponse.json(
        { error: 'Failed to save idea' },
        { status: 500 },
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('Internal error saving idea:', err);
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 },
    );
  }
}
