import { NextResponse } from 'next/server';
import { getIdeaDatabaseStats } from '@/lib/server/ideaStats';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const stats = await getIdeaDatabaseStats({ userId: user?.id ?? null });
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load stats' },
      { status: 500 },
    );
  }
}
