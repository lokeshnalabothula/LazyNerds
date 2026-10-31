"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { DomainSecurityScoreResponse } from "@/types/domain";

function SecurityScoreContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const domainQuery = searchParams.get("domain") || "acroba-cloud.com";
  const tokenQuery = searchParams.get("token") || searchParams.get("verification_token") || null;
  const [targetDomain, setTargetDomain] = useState(domainQuery);

  const [scanResult, setScanResult] = useState<DomainSecurityScoreResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Normalize domain query param
  useEffect(() => {
    if (domainQuery) {
      const clean = domainQuery.trim().replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0].split(":")[0];
      setTargetDomain(clean || "acroba-cloud.com");
    }
  }, [domainQuery]);

  // Fetch security score from real backend assessment engine
  const fetchSecurityScore = useCallback(async (domain: string, proofToken: string | null) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const result = await api.getDomainSecurityScore(domain, proofToken);
      setScanResult(result);
      if (result.status === "failed") {
        setErrorMessage(result.error || "Perimeter assessment engine was unable to probe host.");
      }
    } catch (err: any) {
      console.error("Failed to fetch domain security score:", err);
      setErrorMessage(err.message || "Failed to connect to assessment engine.");
      setScanResult({
        status: "failed",
        domain,
        score: null,
        posture: "Score Unavailable",
        error: err.message,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (targetDomain) {
      fetchSecurityScore(targetDomain, tokenQuery);
    }
  }, [targetDomain, tokenQuery, fetchSecurityScore]);

  // Calculate gauge progress offset
  // Circumference = 2 * PI * 70 ≈ 440
  const CIRCUMFERENCE = 440;
  const scoreValue = scanResult?.score !== null && scanResult?.score !== undefined ? scanResult.score : null;
  const strokeOffset = scoreValue !== null ? Math.round(CIRCUMFERENCE * (1 - scoreValue / 100)) : CIRCUMFERENCE;

  // Determine stroke color and posture badge styles
  let strokeColor = "#64748B"; // slate fallback
  let postureLabel = "Score Unavailable";
  let postureBadgeClasses = "bg-slate-500/15 border-slate-500/30 text-slate-300";
  let postureIcon = (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  );

  if (isLoading) {
    postureLabel = "Scanning Perimeter...";
    postureBadgeClasses = "bg-sky-500/15 border-sky-500/30 text-sky-400";
    strokeColor = "#38BDF8";
    postureIcon = (
      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
      </svg>
    );
  } else if (scoreValue !== null) {
    if (scoreValue >= 80) {
      strokeColor = "#34D399"; // Emerald
      postureLabel = "Good Posture";
      postureBadgeClasses = "bg-emerald-500/15 border-emerald-500/30 text-emerald-400";
      postureIcon = (
        <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    } else if (scoreValue >= 60) {
      strokeColor = "#FBBF24"; // Amber
      postureLabel = "Moderate Risk";
      postureBadgeClasses = "bg-amber-500/15 border-amber-500/30 text-amber-400";
      postureIcon = (
        <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
      );
    } else {
      strokeColor = "#F43F5E"; // Rose
      postureLabel = "Critical Risk";
      postureBadgeClasses = "bg-rose-500/15 border-rose-500/30 text-rose-400";
      postureIcon = (
        <svg className="w-3.5 h-3.5 text-rose-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    }
  }

  const handleDownloadReport = () => {
    if (!scanResult) return;
    const reportData = {
      target_domain: targetDomain,
      scan_timestamp: scanResult.metadata?.audit_timestamp || new Date().toISOString(),
      report_generated_at: new Date().toISOString(),
      score: scanResult.score,
      posture: scanResult.posture,
      findings_count: scanResult.findings_count || 0,
      severity_summary: scanResult.severity_counts || {},
      findings: scanResult.findings || [],
      metadata: scanResult.metadata || {},
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fixops-security-report-${targetDomain}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between relative selection:bg-slate-700 selection:text-white bg-transparent text-[#f2f4f7] font-sans">
      {/* Top Telemetry Markings matching Stitch */}
      <div className="pointer-events-none absolute top-28 left-8 sm:left-12 text-[10px] font-mono-code text-slate-600 tracking-widest hidden sm:block">
        + 45° 12&apos; N
      </div>
      <div className="pointer-events-none absolute top-28 right-8 sm:right-12 text-[10px] font-mono-code text-slate-600 tracking-widest hidden sm:block">
        [X:00]
      </div>

      {/* Header Navigation matching FixOps Standard */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/20 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.3)] transition-transform group-hover:scale-105">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-heading text-base font-semibold text-white tracking-tight">Lazy Nerds</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-mono-code font-medium">FIXOPS</span>
            </div>
          </Link>
        </div>

        {/* Telemetry Status & Sign In Button */}
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-xs font-mono-code text-white hover:text-slate-300 hover:bg-white/10 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Console
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/20 text-xs font-mono-code text-white hover:text-slate-300 hover:bg-white/10 transition shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
              Sign in
            </Link>
          )}
        </div>
      </header>

      {/* Main Experience Stage */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 pt-2 pb-24 flex-1">
        <div className="min-h-[72vh] flex flex-col items-center justify-center py-12 px-4 relative z-10">
          <div className="glass-card relative rounded-2xl p-8 md:p-12 max-w-lg w-full flex flex-col items-center text-center overflow-hidden">
            {/* Top Specular Hairline */}
            <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

            {/* Target Domain Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono-code text-slate-300 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
              <span>{targetDomain}</span>
            </div>

            {/* Circular Gauge */}
            <div className="relative w-48 h-48 flex items-center justify-center my-2">
              <svg className="w-full h-full" viewBox="0 0 160 160">
                <circle className="gauge-circle-bg" cx="80" cy="80" fill="none" r="70" strokeWidth="8"></circle>
                <circle
                  className="gauge-circle-progress"
                  cx="80"
                  cy="80"
                  fill="none"
                  r="70"
                  strokeWidth="8"
                  stroke={strokeColor}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeOffset}
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isLoading ? (
                  <span className="font-heading text-4xl font-bold text-white/50 tracking-tight leading-none animate-pulse">
                    ...
                  </span>
                ) : scoreValue !== null ? (
                  <>
                    <span className="font-heading text-6xl font-bold text-white tracking-tight leading-none">
                      {scoreValue}
                    </span>
                    <span className="text-xs font-mono-code text-slate-400 mt-1">/ 100</span>
                  </>
                ) : (
                  <>
                    <span className="font-heading text-5xl font-bold text-slate-500 tracking-tight leading-none">
                      —
                    </span>
                    <span className="text-xs font-mono-code text-slate-500 mt-1">/ 100</span>
                  </>
                )}
              </div>
            </div>

            {/* Posture Pill Badge */}
            <div className="mt-6 mb-2">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-mono-code font-semibold uppercase tracking-wider ${postureBadgeClasses}`}>
                {postureIcon}
                <span>{postureLabel}</span>
              </div>
            </div>

            {/* Subtitle / Telemetry Detail */}
            <p className="text-xs text-slate-400 max-w-xs mt-2 font-mono-code">
              {isLoading
                ? "Executing live SSL, DNS, and HTTP security audit..."
                : scoreValue !== null
                ? "Overall perimeter security verified"
                : errorMessage || "Assessment engine could not probe host. Score unavailable."}
            </p>

            {/* Action Buttons Strip */}
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-8 pt-6 border-t border-white/5">
              {scoreValue !== null ? (
                <button
                  type="button"
                  onClick={handleDownloadReport}
                  className="w-full sm:flex-1 btn-liquid-metal py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(184,216,242,0.25)]"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  <span>Download Report</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fetchSecurityScore(targetDomain, tokenQuery)}
                  className="w-full sm:flex-1 btn-liquid-metal py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M23 4v6h-6"></path>
                    <path d="M1 20v-6h6"></path>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  <span>Re-run Assessment</span>
                </button>
              )}
            </div>

            {/* Additional Nav Link */}
            <div className="mt-4">
              <Link
                href={`/domain-verification?domain=${encodeURIComponent(targetDomain)}`}
                className="text-[11px] font-mono-code text-slate-500 hover:text-slate-300 transition"
              >
                ← Return to Domain Verification
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Restrained Minimalist Footer matching Stitch */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-slate-400">
        <div className="font-mono-code">Lazy Nerds © 2026 FixOps</div>
        <div className="flex items-center gap-6 mt-3 md:mt-0 font-mono-code text-xs">
          <Link className="hover:text-slate-300 transition" href="/terms">Rules of Engagement</Link>
          <Link className="hover:text-slate-300 transition" href="/privacy">Privacy</Link>
          <Link className="hover:text-slate-300 transition" href="/terms">Terms</Link>
        </div>
      </footer>
    </div>
  );
}

export default function SecurityScorePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-400 font-mono text-xs">
        Loading security score...
      </div>
    }>
      <SecurityScoreContent />
    </Suspense>
  );
}
