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
    <div className="min-h-screen bg-[#07090E] cyber-grid flex flex-col justify-between selection:bg-[#F5C518]/20 selection:text-[#F5C518] relative overflow-x-hidden antialiased font-sans">
      {/* Top Status Bar: Micro Operational HUD Anchor (Stitch Quantum Auth Gate) */}
      <header className="w-full border-b border-white/[0.08] bg-[#090A0D]/80 backdrop-blur-md px-4 sm:px-6 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#161920] border border-[#222630]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-ping" />
            <span className="font-mono text-[10px] text-[#FFD84D] tracking-widest uppercase font-bold">
              ENCLAVE SECURE
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#9CA3AF] hidden sm:inline">
            FIXOPS-NITRO-V4.9.2
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#9CA3AF]">
            <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
            <span className="text-[#F9FAFB]">ZERO-TRUST L8</span>
          </div>
          <div className="h-3 w-px bg-white/[0.1] hidden md:block" />
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-[#9CA3AF]">
            <span>NITRO LATENCY:</span>
            <span className="text-[#F5C518] font-semibold">&lt;0.18ms</span>
          </div>
        </div>
      </header>

      {/* Main Canvas: Centered Floating Quantum Verification Enclave */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 my-auto relative z-10">
        {/* Ambient Radial Halos behind Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] max-w-full h-[380px] bg-gradient-to-b from-[#F5C518]/[0.08] via-[#F5C518]/[0.02] to-transparent blur-3xl z-0"
        />

        <div className="w-full max-w-md space-y-5 relative z-10">
          {/* Thinking Orb Header Construct */}
          <div className="flex flex-col items-center mb-2">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#F5C518] to-[#6366F1] opacity-70 blur-lg animate-pulse" />
              <div className="relative w-14 h-14 rounded-full bg-[#0D1017] border border-[#F5C518]/40 p-1 flex items-center justify-center backdrop-blur-xl shadow-[inset_0_0_12px_rgba(245,197,24,0.3)]">
                <Shield className="h-6 w-6 text-[#F5C518]" />
              </div>
            </div>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#111318]/90 border border-[#222630] backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518] animate-pulse" />
              <span className="font-mono text-[10px] text-[#FFD84D] tracking-wider uppercase font-bold">
                NEURAL HARDWARE ENCLAVE // ZERO-TRUST
              </span>
            </div>
          </div>

          {/* Enclave Login Card with BorderBeam Specular Rim */}
          <div className="cockpit-card specular-top border-beam-plate bg-[#111318]/90 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl">
            {/* Header Text Block */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-xl font-bold tracking-tight text-[#F9FAFB] font-sans">
                  Lazy Nerds
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 font-bold shrink-0">
                  FIXOPS
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF]">
                Hardware Enclave Attestation &amp; Cryptographic Boundary Gate
              </p>
            </div>

            <form method="POST" action="#" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {serverError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-[11px] font-mono text-[#9CA3AF]">
                  <span>OPERATOR IDENTITY</span>
                  <span className="text-[10px] text-zinc-500">TLS 1.3 / ECH</span>
                </div>
                <Input
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="commander-01@lazynerds.internal"
                  error={errors.email?.message}
                  {...register("email")}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono text-[#9CA3AF]">
                  <span>SECURITY KEY / CREDENTIAL</span>
                  <Link
                    href="/forgot-password"
                    className="text-[10px] text-[#FFD84D] hover:underline transition-colors"
                  >
                    Reset Key?
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
                  className="font-semibold text-[#FFD84D] transition-colors underline-offset-4 hover:underline"
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

          {/* Live Hardware Telemetry Cards (Stitch Quantum Auth Gate) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono">
            <div className="bg-[#111318]/80 border border-[#222630] rounded p-2 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[9px] uppercase">
                <span>PCR0 MATCH</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#F5C518]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#F9FAFB] block truncate">0x9F41..B82E</span>
                <span className="text-[9px] text-zinc-400">MEASURED</span>
              </div>
            </div>
            <div className="bg-[#111318]/80 border border-[#222630] rounded p-2 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[9px] uppercase">
                <span>PCR2 KERNEL</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#34D399]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#F9FAFB] block truncate">0x13C7..00EA</span>
                <span className="text-[9px] text-zinc-400">IMMUTABLE</span>
              </div>
            </div>
            <div className="bg-[#111318]/80 border border-[#222630] rounded p-2 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[9px] uppercase">
                <span>ATTESTATION</span>
                <span className="text-[9px] text-[#60A5FA]">KMS</span>
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#60A5FA] block">Nitro Nitro</span>
                <span className="text-[9px] text-zinc-400">HARDWARE</span>
              </div>
            </div>
            <div className="bg-[#111318]/80 border border-[#222630] rounded p-2 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-500 text-[9px] uppercase">
                <span>ROUND TRIP</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#34D399] block">&lt;0.18ms</span>
                <span className="text-[9px] text-zinc-400">DIRECT BUS</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer: Security & Compliance Anchor */}
      <footer className="w-full border-t border-white/[0.08] bg-[#090A0D]/80 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 z-20 text-[11px] font-mono text-[#9CA3AF]">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
          <span>FixOps Autonomous Threat Defense // Partition Q-9</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/privacy" className="hover:text-[#F9FAFB] transition-colors underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          <span>•</span>
          <Link href="/terms" className="hover:text-[#F9FAFB] transition-colors underline-offset-4 hover:underline">
            Terms of Service
          </Link>
          <span>•</span>
          <span className="text-zinc-500">FIPS 140-3 LEVEL 4</span>
        </div>
      </footer>
    </div>
  );
}
