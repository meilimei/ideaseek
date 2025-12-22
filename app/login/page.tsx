import { redirect } from "next/navigation";
import Link from "next/link";
import LoginForm from "./LoginForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    redirect("/ideas/database");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f1d] via-[#060914] to-[#02030a] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(45,212,191,0.12),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(59,130,246,0.08),transparent_26%)]" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-white/10 bg-slate-950/40 shadow-soft backdrop-blur">
          <CardHeader className="space-y-2">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Welcome back</p>
            <CardTitle className="text-3xl font-semibold text-foreground">Sign in</CardTitle>
            <CardDescription className="text-slate-400">
              Access saved ideas, trends, and admin tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <LoginForm />
          </CardContent>
          <div className="px-6 pb-6 text-center text-sm text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-foreground hover:text-foreground/80">
              Create an account
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}
