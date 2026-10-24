"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RegistrationStatusCheckResponse } from "@/types/registration";
import {
  Shield,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  HelpCircle,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";

function RegistrationStatusContent() {
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") || "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RegistrationStatusCheckResponse | null>(null);

  const fetchStatus = async (lookupEmail: string) => {
    if (!lookupEmail || !lookupEmail.includes("@")) {
      setError("Please provide a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await api.checkRegistrationStatus(lookupEmail);
      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(
        err.message || "No registration application found matching that email address."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialEmail) {
      fetchStatus(initialEmail);
    }
  }, [initialEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStatus(email);
  };

  return (
    <div className="min-h-screen bg-[#090A0D] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl font-bold tracking-tight text-[#F9FAFB]">
              Lazy Nerds
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 tracking-wider shrink-0">
              STATUS
            </span>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            Client Onboarding Application Tracker
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-[#222630] bg-[#111318]/90 p-5 sm:p-6 shadow-2xl backdrop-blur-md space-y-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-zinc-300 dark:text-[#9CA3AF]">
              Lookup by Corporate Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="representative@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-lg bg-[#161920] border border-[#222630] px-3 py-2 text-xs text-[#F9FAFB] placeholder-zinc-500 focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518]"
              />
              <Button
                type="submit"
                className="h-9 px-4 text-xs font-bold btn-glossy-gold"
                isLoading={loading}
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                <span>Search</span>
              </Button>
            </div>
          </form>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded-xl border border-[#222630] bg-[#161920] p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-[#222630] pb-2">
                <div>
                  <h4 className="font-semibold text-[#F9FAFB]">{result.company_name}</h4>
                  <p className="text-[11px] text-[#9CA3AF] font-mono">{result.email}</p>
                </div>
                <div>
                  {result.status === "approved" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold font-mono">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  )}
                  {result.status === "pending" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-semibold font-mono">
                      <Clock className="h-3.5 w-3.5" />
                      Pending Review
                    </span>
                  )}
                  {result.status === "needs_information" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-semibold font-mono">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Info Requested
                    </span>
                  )}
                  {result.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold font-mono">
                      <XCircle className="h-3.5 w-3.5" />
                      Not Approved
                    </span>
                  )}
                </div>
              </div>

              <div className="text-zinc-400 leading-relaxed text-[11px]">
                <p>{result.message}</p>
                {result.review_notes && (
                  <div className="mt-2 p-2 rounded-lg bg-[#111318] border border-[#222630] text-zinc-300">
                    <span className="font-semibold text-[#F9FAFB]">Founder Review Notes: </span>
                    {result.review_notes}
                  </div>
                )}
                {result.rejection_reason && (
                  <div className="mt-2 p-2 rounded-lg bg-rose-950/20 border border-rose-800/30 text-rose-300">
                    <span className="font-semibold text-rose-200">Reason: </span>
                    {result.rejection_reason}
                  </div>
                )}
              </div>

              {result.status === "approved" && (
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold btn-glossy-gold"
                  >
                    <span>Sign In to Your Workspace</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-between text-xs text-zinc-500">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 hover:text-[#F9FAFB] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
            <Link
              href="/register"
              className="text-[#B88700] dark:text-[#FFD84D] hover:underline transition-colors font-medium"
            >
              New Application
            </Link>
          </div>

          <div className="pt-3 border-t border-[#222630] text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-[#F5C518]" />
            <span>Encrypted client registration portal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RegistrationStatusPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <RegistrationStatusContent />
    </Suspense>
  );
}
