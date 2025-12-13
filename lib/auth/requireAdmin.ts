import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createServerClient } from '@supabase/auth-helpers-nextjs';

type Profile = {
  id: string;
  user_id: string;
  role?: string | null;
};

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
            // ignore cookie set failures
          }
        },
        remove(name: string) {
          try {
            cookieStore.delete(name);
          } catch {
            // ignore cookie delete failures
          }
        },
      },
    },
  );
}

export async function requireAdmin() {
  const supabase = getServerSupabaseClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, user_id, role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (!profile || (profile as Profile).role !== 'admin') {
    return notFound();
  }

  return { session, profile: profile as Profile };
}
