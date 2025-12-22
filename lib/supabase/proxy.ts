import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("Missing env NEXT_PUBLIC_SUPABASE_URL");
  return url;
}

function getSupabaseKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error(
      "Missing env NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY as fallback)",
    );
  }
  return key;
}

export async function updateSession(request: NextRequest) {
  // Prepare a response we can attach cookies to
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          // pass refreshed token to Server Components for THIS request
          request.cookies.set(name, value);
          // pass refreshed token to browser
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // IMPORTANT: no logic between createServerClient and getClaims
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = (claimsData as any)?.claims?.sub as string | undefined;

  const pathname = request.nextUrl.pathname;
  const protectedPrefixes = ["/ideas", "/trends", "/projects", "/karma", "/karmalab"];
  const isProtected = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (isProtected && !userId) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);

    const redirectResponse = NextResponse.redirect(url);

    // carry cookies from supabaseResponse to redirectResponse
    supabaseResponse.cookies.getAll().forEach(({ name, value, ...options }) => {
      redirectResponse.cookies.set(name, value, options);
    });

    return redirectResponse;
  }

  return supabaseResponse;
}
