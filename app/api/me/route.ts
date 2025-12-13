import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

function getServerSupabaseClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name);
        },
        set(name: string, value: string, options?: Record<string, unknown>) {
          try {
            cookieStore.set(name, value, options as any);
          } catch {
            // ignore
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name);
          } catch {
            // ignore
          }
        },
      },
    },
  );
}

export async function GET() {
  const supabase = getServerSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error('Failed to get session:', error.message);
  }

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, email } = session.user;
  return NextResponse.json({
    userId: id,
    email: email ?? null,
  });
}
