"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp" | "password" | "success">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number>(0);

  // Seamless form state preservation across auth card transitions
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem("fixops_auth_email");
        if (saved) {
          setEmail((prev) => prev || saved);
        }
      } catch {
        // Safe no-op
      }
    }
  }, []);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem("fixops_auth_email", val.trim());
      } catch {
        // Safe no-op
      }
    }
  };

  // Cooldown timer interval
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 10;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber;
  const doPasswordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  // Step 1: Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid corporate email address.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.sendForgotPasswordOtp(cleanEmail);
      setInfoMessage(res.message || "A 6-digit recovery code has been dispatched to your email address.");
      setCooldown(res.cooldown_seconds || 60);
      setStep("otp");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to dispatch recovery code. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || isSubmitting) return;
    setErrorMessage(null);
    setInfoMessage(null);
    setIsSubmitting(true);

    try {
      const res = await api.sendForgotPasswordOtp(email.trim().toLowerCase());
      setInfoMessage(res.message || "A new 6-digit recovery code has been dispatched.");
      setCooldown(res.cooldown_seconds || 60);
      setCode("");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Unable to resend code. Please wait before retrying."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
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
      const res = await api.verifyForgotPasswordOtp(email.trim().toLowerCase(), cleanCode);
      setResetToken(res.reset_token);
      setInfoMessage(res.message || "Code confirmed. Set your new password.");
      setStep("password");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Verification code is invalid or has expired. Please request a new code."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!isPasswordValid) {
      setErrorMessage("Password must be at least 10 characters and contain an uppercase letter, lowercase letter, and number.");
      return;
    }

    if (!doPasswordsMatch) {
      setErrorMessage("Passwords do not match. Please verify both fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.resetPasswordWithOtp(email.trim().toLowerCase(), resetToken, newPassword);
      setStep("success");
    } catch (err: any) {
      setErrorMessage(
        err.message || "Failed to update password. Your reset session may have expired. Please restart recovery."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-transparent text-[#e2e8f0] antialiased min-h-screen relative flex flex-col justify-between overflow-x-hidden selection:bg-white/20 selection:text-white font-sans">
      {/* Minimalist Top Navigation Bar */}
      <header className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6 flex items-center justify-between">
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

        <nav aria-label="Primary Navigation" className="shrink-0">
          <Link
            className="inline-flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 group active:scale-[0.98] whitespace-nowrap shrink-0"
            href="/login"
          >
            <span className="material-symbols-outlined text-[15px] group-hover:-translate-x-0.5 transition-transform text-white/80">
              arrow_back
            </span>
            <span>Back to sign in</span>
          </Link>
        </nav>
      </header>

      {/* Central Canvas */}
      <main className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 my-auto">
        <div className="relative w-full max-w-[min(440px,calc(100vw-2rem))] mx-auto">
          {/* Recovery Frosted Glass Card with stable panel dimensions */}
          <div className="relative backdrop-blur-2xl stitch-specular-card rounded-2xl p-6 sm:p-8 z-10 w-full min-h-[440px] flex flex-col justify-between">
            {step === "email" && (
              <>
                <div>
                  <div className="text-center mb-5 sm:mb-6">
                    <h1 className="text-2xl sm:text-[30px] font-headline font-semibold text-white tracking-[-0.02em] mb-1.5 leading-tight">
                      Recover account.
                    </h1>
                    <p className="text-[13px] text-[#949dae]">
                      Enter your corporate email to receive a 6-digit recovery code.
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                      {errorMessage}
                    </div>
                  )}

                  <form className="space-y-4" onSubmit={handleSendOtp}>
                    <div className="space-y-1">
                      <label className="block font-mono text-[11px] text-[#949dae] font-medium tracking-wide uppercase" htmlFor="recovery-email">
                        Work Email
                      </label>
                      <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[44px]">
                        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                          <span className="material-symbols-outlined text-[18px]">alternate_email</span>
                        </div>
                        <input
                          autoComplete="email"
                          autoFocus
                          className="w-full bg-transparent py-2.5 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                          id="recovery-email"
                          name="email"
                          placeholder="operator@company.com"
                          required
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                        type="submit"
                        disabled={isSubmitting}
                      >
                        <span>{isSubmitting ? "Dispatching code..." : "Send Recovery Instructions"}</span>
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
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
                  <p className="text-[13px] text-[#949dae]">
                    Remembered credentials?{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}

            {step === "otp" && (
              <>
                <div>
                  <div className="text-center mb-5 sm:mb-6">
                    <h1 className="text-2xl sm:text-[30px] font-headline font-semibold text-white tracking-[-0.02em] mb-1.5 leading-tight">
                      Verify code.
                    </h1>
                    <p className="text-[13px] text-[#949dae]">
                      Enter the 6-digit recovery code sent to <span className="text-white font-mono">{email}</span>
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

                  <form className="space-y-4" onSubmit={handleVerifyOtp}>
                    <div className="space-y-1.5">
                      <label className="block font-mono text-[12px] text-[#949dae] font-medium tracking-wide text-center uppercase" htmlFor="otp-code">
                        6-Digit Recovery Code
                      </label>
                      <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[48px]">
                        <input
                          autoComplete="one-time-code"
                          autoFocus
                          className="w-full bg-transparent py-2.5 sm:py-3 px-4 text-white placeholder-[#505a6c] font-mono text-[22px] tracking-[0.35em] text-center border-0 focus:ring-0 focus:outline-none"
                          id="otp-code"
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
                        onClick={handleResendOtp}
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
                        className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                        type="submit"
                        disabled={isSubmitting || code.length !== 6}
                      >
                        <span>{isSubmitting ? "Verifying..." : "Verify code"}</span>
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
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
                  <p className="text-[13px] text-[#949dae]">
                    Return to{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}

            {step === "password" && (
              <>
                <div>
                  <div className="text-center mb-5 sm:mb-6">
                    <h1 className="text-2xl sm:text-[30px] font-headline font-semibold text-white tracking-[-0.02em] mb-1.5 leading-tight">
                      Set new password.
                    </h1>
                    <p className="text-[13px] text-[#949dae]">
                      Create a strong password for <span className="text-white font-mono">{email}</span>
                    </p>
                  </div>

                  {errorMessage && (
                    <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-[13px] leading-snug">
                      {errorMessage}
                    </div>
                  )}

                  <form className="space-y-3.5" onSubmit={handleResetPassword}>
                    {/* New Password */}
                    <div className="space-y-1">
                      <label className="block font-mono text-[11px] text-[#949dae] font-medium tracking-wide uppercase" htmlFor="new-password">
                        New Password
                      </label>
                      <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[44px]">
                        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                          <span className="material-symbols-outlined text-[18px]">lock</span>
                        </div>
                        <input
                          autoComplete="new-password"
                          autoFocus
                          className="w-full bg-transparent py-2.5 pr-10 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                          id="new-password"
                          name="newPassword"
                          placeholder="••••••••••••"
                          required
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 text-[#758195] hover:text-white transition-colors cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>

                      {/* Password Requirements Checklist */}
                      {newPassword.length > 0 && (
                        <div className="pt-1.5 grid grid-cols-2 gap-1 text-[11px] font-mono text-[#8e96a4]">
                          <span className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-400" : ""}`}>
                            <span className="text-[12px]">{hasMinLength ? "✓" : "○"}</span> 10+ characters
                          </span>
                          <span className={`flex items-center gap-1 ${hasUpper ? "text-emerald-400" : ""}`}>
                            <span className="text-[12px]">{hasUpper ? "✓" : "○"}</span> Uppercase
                          </span>
                          <span className={`flex items-center gap-1 ${hasLower ? "text-emerald-400" : ""}`}>
                            <span className="text-[12px]">{hasLower ? "✓" : "○"}</span> Lowercase
                          </span>
                          <span className={`flex items-center gap-1 ${hasNumber ? "text-emerald-400" : ""}`}>
                            <span className="text-[12px]">{hasNumber ? "✓" : "○"}</span> Number
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div className="space-y-1">
                      <label className="block font-mono text-[11px] text-[#949dae] font-medium tracking-wide uppercase" htmlFor="confirm-password">
                        Confirm New Password
                      </label>
                      <div className="relative flex items-center stitch-input-chassis rounded-xl min-h-[44px]">
                        <div className="pl-3.5 pr-2 flex items-center pointer-events-none text-[#758195]">
                          <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                        </div>
                        <input
                          autoComplete="new-password"
                          className="w-full bg-transparent py-2.5 pr-3.5 pl-1 text-white placeholder-[#505a6c] font-sans text-[14px] leading-6 border-0 focus:ring-0 focus:outline-none"
                          id="confirm-password"
                          name="confirmPassword"
                          placeholder="••••••••••••"
                          required
                          type={showPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>
                      {confirmPassword.length > 0 && (
                        <div className="pt-1 text-[11px] font-mono">
                          {doPasswordsMatch ? (
                            <span className="text-emerald-400 flex items-center gap-1">✓ Passwords match</span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1">○ Passwords do not match</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2">
                      <button
                        className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
                        type="submit"
                        disabled={isSubmitting || !isPasswordValid || !doPasswordsMatch}
                      >
                        <span>{isSubmitting ? "Updating password..." : "Reset password"}</span>
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
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.08] text-center">
                  <p className="text-[13px] text-[#949dae]">
                    Return to{" "}
                    <Link className="text-white font-medium hover:underline underline-offset-4 transition-colors" href="/login">
                      Sign in
                    </Link>
                  </p>
                </div>
              </>
            )}

            {step === "success" && (
              <div className="space-y-5 text-center my-auto py-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[26px]">check_circle</span>
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-headline font-semibold text-white tracking-[-0.02em]">
                    Password Reset Complete
                  </h2>
                  <p className="text-[13px] text-[#949dae] leading-relaxed max-w-xs mx-auto">
                    Your password has been successfully updated. You may now sign in with your new credentials.
                  </p>
                </div>

                <div className="pt-3">
                  <Link
                    href={`/login?email=${encodeURIComponent(email)}`}
                    className="w-full stitch-liquid-metal-btn text-[#070d18] font-sans text-[15px] font-semibold min-h-[46px] py-3 px-5 rounded-xl flex items-center justify-center gap-2 group transition-all duration-150 active:scale-[0.98]"
                  >
                    <span>Proceed to Sign In</span>
                    <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform stroke-[2.4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              </div>
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
