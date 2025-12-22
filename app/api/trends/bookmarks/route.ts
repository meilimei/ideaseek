import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ trendIds: [] });
  }

  const { data, error } = await supabase
    .from('trend_bookmarks')
    .select('trend_id')
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to load bookmarks:', error);
    return NextResponse.json(
      { error: 'Failed to load bookmarks' },
      { status: 500 },
    );
  }

  const trendIds = (data ?? []).map((row) => row.trend_id as string);

  return NextResponse.json({ trendIds });
}
