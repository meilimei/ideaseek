'use client';

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { inputBase } from "@/lib/ui-classes";
import { cn } from "@/lib/utils/cn";

const getOrigin = () => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || "";
};

export default function SignupForm() {
  const searchParams = useSearchParams();
  const safeNext = useMemo(() => {
    const next = searchParams.get("next") ?? "";
    return next.startsWith("/") && !next.startsWith("//") ? next : null;
  }, [searchParams]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const buildRedirectUrl = () => {
    const origin = getOrigin();
    if (!origin) return null;
    const params = new URLSearchParams();
    if (safeNext) params.set("next", safeNext);
    const suffix = params.toString();
    return `${origin}/auth/callback${suffix ? `?${suffix}` : ""}`;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("loading");
    const supabase = createBrowserSupabaseClient();
    const emailRedirectTo = buildRedirectUrl();

    if (!emailRedirectTo) {
      setStatus("error");
      setError("Unable to send verification email. Please try again.");
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
      },
    });

    if (authError) {
      setStatus("error");
      setError(authError.message);
      return;
    }

    setStatus("success");
  };

  const handleGoogle = async () => {
    setError(null);
    // UI-only entrance for now; try to start OAuth when available.
    const supabase = createBrowserSupabaseClient();
    const redirectTo = buildRedirectUrl();
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
    } catch (err) {
      console.error("Google sign-in failed", err);
      setError("Google sign-in is unavailable right now.");
    }
  };

  const isLoading = status === "loading";
  const showSuccess = status === "success";

  const inputStyles = cn(
    inputBase,
    "h-11 rounded-2xl border-white/10 bg-white/[0.04] text-white/90 placeholder:text-white/40 focus-visible:ring-white/20",
  );
  const primaryButtonClasses = cn(
    "inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black shadow-sm transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0",
    isLoading && "cursor-not-allowed opacity-80",
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={handleGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
          <path
            fill="#EA4335"
            d="M12 10.2v3.72h5.22c-.21 1.14-.84 2.1-1.8 2.76v2.3h2.9c1.68-1.56 2.64-3.9 2.64-6.66 0-.64-.06-1.26-.18-1.86H12Z"
          />
          <path fill="#34A853" d="M6.72 14.28 6.12 15.9l-2.64.06A9.77 9.77 0 0 1 3 12c0-1.56.36-3.03 1-4.32l2.34.42 1.02 2.28c-.21.63-.33 1.32-.33 2.04 0 .75.12 1.47.36 2.1Z" />
          <path fill="#4A90E2" d="M21.78 9.36c.12.6.18 1.22.18 1.86 0 2.76-.96 5.1-2.64 6.66l-2.9-2.3c.81-.54 1.38-1.38 1.59-2.36H12V9.36h9.78Z" />
          <path fill="#FBBC05" d="M6.72 14.28c-.24-.63-.36-1.35-.36-2.1 0-.72.12-1.41.33-2.04l-3.15-2.34A9.94 9.94 0 0 0 3 12c0 1.56.36 3.03 1 4.32l2.72-2.04Z" />
          <path fill="#E94235" d="M12 6.84c1.47 0 2.79.51 3.84 1.5l2.88-2.88C17.16 3.6 14.76 2.52 12 2.52 7.98 2.52 4.5 4.92 3 8.1l3.15 2.34c.72-2.1 2.7-3.6 5.85-3.6Z" />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-white/55">
        <span className="h-px flex-1 bg-white/10" />
        <span>or continue with email</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-xs text-white/65 ring-1 ring-white/8">
        We&apos;ll email you a verification link.
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-50">
          <span className="mt-0.5 text-rose-200">!</span>
          <span>{error}</span>
        </div>
      )}

      {showSuccess && (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-400/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-50">
          <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 h-4 w-4 text-emerald-300">
            <path
              fillRule="evenodd"
              d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.278a1 1 0 0 1-1.422.01L3.29 9.948a1 1 0 1 1 1.42-1.408l3.083 3.116 6.492-6.567a1 1 0 0 1 1.42.2Z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold text-emerald-50">Verification email sent.</p>
            <p className="text-xs text-emerald-200">Please confirm to sign in.</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-white/85">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputStyles}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-white/85">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputStyles}
            placeholder="Create a strong password"
            autoComplete="new-password"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirm-password" className="text-sm font-medium text-white/85">
            Confirm password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputStyles}
            placeholder="Retype your password"
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="space-y-3">
        <button type="submit" disabled={isLoading} className={primaryButtonClasses}>
          {isLoading ? "Creating…" : showSuccess ? "Resend verification email" : "Create account"}
        </button>
        {showSuccess && (
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/85 shadow-sm transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0"
          >
            Go to sign in
          </Link>
        )}
      </div>
    </form>
  );
}
