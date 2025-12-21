import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const supabase = createRouteHandlerClient({
    cookies: () => cookieStore,
  });
  const currentUrl = new URL(request.url);
  const { searchParams, origin } = currentUrl;

  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (code) {
    await supabase.auth.exchangeCodeForSession(code).catch((error) => {
      console.error("Failed to exchange code for session:", error);
    });
  }

  let redirectTarget = "/ideas/database";

  if (next) {
    try {
      const nextUrl = new URL(next, origin);
      if (nextUrl.origin === origin) {
        redirectTarget = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
      }
    } catch (error) {
      console.warn("Invalid next parameter supplied to /auth/callback:", error);
    }
  }

  const redirectUrl = new URL(redirectTarget, origin);
  return NextResponse.redirect(redirectUrl);
}
