import SiteHeaderClient from "@/components/site/SiteHeaderClient";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppHeader() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const metadata = (user?.user_metadata ?? {}) as Record<string, any>;
  const userEmail = user?.email ?? null;
  const userName = typeof metadata.full_name === "string" ? metadata.full_name : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string" && metadata.avatar_url.trim()
      ? metadata.avatar_url
      : null;

  return (
    <SiteHeaderClient
      isAuthenticated={Boolean(user)}
      userEmail={userEmail}
      userName={userName}
      avatarUrl={avatarUrl}
    />
  );
}
