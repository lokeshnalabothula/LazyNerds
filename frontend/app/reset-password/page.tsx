"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { FixOpsBackground, FixOpsAuthShield } from "@/components/ui/fixops-background";
import { FixOpsAppLoader } from "@/components/ui/loading";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Password must be at least 10 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one digit")
      .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const [isSuccess, setIsSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setValidationError("No recovery token provided. Please request a new recovery link.");
      return;
    }

    let isMounted = true;
    api
      .verifyResetToken(token)
      .then((res) => {
        if (!isMounted) return;
        setTokenValid(true);
        if (res.email_masked) setMaskedEmail(res.email_masked);
      })
      .catch((err: any) => {
        if (!isMounted) return;
        setTokenValid(false);
        setValidationError(
          err.message || "Password recovery link is invalid, expired, or has already been used."
        );
      })
      .finally(() => {
        if (isMounted) setVerifying(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await api.resetPassword(token, data.password);
      setIsSuccess(true);
    } catch (err: any) {
      setSubmitError(
        err.message || "Failed to reset password. The link may have expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (verifying) {
    return (
      <FixOpsAppLoader
        label="VERIFYING RECOVERY TOKEN"
        subtext="Validating cryptographic integrity & expiration…"
      />
    );
  }

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

          {/* Reset Password Frosted Glass Card */}
          <div className="relative backdrop-blur-2xl stitch-specular-card rounded-2xl p-6 sm:p-8 z-10 w-full">
            {!tokenValid ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <span className="material-symbols-outlined text-[22px]">error</span>
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-headline font-semibold text-white tracking-[-0.02em]">
                    Invalid or Expired Link
                  </h2>
                  <p className="text-[13px] text-[#949dae] leading-relaxed">
                    {validationError ||
                      "This password reset link is invalid or has expired. Recovery links are single-use and expire after 30 minutes."}
                  </p>
                </div>
                <div className="pt-2 flex flex-col gap-2">
                  <Link
                    href="/forgot-password"
                    className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[44px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                    <span>Request New Reset Link</span>
                  </Link>
                  <Link
                    href="/login"
                    className="text-[13px] text-[#8e96a4] hover:text-white transition-colors py-1"
                  >
                    Return to Sign In
                  </Link>
                </div>
              </div>
            ) : isSuccess ? (
              <div className="space-y-4 text-center">
                <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[22px]">check_circle</span>
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-headline font-semibold text-white tracking-[-0.02em]">
                    Password Reset Complete
                  </h2>
                  <p className="text-[13px] text-[#949dae] leading-relaxed">
                    Your new password has been securely stored. You can now access your workspace.
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => router.push("/login")}
                    className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[44px] py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Sign In</span>
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6 sm:mb-7">
                  <h1 className="text-2xl sm:text-[32px] font-headline font-semibold text-white tracking-[-0.02em] mb-2 leading-tight">
                    Set new password.
                  </h1>
                  <p className="text-[13px] text-[#949dae]">
                    {maskedEmail ? (
                      <>
                        Updating credentials for <span className="font-mono text-white font-medium">{maskedEmail}</span>
                      </>
                    ) : (
                      "Choose a strong, compliant password for your account."
                    )}
                  </p>
                </div>

                {submitError && (
                  <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                    {submitError}
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide" htmlFor="new-password">
                      New Password
                    </label>
                    <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[46px]">
                      <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                        <span className="material-symbols-outlined text-[19px]" data-icon="lock">
                          lock
                        </span>
                      </div>
                      <input
                        id="new-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="••••••••••••"
                        className="w-full bg-transparent py-2.5 sm:py-3 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                        {...register("password")}
                      />
                    </div>
                    {errors.password && (
                      <p className="text-[12px] text-red-400 mt-1 font-mono">{errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide" htmlFor="confirm-password">
                      Confirm New Password
                    </label>
                    <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[46px]">
                      <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                        <span className="material-symbols-outlined text-[19px]" data-icon="lock_reset">
                          lock_reset
                        </span>
                      </div>
                      <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        placeholder="••••••••••••"
                        className="w-full bg-transparent py-2.5 sm:py-3 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                        {...register("confirmPassword")}
                      />
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-[12px] text-red-400 mt-1 font-mono">{errors.confirmPassword.message}</p>
                    )}
                  </div>

                  {/* Policy requirements checklist */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] text-[11px] text-[#949dae] space-y-1 font-mono">
                    <p className="text-white font-medium">Policy Requirements:</p>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                      <span>• Min 10 characters</span>
                      <span>• Uppercase [A-Z]</span>
                      <span>• Lowercase [a-z]</span>
                      <span>• Digit [0-9]</span>
                      <span className="col-span-2">• Special symbol [!@#$%^&*...]</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>{isSubmitting ? "Updating..." : "Update Password & Sign In"}</span>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <FixOpsAppLoader
          label="INITIALIZING SECURITY SESSION"
          subtext="Loading credential recovery interface…"
        />
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
