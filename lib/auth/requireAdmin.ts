import { headers } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type Profile = {
  id: string;
  user_id: string;
  role?: string | null;
};

export type RequireAdminResult =
  | { status: 'ok'; user: User; profile: Profile }
  | { status: 'unauthenticated' }
  | { status: 'forbidden'; userId?: string; profileFound: boolean; role?: string | null };

export async function requireAdmin(): Promise<RequireAdminResult> {
  // Force dynamic behavior in route handlers/layouts/pages that call this.
  try {
    headers();
  } catch {
    // ignore
  }
  const supabase = await createServerSupabaseClient();

  const { data: userData, error } = await supabase.auth.getUser();

  if (error) {
    console.error('Failed to get user:', error.message);
  }

  if (!userData?.user) {
    return { status: 'unauthenticated' };
  }
  const sessionUser = userData.user;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', sessionUser.id)
    .maybeSingle();

  const normalizedRole =
    typeof profile?.role === 'string' ? profile.role.toLowerCase().trim() : null;

  if (!profile || normalizedRole !== 'admin') {
    return {
      status: 'forbidden',
      userId: sessionUser.id,
      profileFound: Boolean(profile),
      role: profile?.role ?? null,
    };
  }

  return { status: 'ok', user: sessionUser, profile: profile as Profile };
}
