import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

export async function GET() {
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
