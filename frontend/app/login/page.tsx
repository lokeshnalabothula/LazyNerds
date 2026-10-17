"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema, LoginFormData } from "@/lib/validators";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, KeyRound, Loader2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect immediately to Overview landing page
  useEffect(() => {
    if (!loading && user) {
      router.replace("/overview");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Sanitize any sensitive credentials accidentally passed in query strings via browser fallback
    if (typeof window !== "undefined" && window.location.search) {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has("password") || url.searchParams.has("email")) {
          url.searchParams.delete("password");
          url.searchParams.delete("email");
          const cleanSearch = url.searchParams.toString();
          window.history.replaceState({}, "", url.pathname + (cleanSearch ? `?${cleanSearch}` : ""));
        }
      } catch {
        // Safe no-op on malformed URLs
      }
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await login(data.email, data.password);
    } catch (err: any) {
      setServerError(
        err.message || "Invalid credentials or unauthorized account. Please verify your email and password."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Prevent flash of login form while checking existing authenticated session
  if (loading || user) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <span className="text-xs text-zinc-400 font-mono">Preparing your security workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-md bg-zinc-900 border border-zinc-800 text-brand-400 font-mono text-sm font-bold shadow-sm">
            LN
          </div>
          <div className="space-y-0.5">
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 font-mono">
              LAZY NERDS FIXOPS
            </h1>
            <p className="text-xs text-zinc-400">
              Cybersecurity operations & vulnerability management workspace
            </p>
          </div>
        </div>

        {/* Login Card */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
          <form method="POST" action="#" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            <Input
              label="Authorized Email"
              type="email"
              autoComplete="email"
              required
              placeholder="founder@lazynerds.com"
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••••••"
              error={errors.password?.message}
              {...register("password")}
            />

            <Button
              type="submit"
              className="w-full mt-2 h-10 text-xs font-semibold"
              isLoading={isSubmitting}
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              <span>Sign In to Workspace</span>
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-brand-500" />
            <span>Restricted to authorized Lazy Nerds personnel</span>
          </div>
        </div>

        {/* Public Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-zinc-500">
          <Link
            href="/privacy"
            className="hover:text-zinc-300 transition-colors underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            className="hover:text-zinc-300 transition-colors underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
