import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  context: { params: { slug: string } },
) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 },
      );
    }

    const { data: trend, error: trendError } = await supabase
      .from('trends')
      .select('id')
      .eq('slug', context.params.slug)
      .eq('is_public', true)
      .maybeSingle();

    if (trendError || !trend) {
      return NextResponse.json(
        { error: 'Trend not found' },
        { status: 404 },
      );
    }

    const { data: existing } = await supabase
      .from('trend_bookmarks')
      .select('id')
      .eq('trend_id', trend.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('trend_bookmarks')
        .delete()
        .eq('trend_id', trend.id)
        .eq('user_id', user.id);

      return NextResponse.json({ bookmarked: false });
    }

    await supabase.from('trend_bookmarks').insert({
      trend_id: trend.id,
      user_id: user.id,
    });

    return NextResponse.json({ bookmarked: true });
  } catch (err) {
    console.error('Failed to toggle bookmark:', err);
    return NextResponse.json(
      { error: 'Failed to toggle bookmark' },
      { status: 500 },
    );
  }
}
