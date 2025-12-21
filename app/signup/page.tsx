import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@supabase/auth-helpers-nextjs";
import SignupForm from "./SignupForm";
import { cardBase } from "@/lib/ui-classes";
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
        <div className="mb-8 text-center">
          <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">Create your account</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">Join IdeaSeek</h1>
          <p className="mt-1 text-sm text-muted-foreground">Stay in sync with your saved ideas and trends.</p>
        </div>

        <div className={cn(cardBase, "w-full max-w-md space-y-6 bg-secondary/10 p-8 shadow-soft backdrop-blur")}>
          <SignupForm />
          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-foreground hover:text-foreground/80">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
