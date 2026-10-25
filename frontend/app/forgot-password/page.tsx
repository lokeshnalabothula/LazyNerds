"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Shield, AlertCircle, CheckCircle2, ArrowLeft, Mail } from "lucide-react";

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
    <div className="min-h-screen bg-[#090A0D] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
              Lazy Nerds
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 tracking-wider shrink-0">
              RECOVERY
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Account Recovery & Security Verification
          </p>
        </div>

        {/* Form Card */}
        <div className="rounded-xl border border-[#222630] bg-[#111318]/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md">
          {isSubmitted ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Recovery Request Received
                </h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  If an authorized account matches{" "}
                  <span className="font-mono text-zinc-200">{getValues("email")}</span>, recovery
                  instructions have been dispatched.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-[#161920] border border-[#222630] text-[11px] text-[#9CA3AF] text-left space-y-1 font-mono">
                <p className="font-semibold text-zinc-300">Security Notes:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[#9CA3AF]">
                  <li>Tokens are single-use and expire in 30 minutes.</li>
                  <li>Check your spam or junk folder if not received.</li>
                  <li>Unrecognized accounts are silently ignored to prevent enumeration.</li>
                </ul>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#B88700] dark:text-[#FFD84D] hover:underline font-semibold"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Forgot your password?
                </h2>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">
                  Enter your verified account email to request a secure password reset link.
                </p>
              </div>

              {serverError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              <Input
                label="Registered Email Address"
                type="email"
                autoComplete="email"
                required
                placeholder="founder@lazynerds.com"
                error={errors.email?.message}
                {...register("email")}
              />

              <Button
                type="submit"
                variant="primary"
                className="w-full mt-2 h-10 text-xs font-bold"
                isLoading={isSubmitting}
              >
                <Mail className="h-4 w-4 mr-1.5" />
                <span>Send Recovery Instructions</span>
              </Button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-[#222630] text-[11px] text-[#9CA3AF] text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-[#F5C518]" />
            <span>Restricted to authorized Lazy Nerds personnel</span>
          </div>
        </div>

        {/* Support note */}
        <div className="text-center text-xs text-zinc-500">
          Need immediate assistance? Contact{" "}
          <a
            href="mailto:support@lazynerds.com"
            className="text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
          >
            support@lazynerds.com
          </a>
        </div>
      </div>
    </div>
  );
}
