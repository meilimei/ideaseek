'use client';

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "@/components/ui/icons";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const buildCallbackUrl = () => {
    const origin = getOrigin();
    if (!origin) return null;
    const params = new URLSearchParams();
    if (safeNext) params.set("next", safeNext);
    const suffix = params.toString();
    return `${origin}/auth/callback${suffix ? `?${suffix}` : ""}`;
  };

  const isDisabled = status === "loading" || !email || !password;
  const needsEmailConfirmation = error?.toLowerCase().includes("email not confirmed");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");
    setError(null);
    const supabase = createBrowserSupabaseClient();

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
    const supabase = createBrowserSupabaseClient();
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <Alert variant="destructive" className="border-rose-400/50 bg-rose-500/10 text-white">
          <div className="flex flex-col gap-1 text-sm">
            <span>{error}</span>
            {needsEmailConfirmation && (
              <span className="text-xs text-rose-100/80">
                Please verify your email, then try again.
              </span>
            )}
          </div>
        </Alert>
      )}

      <div className="space-y-3">
        <Button
          type="button"
          onClick={handleGoogleSignIn}
          variant="outline"
          disabled={status === "loading"}
          className="w-full justify-center rounded-2xl border-white/15 bg-white/[0.04] text-white/85 shadow-sm hover:bg-white/10 disabled:opacity-70"
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
          <span>Continue with Google</span>
        </Button>

        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-white/55">
          <Separator />
          <span>or continue with email</span>
          <Separator />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/85">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="rounded-2xl border-white/10 bg-white/[0.04] text-white/90 placeholder:text-white/40 focus-visible:ring-white/20"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-white/85">Password</Label>
            <Link href="/forgot-password" className="text-xs text-slate-400 underline-offset-4 hover:text-slate-200">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              className="rounded-2xl border-white/10 bg-white/[0.04] pr-12 text-white/90 placeholder:text-white/40 focus-visible:ring-white/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-3 inline-flex items-center text-slate-400 transition hover:text-slate-200"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Checkbox
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          aria-label="Remember me"
          label="Remember me"
        />
      </div>

      <Button
        type="submit"
        disabled={isDisabled}
        className={cn(
          "w-full justify-center rounded-2xl bg-white text-black shadow-sm hover:bg-white/90",
          "border-none transition focus-visible:ring-2 focus-visible:ring-white/40",
        )}
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}
