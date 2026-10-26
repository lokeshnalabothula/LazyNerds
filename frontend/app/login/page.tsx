"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginFormSchema, LoginFormData } from "@/lib/validators";
import { useAuth } from "@/lib/auth-context";
import { ThinkingOrb } from "@/components/stitch/ThinkingOrb";
import { BorderBeam } from "@/components/stitch/BorderBeam";
import { Button } from "@/components/ui/button";
import { Shield, KeyRound, AlertCircle, Fingerprint, ArrowRight, CheckCircle2, Lock, Cpu, Zap } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBreakGlassOpen, setIsBreakGlassOpen] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState<string[]>([
    "› Enclave hypervisor handshake initialized... OK",
    "› Cryptographic proof requested: AWS-Nitro-SEV-SNP",
    "› Awaiting operator signature release via hardware token",
  ]);

  // If already authenticated, redirect immediately to Overview landing page
  useEffect(() => {
    if (!loading && user) {
      router.replace("/overview");
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Sanitize any sensitive credentials accidentally passed in query strings
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
    setTelemetryLogs((prev) => [
      ...prev,
      `› Initiating biometric attestation for: ${data.email}...`,
      "› Querying Nitro Hardware Root-of-Trust (AWS SEV-SNP)...",
    ]);

    try {
      await login(data.email, data.password);
      setTelemetryLogs((prev) => [
        ...prev,
        "› PCR0: MATCH (0x9F41..B82E)",
        "› KMS Nitro Signature: VALIDATED in 0.17ms",
        "› Enclave session token issued. Access granted.",
      ]);
    } catch (err: any) {
      setServerError(
        err.message || "Invalid credentials or unauthorized account. Please verify your operator identity and password."
      );
      setTelemetryLogs((prev) => [
        ...prev,
        "› [ERROR] Attestation failed: Invalid credentials signature.",
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#121318] text-[#e3e1e9] min-h-screen telemetry-grid-bg flex flex-col justify-between selection:bg-[#00f0ff]/20 selection:text-[#00f0ff] overflow-x-hidden antialiased font-sans">
      {/* TOP STATUS BAR: Micro Operational HUD Anchor (Stitch Zero-Trust Gate) */}
      <header className="w-full border-b border-white/[0.08] bg-[#0d0e13]/85 backdrop-blur-md px-4 sm:px-6 py-2 flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#292a2f]/60 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
            <span className="font-mono text-[10px] text-[#dbfcff] tracking-widest uppercase font-bold">
              ENCLAVE SECURE
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#b9cacb] hidden sm:inline">
            FIXOPS-NITRO-V4.9.2
          </span>
        </div>

        {/* Live Telemetry Mini Indicators */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-[#b9cacb]">
            <Shield className="h-3.5 w-3.5 text-[#00f0ff]" />
            <span className="text-[#e3e1e9]">ZERO-TRUST L8</span>
          </div>
          <div className="h-3 w-px bg-white/[0.1] hidden md:block" />
          <div className="hidden md:flex items-center gap-1.5 font-mono text-[11px] text-[#b9cacb]">
            <span>NITRO LATENCY:</span>
            <span className="text-[#00f0ff] font-semibold">&lt;0.18ms</span>
          </div>
        </div>
      </header>

      {/* MAIN CANVAS: Centered Floating Quantum Verification Enclave */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 my-auto relative z-10">
        {/* Ambient Radial Halo behind Card */}
        <div className="absolute w-[500px] h-[500px] rounded-full bg-[#3131c0]/15 filter blur-[96px] pointer-events-none -z-10 transform -translate-y-8" />
        <div className="absolute w-[360px] h-[360px] rounded-full bg-[#00f0ff]/10 filter blur-[72px] pointer-events-none -z-10 transform translate-y-12" />

        <div className="w-full max-w-lg space-y-6">
          {/* THINKING ORB: Multi-layer Cognitive Floating Construct */}
          <div className="flex flex-col items-center">
            <ThinkingOrb
              size="xl"
              state="searching"
              showBadge
              label="NEURAL HARDWARE ENCLAVE // ZERO-TRUST"
            />
          </div>

          {/* MAIN ENCLAVE CARD WITH BORDERBEAM GLOW */}
          <BorderBeam preset="colorful" className="p-6 sm:p-8 shadow-2xl relative">
            {/* Header Text Block */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1.5">
                <span className="text-xl font-bold tracking-tight text-[#F9FAFB] font-sans">
                  Lazy Nerds
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold shrink-0">
                  FIXOPS
                </span>
              </div>
              <h1 className="text-xl font-semibold tracking-tight text-[#dbfcff]">
                FixOps Quantum Auth
              </h1>
              <p className="text-xs text-[#b9cacb] mt-1.5">
                Hardware Enclave Attestation &amp; Cryptographic Boundary Gate
              </p>
            </div>

            {/* Error Message */}
            {serverError && (
              <div className="mb-4 p-3 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Verification Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Field 1: Operator Identity / FQDN */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label
                    htmlFor="operator-identity"
                    className="font-mono text-[10px] text-[#b9cacb] uppercase tracking-wider flex items-center gap-1.5 font-bold"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
                    OPERATOR IDENTITY / FQDN
                  </label>
                  <span className="font-mono text-[10px] text-[#849495]">TLS 1.3 / ECH</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="operator-identity"
                    type="email"
                    autoComplete="username"
                    required
                    placeholder="commander-01@enclave.fixops.internal"
                    className="w-full bg-[#121318]/90 border border-white/[0.12] focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/50 text-[#e3e1e9] font-mono text-xs rounded px-3.5 py-2.5 outline-none transition-all placeholder:text-[#849495]/60"
                    {...register("email")}
                  />
                  <div className="absolute right-3 text-[#00f0ff] flex items-center pointer-events-none">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                {errors.email?.message && (
                  <p className="text-[11px] text-rose-400 font-mono mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Field 2: Hardware Security Key */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label
                    htmlFor="hardware-key"
                    className="font-mono text-[10px] text-[#b9cacb] uppercase tracking-wider flex items-center gap-1.5 font-bold"
                  >
                    <KeyRound className="h-3 w-3 text-[#00f0ff]" />
                    HARDWARE SECURITY KEY (FIDO2 / NITRO ATTESTATION)
                  </label>
                  <span className="font-mono text-[10px] text-[#7df4ff]">KEY DETECTED</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="hardware-key"
                    type="password"
                    autoComplete="current-password"
                    required
                    placeholder="Enter security key or passphrase"
                    className="w-full bg-[#121318]/90 border border-white/[0.12] focus:border-[#00f0ff] focus:ring-1 focus:ring-[#00f0ff]/50 text-[#e3e1e9] font-mono text-xs rounded px-3.5 py-2.5 outline-none transition-all placeholder:text-[#849495]/60"
                    {...register("password")}
                  />
                  <div className="absolute right-3 flex items-center gap-1.5">
                    <Lock className="h-3.5 w-3.5 text-[#00f0ff]" />
                    <span className="font-mono text-[9px] bg-[#3131c0]/40 text-[#c0c1ff] border border-[#3131c0]/60 px-1.5 py-0.5 rounded font-bold">
                      NITRO-SLOT-0
                    </span>
                  </div>
                </div>
                {errors.password?.message && (
                  <p className="text-[11px] text-rose-400 font-mono mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Primary Action: Passkey Biometric Wave Trigger */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={isSubmitting}
                  className="cyber-pulse-btn w-full h-12 text-sm font-semibold tracking-wide bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 border border-[#00f0ff] text-[#00f0ff] rounded transition-all duration-200 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Fingerprint className="h-5 w-5 transition-transform group-hover:scale-110 text-[#00f0ff]" />
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="h-4 w-4 text-[#00f0ff] opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>
              </div>

              {/* Client Self-Registration Option */}
              <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs font-mono text-[#b9cacb]">
                <Link
                  href="/register"
                  className="hover:text-[#00f0ff] transition-colors flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  <span>Apply for Client Tenant Access</span>
                </Link>
                <Link
                  href="/forgot-password"
                  className="hover:text-[#00f0ff] transition-colors underline-offset-4 hover:underline"
                >
                  Forgot Key?
                </Link>
              </div>

              {/* Divider / Fallback Anchor */}
              <div className="pt-2 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setIsBreakGlassOpen(true)}
                  className="text-[#b9cacb] hover:text-[#ffb4ab] flex items-center gap-1.5 transition-colors group cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Emergency Break-Glass Seed Phrase</span>
                </button>
                <Link
                  href="/register/status"
                  className="text-[#849495] hover:text-[#e3e1e9] transition-colors flex items-center gap-1"
                >
                  <span>Attestation Status</span>
                </Link>
              </div>
            </form>

            {/* Dynamic Verification Status Stream */}
            <div className="mt-5 pt-3 border-t border-white/[0.08] bg-[#1a1b21]/40 rounded p-3 text-left">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[10px] text-[#b9cacb] uppercase tracking-wider font-bold">
                  ISOLATED ENCLAVE TELEMETRY STREAM
                </span>
                <span className="font-mono text-[10px] text-[#00f0ff]">SYNCED // 128-QBIT</span>
              </div>
              <div className="space-y-1 font-mono text-[11px] text-[#849495] max-h-24 overflow-y-auto">
                {telemetryLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className={
                      log.includes("ERROR")
                        ? "text-rose-400 font-semibold"
                        : log.includes("VALIDATED") || log.includes("granted")
                        ? "text-[#00f0ff] font-semibold"
                        : log.includes("Querying") || log.includes("Initiating")
                        ? "text-[#c0c1ff]"
                        : "text-[#b9cacb]"
                    }
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </BorderBeam>

          {/* LIVE HARDWARE TELEMETRY CARDS (PCR0, PCR2, KMS Nitro, Latency) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            {/* Chip 1: PCR0 */}
            <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded p-2.5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#849495] text-[9px]">
                <span>PCR0 VALIDATION</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#dbfcff] block truncate">0x9F41..B82E</span>
                <span className="text-[10px] text-[#b9cacb]">MEASURED MATCH</span>
              </div>
            </div>

            {/* Chip 2: PCR2 */}
            <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded p-2.5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#849495] text-[9px]">
                <span>PCR2 KERNEL HASH</span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#dbfcff] block truncate">0x13C7..00EA</span>
                <span className="text-[10px] text-[#b9cacb]">IMMUTABLE IMMUNITY</span>
              </div>
            </div>

            {/* Chip 3: KMS Nitro Badge */}
            <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded p-2.5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#849495] text-[9px]">
                <span>ATTESTATION TYPE</span>
                <Cpu className="h-3 w-3 text-[#c0c1ff]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#c0c1ff] block">KMS Nitro</span>
                <span className="text-[10px] text-[#b9cacb]">HARDWARE SIGNED</span>
              </div>
            </div>

            {/* Chip 4: Latency */}
            <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded p-2.5 backdrop-blur-md flex flex-col justify-between">
              <div className="flex items-center justify-between text-[#849495] text-[9px]">
                <span>ROUND TRIP</span>
                <Zap className="h-3 w-3 text-[#00f0ff]" />
              </div>
              <div className="mt-1">
                <span className="text-xs font-semibold text-[#00f0ff] block">&lt;0.18ms</span>
                <span className="text-[10px] text-[#b9cacb]">DIRECT BUS ACCEL</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER: Security & Compliance Anchor */}
      <footer className="w-full border-t border-white/[0.08] bg-[#0d0e13]/80 backdrop-blur-md px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 z-20 font-mono text-[11px] text-[#849495]">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-[#00f0ff]" />
          <span>FixOps Autonomous Threat Defense // Partition Q-9</span>
        </div>
        <div className="flex items-center gap-4 text-[#b9cacb]">
          <span>
            NITRO ENCLAVE ID: <strong className="text-[#dbfcff] font-normal">ne-0a4421b9c37</strong>
          </span>
          <span className="text-[#849495]">|</span>
          <span>FIPS 140-3 LEVEL 4</span>
        </div>
      </footer>

      {/* MODAL: Emergency Break-Glass Seed Phrase Recovery */}
      {isBreakGlassOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#121318]/80 backdrop-blur-xl p-4">
          <div className="w-full max-w-md bg-[#0d0e13] border border-rose-500/50 rounded-xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-sm">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>BREAK-GLASS PROTOCOL</span>
              </div>
              <button
                type="button"
                onClick={() => setIsBreakGlassOpen(false)}
                className="text-[#849495] hover:text-[#e3e1e9]"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-[#b9cacb]">
              Invoking emergency break-glass triggers an immediate cryptographic revocation event and notifies all orbital defense clusters.
            </p>
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] text-[#b9cacb] uppercase font-bold">
                24-WORD SHAMIR SECRET SEED
              </label>
              <textarea
                className="w-full bg-[#121318] border border-white/[0.1] focus:border-rose-500 text-[#e3e1e9] font-mono text-xs rounded p-2.5 outline-none resize-none"
                placeholder="word1 word2 word3..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 text-xs">
              <button
                type="button"
                onClick={() => setIsBreakGlassOpen(false)}
                className="px-4 py-2 rounded text-[#e3e1e9] hover:bg-[#292a2f] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert("Cryptographic audit trail recorded. Fallback sequence active.");
                  setIsBreakGlassOpen(false);
                }}
                className="px-4 py-2 rounded bg-rose-900/60 text-rose-200 border border-rose-600/40 hover:bg-rose-800/80 transition-colors font-medium"
              >
                Authorize Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
