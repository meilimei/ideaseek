import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

type FeedbackBody = {
  brief_id?: string;
  action?: string;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error('Failed to get user for feedback:', userError.message);
  }
  const userId = userData?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: FeedbackBody | null = null;
  try {
    body = (await request.json()) as FeedbackBody;
  } catch {
    body = null;
  }
  const briefId = body?.brief_id;
  const action = body?.action?.trim();

  if (!briefId || typeof briefId !== 'string' || !action) {
    return NextResponse.json({ error: 'brief_id and action are required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('opportunity_feedback')
    .upsert(
      {
        brief_id: briefId,
        user_id: userId,
        action,
      },
      { onConflict: 'brief_id,user_id' },
    );

  if (error) {
    console.error('Failed to save feedback:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
