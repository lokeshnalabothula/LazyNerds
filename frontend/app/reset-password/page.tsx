"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FixOpsAppLoader } from "@/components/ui/loading";
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
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
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-16 h-16 rounded-2xl border border-brand-500/30 bg-zinc-900/90 p-1.5 shadow-xl flex items-center justify-center overflow-hidden">
            <Image
              src="/brand/logo.png"
              alt="Lazy Nerds"
              width={56}
              height={56}
              priority
              className="object-contain rounded-xl"
            />
          </div>
          <div className="space-y-0.5">
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 font-mono">
              LAZY NERDS FIXOPS
            </h1>
            <p className="text-xs text-zinc-400">
              Account Security & Password Reset
            </p>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-sm">
          {!tokenValid ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Invalid or Expired Link
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {validationError ||
                    "This password reset link is invalid or has expired. Recovery links are single-use and expire after 30 minutes."}
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <Link
                  href="/forgot-password"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded text-xs font-semibold bg-brand-500 text-zinc-950 hover:bg-brand-400 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Request New Reset Link</span>
                </Link>
                <Link
                  href="/login"
                  className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors py-1"
                >
                  Return to Sign In
                </Link>
              </div>
            </div>
          ) : isSuccess ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Password Reset Complete
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Your new password has been securely stored. You can now access your workspace.
                </p>
              </div>
              <div className="pt-2">
                <Button
                  onClick={() => router.push("/login")}
                  className="w-full h-10 text-xs font-semibold"
                >
                  <span>Proceed to Sign In</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Set New Password
                </h2>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {maskedEmail ? (
                    <>
                      Updating credentials for{" "}
                      <span className="font-mono text-zinc-200">{maskedEmail}</span>.
                    </>
                  ) : (
                    "Choose a strong, compliant password for your account."
                  )}
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              <Input
                label="New Password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••••••"
                error={errors.password?.message}
                {...register("password")}
              />

              <Input
                label="Confirm New Password"
                type="password"
                autoComplete="new-password"
                required
                placeholder="••••••••••••"
                error={errors.confirmPassword?.message}
                {...register("confirmPassword")}
              />

              {/* Security requirements checklist */}
              <div className="p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1 font-mono">
                <p className="text-zinc-300 font-medium">Policy Requirements:</p>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                  <span>• Minimum 8 characters</span>
                  <span>• Uppercase letter [A-Z]</span>
                  <span>• Lowercase letter [a-z]</span>
                  <span>• Number [0-9]</span>
                  <span className="col-span-2">• Special character [!@#$%^&*...]</span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full mt-2 h-10 text-xs font-semibold"
                isLoading={isSubmitting}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                <span>Update Password & Sign In</span>
              </Button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-zinc-800/80 text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-brand-500" />
            <span>End-to-end encrypted password verification</span>
          </div>
        </div>
      </div>
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
