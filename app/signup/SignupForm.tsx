'use client';

import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabaseBrowserClient";
import { inputBase, pillButton } from "@/lib/ui-classes";
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
    const supabase = createClient();
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

  const disabled = status === "loading" || status === "success";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex flex-col gap-1 rounded-2xl bg-secondary/5 px-4 py-3 text-xs text-muted-foreground">
        <span className="text-foreground/80">We&apos;ll email you a verification link.</span>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {status === "success" && (
        <div className="rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          Verification email sent. Please confirm to sign in.
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
          placeholder="Create a strong password"
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-medium text-foreground/90">
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputBase}
          placeholder="Retype your password"
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className={cn(
          pillButton,
          "w-full justify-center bg-foreground text-background hover:bg-foreground/90",
          disabled && "cursor-not-allowed opacity-70",
        )}
      >
        {status === "loading" ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
