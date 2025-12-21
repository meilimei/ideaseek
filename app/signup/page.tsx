import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import SignupForm from "./SignupForm";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set() {
          // no-op in server component
        },
        remove() {
          // no-op in server component
        },
      },
    },
  );

  const { data } = await supabase.auth.getSession();

  if (data.session) {
    redirect("/ideas/database");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#0b0f1d] via-[#060914] to-[#02030a] text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(56,189,248,0.14),transparent_32%),radial-gradient(circle_at_80%_0%,rgba(45,212,191,0.12),transparent_28%)]" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-16">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-foreground">Join IdeaSeek</h1>
          <p className="mt-2 text-sm text-slate-400">Save ideas & trends. Sync across devices.</p>
        </div>

        <Card className={cn("w-full max-w-md border-white/10 bg-slate-950/40 shadow-soft backdrop-blur")}>
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl text-foreground/90">Create your account</CardTitle>
            <CardDescription className="text-slate-400">Get verified to start saving ideas.</CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <SignupForm />
          </CardContent>
          <CardFooter className="flex flex-col gap-2 text-sm text-slate-400">
            <div className="flex w-full items-center justify-between text-xs text-slate-500">
              <Link href="#" className="hover:text-slate-200">Terms</Link>
              <Link href="#" className="hover:text-slate-200">Privacy</Link>
            </div>
            <p className="w-full text-center text-sm">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-foreground hover:text-foreground/80">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}
