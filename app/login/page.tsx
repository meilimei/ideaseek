import { redirect } from "next/navigation";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: userData,
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error("Failed to get user:", userError.message);
  }

  if (userData?.user) {
    redirect("/ideas/database");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f1d] via-[#060914] to-[#02030a] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.12),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.08),transparent_26%)]" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-white/8 bg-white/[0.04] shadow-sm backdrop-blur-sm">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Welcome back</p>
            <CardTitle className="text-3xl font-semibold tracking-tight text-white">Sign in</CardTitle>
            <CardDescription className="text-white/70">
              Access saved ideas, trends, and admin tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LoginForm />
          </CardContent>
          <div className="px-6 pb-6 text-center text-sm text-white/65">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-white hover:text-white/80">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
