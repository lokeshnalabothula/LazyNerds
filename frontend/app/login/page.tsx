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
import { FixOpsAppLoader } from "@/components/ui/loading";
import { Shield, AlertCircle, KeyRound } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, redirect immediately to Overview landing page
  useEffect(() => {
    if (!loading && user) {
      router.replace("/overview");
      if (typeof window !== "undefined") {
        window.location.replace("/overview");
      }
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
    return <FixOpsAppLoader label="PREPARING WORKSPACE" subtext="Verifying authentication credentials…" />;
  }

  return (
    <div className="min-h-screen bg-[#090A0D] cyber-grid flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      {/* Ambient Cyber Top Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[600px] max-w-full h-[320px] bg-gradient-to-b from-[#F5C518]/[0.06] via-[#F5C518]/[0.02] to-transparent blur-3xl z-0"
      />

      <div className="w-full max-w-sm space-y-6 relative z-10">
        {/* Official Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
              Lazy Nerds
            </span>
            <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 font-bold shrink-0">
              FIXOPS
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Cybersecurity operations & vulnerability management workspace
          </p>
        </div>

        {/* Login Card */}
        <div className="cockpit-card specular-top p-6 sm:p-7 shadow-2xl">
          <form method="POST" action="#" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {serverError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-zinc-300 dark:text-[#9CA3AF]">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••••••"
                className={`w-full rounded-lg bg-[#161920] border px-3 py-2 text-xs text-[#F9FAFB] placeholder-zinc-500 focus:outline-none focus:ring-1 transition-colors ${
                  errors.password?.message
                    ? "border-rose-500 focus:border-rose-500 focus:ring-rose-500"
                    : "border-[#222630] focus:border-[#F5C518] focus:ring-[#F5C518]"
                }`}
                {...register("password")}
              />
              {errors.password?.message && (
                <p className="mt-1 text-[11px] text-rose-400">{errors.password.message}</p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full mt-2 h-10 text-xs font-bold"
              isLoading={isSubmitting}
            >
              <KeyRound className="h-4 w-4 mr-1.5" />
              <span>Sign In to Workspace</span>
            </Button>
          </form>

          {/* Client Self-Registration Option */}
          <div className="mt-5 pt-4 border-t border-[#222630] space-y-2 text-center">
            <p className="text-[11px] text-[#9CA3AF]">
              New client organization looking for security operations?
            </p>
            <div className="flex items-center justify-center gap-3 text-xs">
              <Link
                href="/register"
                className="font-semibold text-[#B88700] dark:text-[#FFD84D] transition-colors underline-offset-4 hover:underline"
              >
                Apply for Onboarding
              </Link>
              <span className="text-zinc-600">•</span>
              <Link
                href="/register/status"
                className="text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors underline-offset-4 hover:underline"
              >
                Check Application Status
              </Link>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#222630]/60 text-[11px] text-[#9CA3AF] text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-[#F5C518]" />
            <span>Role-Based Access: Founder • Employee • Client</span>
          </div>
        </div>

        {/* Public Legal Links */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#9CA3AF]">
          <Link
            href="/privacy"
            className="hover:text-[#F9FAFB] transition-colors underline-offset-4 hover:underline"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link
            href="/terms"
            className="hover:text-[#F9FAFB] transition-colors underline-offset-4 hover:underline"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
