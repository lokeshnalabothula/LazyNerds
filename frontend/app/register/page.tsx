"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const router = useRouter();
  const { user, loading, setSession } = useAuth();

  const [step, setStep] = useState<"email" | "verify">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // If already authenticated, redirect to Overview
  useEffect(() => {
    if (!loading && user) {
      router.replace("/overview");
    }
  }, [user, loading, router]);

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please provide a valid corporate email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.sendRegistrationOtp(cleanEmail);
      setInfoMessage(res.message || "A verification code has been dispatched to your email.");
      setCooldown(res.cooldown_seconds || 60);
      setStep("verify");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to send verification code. Please check your email and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.resendRegistrationOtp(email.trim().toLowerCase());
      setInfoMessage(res.message || "A new verification code has been sent.");
      setCooldown(res.cooldown_seconds || 60);
      setCode("");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Unable to resend verification code. Please wait before retrying."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanCode = code.trim();
    if (cleanCode.length !== 6 || !/^\d+$/.test(cleanCode)) {
      setErrorMessage("Please enter the complete 6-digit numeric verification code.");
      return;
    }

    setIsSubmitting(true);
    try {
      const tokenResponse = await api.verifyRegistrationOtp({
        email: email.trim().toLowerCase(),
        code: cleanCode,
      });

      if (setSession) {
        setSession(tokenResponse);
      }
      router.push("/overview");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Verification code is invalid or has expired. Please request a new code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#030407] text-[#e2e8f0] antialiased min-h-screen relative flex flex-col justify-between overflow-x-hidden selection:bg-white/20 selection:text-white font-sans">
      {/* Atmospheric Cosmic & Planetary Horizon Background */}
      <div aria-hidden="true" className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {/* Grid lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:120px_120px]" />
        
        {/* Central Vertical Laser Ray */}
        <div className="vertical-axis-ray" />
        
        {/* Subtle reticle coordinate markers */}
        <div className="absolute top-[38%] left-[78px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
          + 45° 12&apos; N
        </div>
        <div className="absolute top-[41%] right-[68px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
          [X:00]
        </div>
        
        {/* Earth Limb & Atmospheric Arc */}
        <div className="stitch-earth-container">
          <div className="stitch-earth-surface-lights" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[180px] bg-cyan-100/15 rounded-full blur-[48px]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[70px] bg-white/40 rounded-full blur-[24px]" />
        </div>
      </div>

      {/* Minimalist Top Navigation Bar */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-6 sm:px-12 py-7 flex items-center justify-between">
        {/* Brand Anchor */}
        <Link
          aria-label="Lazy Nerds FixOps Home"
          className="flex items-center gap-3 group focus:outline-none focus:ring-1 focus:ring-white/30 rounded px-1"
          href="/"
        >
          <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:scale-105">
            <svg className="w-5 h-5 text-[#040609]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5V16.5Z" />
            </svg>
          </div>
          <span className="text-[17px] font-semibold tracking-tight text-white flex items-center">
            Lazy Nerds
            <span className="text-[#848c9c] font-normal ml-1.5">FixOps</span>
          </span>
        </Link>

        {/* Secondary Action / Link to Sign in */}
        <Link
          className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 group active:scale-[0.98]"
          href="/login"
        >
          <span>Sign in</span>
          <svg className="w-3.5 h-3.5 text-white/80 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
          </svg>
        </Link>
      </header>

      {/* Central Registration Canvas */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-[460px]">
          {/* Central Shield & Specular Apex Flare Background */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            <div className="relative flex items-center justify-center transform scale-[0.78] origin-center opacity-75">
              <svg className="absolute inset-0 w-[580px] h-[610px] pointer-events-none z-10 overflow-visible" fill="none" viewBox="0 0 580 610">
                <defs>
                  <linearGradient id="shieldRimGradReg" x1="50%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="35%" stopColor="#cbd5e1" stopOpacity="0.65" />
                    <stop offset="70%" stopColor="#64748b" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.8" />
                  </linearGradient>
                  <linearGradient id="shieldInnerRimGradReg" x1="50%" x2="50%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.2" />
                  </linearGradient>
                </defs>
                <path d="M 290 0 C 210 40 110 52 10 55 C 5 220 35 420 290 610" fill="none" opacity="0.6" stroke="url(#shieldRimGradReg)" strokeLinecap="round" strokeWidth="1.8" />
                <path d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610" fill="none" opacity="0.6" stroke="url(#shieldRimGradReg)" strokeLinecap="round" strokeWidth="1.8" />
                <path d="M 290 8 C 213 46 117 58 20 61" fill="none" opacity="0.75" stroke="url(#shieldInnerRimGradReg)" strokeWidth="1" />
                <path d="M 290 8 C 367 46 463 58 560 61" fill="none" opacity="0.75" stroke="url(#shieldInnerRimGradReg)" strokeWidth="1" />
                <path d="M 560 61 C 565 218 536 410 290 596 C 44 410 15 218 20 61" fill="none" opacity="0.4" stroke="url(#shieldInnerRimGradReg)" strokeWidth="1" />
              </svg>
              <div className="apex-flare" />
              <div className="stitch-shield-glass" />
            </div>
          </div>

          {/* Registration Frosted Glass Card */}
          <div className="relative backdrop-blur-2xl stitch-specular-card rounded-2xl p-7 sm:p-9 z-10">
            {step === "email" ? (
              <>
                <div className="text-center mb-7">
                  <h1 className="text-3xl sm:text-[34px] font-headline font-semibold text-white tracking-[-0.02em] mb-2 leading-tight">
                    Create an account.
                  </h1>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                    {errorMessage}
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleSendCode}>
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide" htmlFor="register-email">
                      Work Email
                    </label>
                    <div className="relative flex items-center stitch-input-chassis rounded-xl">
                      <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                        <span className="material-symbols-outlined text-[19px]" data-icon="alternate_email">
                          alternate_email
                        </span>
                      </div>
                      <input
                        autoComplete="email"
                        className="w-full bg-transparent py-3 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                        id="register-email"
                        name="email"
                        placeholder="operator@company.com"
                        required
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={isSubmitting}
                    >
                      <span>{isSubmitting ? "Sending code..." : "Continue"}</span>
                      <svg
                        className="w-4 h-4 transform group-hover:translate-x-1 transition-transform stroke-[2.4]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
                  <p className="text-[13px] text-[#949dae]">
                    Already have an account?{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-3xl sm:text-[34px] font-headline font-semibold text-white tracking-[-0.02em] mb-2 leading-tight">
                    Verify email.
                  </h1>
                  <p className="text-[13px] text-[#949dae]">
                    Enter the code sent to <span className="text-white font-mono">{email}</span>
                  </p>
                </div>

                {errorMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                    {errorMessage}
                  </div>
                )}

                {infoMessage && (
                  <div className="mb-4 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-[13px] leading-snug">
                    {infoMessage}
                  </div>
                )}

                <form className="space-y-4" onSubmit={handleVerifyCode}>
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide text-center" htmlFor="verification-code">
                      6-Digit Verification Code
                    </label>
                    <div className="relative flex items-center stitch-input-chassis rounded-xl">
                      <input
                        autoComplete="one-time-code"
                        autoFocus
                        className="w-full bg-transparent py-3 px-4 text-white placeholder-[#505a6c] font-mono text-[22px] tracking-[0.35em] text-center border-0 focus:ring-0 focus:outline-none"
                        id="verification-code"
                        inputMode="numeric"
                        maxLength={6}
                        name="code"
                        pattern="[0-9]*"
                        placeholder="••••••"
                        required
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[12px] font-mono text-[#8e96a4] px-1">
                    <button
                      className="hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      disabled={cooldown > 0 || isSubmitting}
                      type="button"
                      onClick={handleResendCode}
                    >
                      {cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
                    </button>
                    <button
                      className="hover:text-white transition-colors cursor-pointer"
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setErrorMessage(null);
                        setInfoMessage(null);
                        setCode("");
                      }}
                    >
                      Change email
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                      type="submit"
                      disabled={isSubmitting || code.length !== 6}
                    >
                      <span>{isSubmitting ? "Verifying..." : "Verify & activate"}</span>
                      <svg
                        className="w-4 h-4 transform group-hover:translate-x-1 transition-transform stroke-[2.4]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                </form>

                <div className="mt-6 pt-5 border-t border-white/[0.08] text-center">
                  <p className="text-[13px] text-[#949dae]">
                    Already have an account?{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Institutional Precision Footer */}
      <footer className="relative z-30 w-full max-w-7xl mx-auto border-t border-white/[0.08] px-6 sm:px-12 py-5 flex items-center justify-between text-[13px] text-white/45 font-normal">
        <div>Lazy Nerds © 2026</div>
        <div className="flex items-center gap-4">
          <Link className="hover:text-white/80 transition-colors" href="/privacy">
            Privacy
          </Link>
          <span className="text-white/20 select-none">|</span>
          <Link className="hover:text-white/80 transition-colors" href="/terms">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
