'use client';

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowserClient";
import { inputBase, pillButton } from "@/lib/ui-classes";
import { cn } from "@/lib/utils/cn";

const getOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "";
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const safeNext = useMemo(() => {
    const next = searchParams.get("next") ?? "";
    return next.startsWith("/") && !next.startsWith("//") ? next : null;
  }, [searchParams]);
  const redirectPath = safeNext ?? "/ideas/database";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const buildCallbackUrl = () => {
    const origin = getOrigin();
    if (!origin) return null;
    const params = new URLSearchParams();
    if (safeNext) params.set("next", safeNext);
    const suffix = params.toString();
    return `${origin}/auth/callback${suffix ? `?${suffix}` : ""}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }

    setStatus("success");
    router.replace(redirectPath);
    router.refresh();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setStatus("loading");
    const supabase = createClient();
    const callbackUrl = buildCallbackUrl();

    if (!callbackUrl) {
      setStatus("error");
      setError("Unable to start Google sign-in. Please try again.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }

    // Supabase will handle the redirect.
    setStatus("idle");
  };

  const disabled = status === "loading" || status === "success";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1 rounded-2xl bg-secondary/5 px-4 py-3 text-xs text-muted-foreground">
        <span className="text-foreground/80">Use Google or sign in with email.</span>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-foreground/90">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputBase}
          placeholder="you@example.com"
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-foreground/90">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputBase}
          placeholder="Enter your password"
          autoComplete="current-password"
        />
      </div>

      <div className="space-y-2">
        <button
          type="submit"
          disabled={disabled}
          className={cn(
            pillButton,
            "w-full justify-center bg-foreground text-background hover:bg-foreground/90",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          {status === "loading" ? "Signing in..." : "Sign in"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={handleGoogleSignIn}
          className={cn(
            pillButton,
            "w-full justify-center bg-secondary/12 hover:bg-secondary/16",
            disabled && "cursor-not-allowed opacity-70",
          )}
        >
          Continue with Google
        </button>
      </div>
    </form>
  );
}
