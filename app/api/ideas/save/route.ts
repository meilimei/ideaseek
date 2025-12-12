import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { supabaseServiceClient as supabaseService } from '@/lib/supabaseServiceClient';

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

    const insertData = {
      title: idea.title,
      one_liner: idea.one_liner ?? null,
      description: idea.description ?? null,
      tags: idea.tags ?? [],
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
