import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { getIdeaDatabaseStats } from '@/lib/server/ideaStats';

export async function GET() {
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
          set(name: string, value: string, options?: Record<string, unknown>) {
            cookieStore.set({ name, value, ...(options ?? {}) });
          },
          remove(name: string) {
            cookieStore.delete(name);
          },
        },
      },
    );

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
