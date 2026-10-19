"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
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
    <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-24 h-24 rounded-2xl border border-zinc-800 bg-[#111318] shadow-2xl flex items-center justify-center overflow-hidden transition-transform hover:scale-105 duration-200 ring-2 ring-[#F5C518]/30">
            <Image
              src="/profile-sm.png"
              alt="Lazy Nerds FixOps Mascot"
              width={96}
              height={96}
              priority
              className="object-cover w-full h-full"
            />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-zinc-100 font-mono">
                LAZY NERDS
              </h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#F5C518]/15 text-[#F5C518] border border-[#F5C518]/30 tracking-widest">
                FIXOPS
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Client Onboarding Application Tracker
            </p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-xl backdrop-blur-sm space-y-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <label className="block text-xs font-medium text-zinc-300">
              Lookup by Corporate Email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                placeholder="representative@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
              />
              <Button
                type="submit"
                className="h-9 px-4 text-xs font-semibold"
                isLoading={loading}
              >
                <Search className="h-3.5 w-3.5 mr-1.5" />
                <span>Search</span>
              </Button>
            </div>
          </form>

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="rounded border border-zinc-800 bg-zinc-950/80 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div>
                  <h4 className="font-semibold text-zinc-200">{result.company_name}</h4>
                  <p className="text-[11px] text-zinc-500">{result.email}</p>
                </div>
                <div>
                  {result.status === "approved" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approved
                    </span>
                  )}
                  {result.status === "pending" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-semibold">
                      <Clock className="h-3.5 w-3.5" />
                      Pending Review
                    </span>
                  )}
                  {result.status === "needs_information" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-semibold">
                      <HelpCircle className="h-3.5 w-3.5" />
                      Info Requested
                    </span>
                  )}
                  {result.status === "rejected" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-semibold">
                      <XCircle className="h-3.5 w-3.5" />
                      Not Approved
                    </span>
                  )}
                </div>
              </div>

              <div className="text-zinc-400 leading-relaxed text-[11px]">
                <p>{result.message}</p>
                {result.review_notes && (
                  <div className="mt-2 p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                    <span className="font-semibold text-zinc-200">Founder Review Notes: </span>
                    {result.review_notes}
                  </div>
                )}
                {result.rejection_reason && (
                  <div className="mt-2 p-2 rounded bg-rose-950/20 border border-rose-800/30 text-rose-300">
                    <span className="font-semibold text-rose-200">Reason: </span>
                    {result.rejection_reason}
                  </div>
                )}
              </div>

              {result.status === "approved" && (
                <div className="pt-2">
                  <Link
                    href="/login"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-semibold bg-brand-500 text-zinc-950 hover:bg-brand-400 transition-colors"
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
              className="inline-flex items-center gap-1 hover:text-zinc-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Sign In</span>
            </Link>
            <Link
              href="/register"
              className="text-brand-400 hover:text-brand-300 transition-colors"
            >
              New Application
            </Link>
          </div>

          <div className="pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-500 text-center flex items-center justify-center gap-1.5 font-mono">
            <Shield className="h-3 w-3 text-brand-500" />
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
