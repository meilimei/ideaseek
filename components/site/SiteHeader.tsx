import SiteHeaderClient from "./SiteHeaderClient";
import { createServerSupabaseClient } from "@/lib/auth/serverClient";

export const dynamic = "force-dynamic";

export default async function SiteHeader() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const isAuthenticated = Boolean(data.session);

  return <SiteHeaderClient isAuthenticated={isAuthenticated} />;
}
