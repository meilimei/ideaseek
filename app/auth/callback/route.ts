import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/ideas/database";
  const safeNext = next.startsWith("/") ? next : "/ideas/database";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(new URL(`/login?error=oauth`, url.origin), { status: 303 });
    }
  }

  return NextResponse.redirect(new URL(safeNext, url.origin), { status: 303 });
}
