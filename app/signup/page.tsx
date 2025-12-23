import { redirect } from "next/navigation";
import Link from "next/link";
import SignupForm from "./SignupForm";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase.auth.getSession();

  if (data.session) {
    redirect("/ideas/database");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f1d] via-[#060914] to-[#02030a] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.12),transparent_28%)]" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-16">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Join IdeaSeek</h1>
          <p className="mt-2 text-sm text-white/70">Save ideas & trends. Sync across devices.</p>
        </div>

        <Card className={cn("w-full max-w-md border-white/8 bg-white/[0.04] shadow-sm backdrop-blur-sm")}>
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-semibold tracking-tight text-white/95">Create your account</CardTitle>
            <CardDescription className="text-white/70">Get verified to start saving ideas.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <SignupForm />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-white/65">
            <div className="flex w-full items-center justify-between text-xs text-white/55">
              <Link href="#" className="hover:text-white">Terms</Link>
              <Link href="#" className="hover:text-white">Privacy</Link>
            </div>
            <p className="w-full text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-white hover:text-white/80">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
