"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { FixOpsBackground, FixOpsAuthShield } from "@/components/ui/fixops-background";

const forgotPasswordSchema = z.object({
  email: z.string().email("Please provide a valid corporate or registered email address"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      await api.forgotPassword(data.email);
      setIsSubmitted(true);
    } catch (err: any) {
      setServerError(
        err.message || "Failed to process recovery request. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#030407] text-[#e2e8f0] antialiased min-h-screen relative flex flex-col justify-between overflow-x-hidden selection:bg-white/20 selection:text-white font-sans">
      {/* Persistent atmospheric background provided by RootLayout PersistentBackground */}

      {/* Minimalist Top Navigation Bar */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6 flex items-center justify-between">
        {/* Brand Anchor */}
        <Link
          aria-label="Lazy Nerds FixOps Home"
          className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus:ring-1 focus:ring-white/30 rounded px-1 shrink-0"
          href="/"
        >
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:scale-105 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#040609]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5V16.5Z" />
            </svg>
          </div>
          <span className="text-[15px] sm:text-[17px] font-semibold tracking-tight text-white flex items-center whitespace-nowrap">
            Lazy Nerds
            <span className="text-[#848c9c] font-normal ml-1.5 font-sans">FixOps</span>
          </span>
        </Link>

        {/* Secondary Action / Link to Sign in */}
        <nav aria-label="Primary Navigation" className="shrink-0">
          <Link
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 group active:scale-[0.98] whitespace-nowrap shrink-0"
            href="/login"
          >
            <span className="material-symbols-outlined text-[15px] group-hover:-translate-x-0.5 transition-transform text-white/80" data-icon="arrow_back">
              arrow_back
            </span>
            <span>Back to sign in</span>
          </Link>
        </nav>
      </header>

      {/* Central Canvas */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 my-auto">
        <div className="relative w-full max-w-[min(440px,calc(100vw-2rem))] mx-auto">
          {/* Persistent specular auth shield provided by RootLayout PersistentBackground */}

          {/* Recovery Frosted Glass Card */}
          <div className="relative backdrop-blur-2xl stitch-specular-card rounded-2xl p-6 sm:p-8 z-10 w-full">
            {isSubmitted ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[22px]">check_circle</span>
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-headline font-semibold text-white tracking-[-0.02em]">
                    Recovery Dispatched
                  </h2>
                  <p className="text-[13px] text-[#949dae] leading-relaxed">
                    If an authorized account matches{" "}
                    <span className="font-mono text-white font-medium">{getValues("email")}</span>, recovery
                    instructions have been sent.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#949dae] text-left space-y-1.5 font-mono">
                  <p className="font-semibold text-white">Security Protocol:</p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[#8e96a4]">
                    <li>Tokens are single-use and expire in 30 minutes.</li>
                    <li>Check your spam folder if not received promptly.</li>
                    <li>Unrecognized accounts are ignored to prevent enumeration.</li>
                  </ul>
                </div>
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[44px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                    <span>Return to Sign In</span>
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6 sm:mb-7">
                  <h1 className="text-2xl sm:text-[32px] font-headline font-semibold text-white tracking-[-0.02em] mb-2 leading-tight">
                    Recover account.
                  </h1>
                  <p className="text-[13px] text-[#949dae]">
                    Enter your verified corporate email to request recovery instructions.
                  </p>
                </div>

                {serverError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                    {serverError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide" htmlFor="recovery-email">
                      Registered Email Address
                    </label>
                    <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[46px]">
                      <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                        <span className="material-symbols-outlined text-[19px]" data-icon="alternate_email">
                          alternate_email
                        </span>
                      </div>
                      <input
                        id="recovery-email"
                        type="email"
                        autoComplete="email"
                        required
                        placeholder="operator@company.com"
                        className="w-full bg-transparent py-2.5 sm:py-3 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                        {...register("email")}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[12px] text-red-400 mt-1 font-mono">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>{isSubmitting ? "Dispatching..." : "Send Recovery Instructions"}</span>
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
                    Remembered credentials?{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Back to sign in
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Institutional Precision Footer */}
      <footer className="relative z-30 w-full max-w-7xl mx-auto border-t border-white/[0.08] px-4 sm:px-8 lg:px-12 py-4 sm:py-5 flex items-center justify-between text-[11px] sm:text-[13px] text-white/45 font-normal">
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
