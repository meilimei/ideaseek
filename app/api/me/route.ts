import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: userData,
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Failed to get user:', error.message);
  }

  if (!userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, email } = userData.user;
  return NextResponse.json({
    userId: id,
    email: email ?? null,
  });
}
