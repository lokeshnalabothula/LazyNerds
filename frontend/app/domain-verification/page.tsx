"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { PublicDomainChallengeResponse } from "@/types/domain";

type VerificationMethod = "dns" | "file" | "meta";

function DomainVerificationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const domainQuery = searchParams.get("domain") || "acroba-cloud.com";
  const [targetDomain, setTargetDomain] = useState(domainQuery);
  const [activeMethod, setActiveMethod] = useState<VerificationMethod>("dns");

  const [challengeData, setChallengeData] = useState<PublicDomainChallengeResponse | null>(null);
  const [isLoadingChallenge, setIsLoadingChallenge] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "verified" | "failed">("idle");
  const [verificationProof, setVerificationProof] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Clean target domain parameter
  useEffect(() => {
    if (domainQuery) {
      const clean = domainQuery.trim().replace(/^https?:\/\//i, "").split("/")[0].split("?")[0].split("#")[0].split(":")[0];
      setTargetDomain(clean || "acroba-cloud.com");
    }
  }, [domainQuery]);

  // Fetch challenge instructions from backend
  const fetchChallenge = useCallback(async (domain: string) => {
    setIsLoadingChallenge(true);
    setVerificationStatus("idle");
    setVerificationProof(null);
    setStatusMessage("");
    try {
      const data = await api.getPublicDomainChallenge(domain);
      setChallengeData(data);
    } catch (err: any) {
      console.error("Failed to load verification challenge:", err);
      setStatusMessage(err.message || "Failed to initialize verification challenge from backend.");
    } finally {
      setIsLoadingChallenge(false);
    }
  }, []);

  useEffect(() => {
    if (targetDomain) {
      fetchChallenge(targetDomain);
    }
  }, [targetDomain, fetchChallenge]);

  const handleCopy = (text: string, key: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const handleDownloadTokenFile = () => {
    const content = challengeData?.file_instructions.expected_content || `lazynerds-verification=${challengeData?.token || ""}`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fixops-verification.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleVerify = async () => {
    if (!challengeData) return;

    setIsVerifying(true);
    setVerificationStatus("verifying");
    setStatusMessage(`Querying ${activeMethod.toUpperCase()} resolvers...`);

    try {
      const result = await api.verifyPublicDomain({
        domain: challengeData.normalized_domain,
        method: activeMethod,
        token: challengeData.token,
      });

      if (result.verified) {
        setVerificationStatus("verified");
        if (result.verification_proof) {
          setVerificationProof(result.verification_proof);
        }
        setStatusMessage(result.message || "Domain ownership cryptographically verified.");
      } else {
        setVerificationStatus("failed");
        setStatusMessage(result.message || "Verification record not found. Please verify configuration and retry.");
      }
    } catch (err: any) {
      setVerificationStatus("failed");
      setStatusMessage(err.message || "Verification request failed. Please check your network and retry.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleProceedToScore = () => {
    const verifiedParam = verificationStatus === "verified" ? "true" : "false";
    let url = `/security-score?domain=${encodeURIComponent(targetDomain)}&verified=${verifiedParam}`;
    if (verificationProof) {
      url += `&token=${encodeURIComponent(verificationProof)}`;
    }
    router.push(url);
  };

  const token = challengeData?.token || "generating-secure-token...";
  const dnsRecordHost = challengeData?.dns_instructions.record_host || "_lazynerds-verification";
  const dnsRecordValue = challengeData?.dns_instructions.record_value || `lazynerds-verification=${token}`;
  const filePath = challengeData?.file_instructions.relative_path || "/.well-known/fixops-verification.txt";
  const fileContent = challengeData?.file_instructions.expected_content || `lazynerds-verification=${token}`;
  const metaSnippet = challengeData?.meta_instructions.snippet || `<meta name="fixops-verification" content="${token}" />`;

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

        {/* Telemetry Status & Sign In Link */}
        <div className="flex items-center gap-4">
          {user ? (
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all text-xs font-medium text-slate-300 hover:text-white"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
              <span>Console</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all text-xs font-medium text-slate-300 hover:text-white"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/80 shadow-[0_0_6px_rgba(255,255,255,0.8)]"></span>
              <span>Sign in</span>
            </Link>
          )}
        </div>
      </header>

      {/* Main Experience Stage */}
      <main className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-16 flex-1 flex flex-col items-center justify-center">
        {/* Primary Verification Glass Chassis */}
        <div className="w-full glass-card rounded-2xl p-6 sm:p-7 md:p-9 relative overflow-hidden">
          {/* Top Specular Highlight Line */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>

          {/* Minimal Header & Target Domain Badge */}
          <div className="text-center max-w-xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/15 text-xs font-mono-code text-slate-200 mb-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
              <span>Target: <strong className="text-white font-medium">{targetDomain}</strong></span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-semibold text-white tracking-tight">Verify Your Domain</h1>
            <p className="mt-2 text-sm text-slate-400">
              Select a method to prove ownership and start security evaluation.
            </p>
          </div>

          {/* 3 Prominent Minimal Selection Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Option 1: DNS TXT Record */}
            <div
              onClick={() => setActiveMethod("dns")}
              className={`relative p-5 rounded-xl border flex flex-col justify-between group cursor-pointer transition ${
                activeMethod === "dns"
                  ? "border-sky-400/40 bg-white/[0.06] shadow-[0_0_20px_rgba(184,216,242,0.12)]"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeMethod === "dns"
                      ? "bg-sky-400/10 text-sky-300 border border-sky-400/20"
                      : "bg-white/5 text-slate-300 border border-white/10"
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect height="8" rx="2" ry="2" width="20" x="2" y="2"></rect>
                      <rect height="8" rx="2" ry="2" width="20" x="2" y="14"></rect>
                      <line x1="6" x2="6.01" y1="6" y2="6"></line>
                      <line x1="6" x2="6.01" y1="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Recommended
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">DNS TXT Record</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Add a single cryptographic TXT record to your DNS zone provider.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono-code text-slate-400">
                {activeMethod === "dns" ? (
                  <span className="text-sky-300 flex items-center gap-1 font-semibold">Selected ✓</span>
                ) : (
                  <span className="group-hover:text-slate-300 transition">Select →</span>
                )}
              </div>
            </div>

            {/* Option 2: HTML File Upload */}
            <div
              onClick={() => setActiveMethod("file")}
              className={`relative p-5 rounded-xl border flex flex-col justify-between group cursor-pointer transition ${
                activeMethod === "file"
                  ? "border-sky-400/40 bg-white/[0.06] shadow-[0_0_20px_rgba(184,216,242,0.12)]"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeMethod === "file"
                      ? "bg-sky-400/10 text-sky-300 border border-sky-400/20"
                      : "bg-white/5 text-slate-300 border border-white/10"
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" x2="8" y1="13" y2="13"></line>
                      <line x1="16" x2="8" y1="17" y2="17"></line>
                      <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono-code px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                    .well-known
                  </span>
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">HTML File Upload</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Upload a verification token file to /.well-known/fixops-verification.txt on your web server.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono-code text-slate-400">
                {activeMethod === "file" ? (
                  <span className="text-sky-300 flex items-center gap-1 font-semibold">Selected ✓</span>
                ) : (
                  <span className="group-hover:text-slate-300 transition">Select →</span>
                )}
              </div>
            </div>

            {/* Option 3: HTML Meta Tag */}
            <div
              onClick={() => setActiveMethod("meta")}
              className={`relative p-5 rounded-xl border flex flex-col justify-between group cursor-pointer transition ${
                activeMethod === "meta"
                  ? "border-sky-400/40 bg-white/[0.06] shadow-[0_0_20px_rgba(184,216,242,0.12)]"
                  : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    activeMethod === "meta"
                      ? "bg-sky-400/10 text-sky-300 border border-sky-400/20"
                      : "bg-white/5 text-slate-300 border border-white/10"
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="16 18 22 12 16 6"></polyline>
                      <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                  </div>
                  <span className="text-[10px] font-mono-code text-slate-500">CMS Friendly</span>
                </div>
                <h3 className="text-base font-semibold text-white tracking-tight">HTML Meta Tag</h3>
                <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                  Embed an authorization meta element in the &lt;head&gt; tag of your homepage.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono-code text-slate-400">
                {activeMethod === "meta" ? (
                  <span className="text-sky-300 flex items-center gap-1 font-semibold">Selected ✓</span>
                ) : (
                  <span className="group-hover:text-slate-300 transition">Select →</span>
                )}
              </div>
            </div>
          </div>

          {/* Active Method Detail Panel */}
          <div className="mb-8 p-5 rounded-xl bg-[#080b11]/80 border border-white/10">
            {isLoadingChallenge ? (
              <div className="flex items-center justify-center py-6 gap-2 text-xs font-mono-code text-slate-400">
                <svg className="w-4 h-4 animate-spin text-sky-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Generating secure verification challenge for {targetDomain}...</span>
              </div>
            ) : activeMethod === "dns" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono-code text-slate-300 font-semibold uppercase tracking-wider">
                    DNS Configuration Instructions
                  </span>
                  <span className="text-[11px] font-mono-code text-slate-500">TTL: 300 seconds</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono-code">
                  <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                    <div className="text-slate-500 text-[10px] uppercase mb-1">Host / Record Name</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-200 select-all truncate">{dnsRecordHost}</span>
                      <button
                        type="button"
                        onClick={() => handleCopy(dnsRecordHost, "dns_host")}
                        className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                      >
                        {copiedKey === "dns_host" ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                    <div className="text-slate-500 text-[10px] uppercase mb-1">Record Type</div>
                    <span className="text-sky-300 font-bold">TXT</span>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-xs font-mono-code">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">TXT Record Value</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 select-all break-all">{dnsRecordValue}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(dnsRecordValue, "dns_val")}
                      className="text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                    >
                      {copiedKey === "dns_val" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            ) : activeMethod === "file" ? (
              <div className="space-y-4 text-xs font-mono-code">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold uppercase tracking-wider">
                    Upload Auth File to Web Server
                  </span>
                  <span className="text-[11px] text-slate-500">File Name: fixops-verification.txt</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Primary Destination URL (RFC 8615)</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 select-all break-all">https://{targetDomain}/.well-known/fixops-verification.txt</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`https://${targetDomain}/.well-known/fixops-verification.txt`, "file_url_wellknown")}
                      className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                    >
                      {copiedKey === "file_url_wellknown" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Fallback Web Root Destination URL</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 select-all break-all">https://{targetDomain}/fixops-verification.txt</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`https://${targetDomain}/fixops-verification.txt`, "file_url_root")}
                      className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                    >
                      {copiedKey === "file_url_root" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">File Body Content</div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-slate-200 select-all break-all">{fileContent}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopy(fileContent, "file_body")}
                        className="text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                      >
                        {copiedKey === "file_body" ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadTokenFile}
                        className="text-[11px] px-2.5 py-1 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 transition shrink-0 flex items-center gap-1"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        <span>Download File</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 text-xs font-mono-code">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold uppercase tracking-wider">
                    Homepage &lt;head&gt; Meta Tag
                  </span>
                  <span className="text-[11px] text-slate-500">Attribute: name=&quot;fixops-verification&quot;</span>
                </div>
                <div className="p-3 rounded-lg bg-black/40 border border-white/10">
                  <div className="text-slate-500 text-[10px] uppercase mb-1">Paste into your index HTML &lt;head&gt;</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-200 select-all break-all">{metaSnippet}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(metaSnippet, "meta_tag")}
                      className="text-[11px] px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-white transition shrink-0"
                    >
                      {copiedKey === "meta_tag" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Message Indicator */}
            {verificationStatus !== "idle" && (
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs font-mono-code">
                {verificationStatus === "verifying" && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping"></span>
                    <span className="text-sky-300">{statusMessage}</span>
                  </>
                )}
                {verificationStatus === "verified" && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span className="text-emerald-400 font-semibold">{statusMessage}</span>
                  </>
                )}
                {verificationStatus === "failed" && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
                    <span className="text-rose-400">{statusMessage}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom Action Strip */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
            <Link
              href="/"
              className="text-xs font-mono-code text-slate-400 hover:text-slate-200 transition flex items-center gap-1.5"
            >
              <span>← Change target domain</span>
            </Link>

            {verificationStatus === "verified" ? (
              <button
                type="button"
                onClick={handleProceedToScore}
                className="w-full sm:w-auto btn-liquid-metal px-7 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(52,211,153,0.35)]"
              >
                <span>Proceed to Security Score</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            ) : (
              <button
                type="button"
                disabled={isVerifying || isLoadingChallenge}
                onClick={handleVerify}
                className="w-full sm:w-auto btn-liquid-metal px-7 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(184,216,242,0.25)] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                    </svg>
                    <span>Querying Resolvers...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {activeMethod === "dns"
                        ? "Continue with DNS Verification"
                        : activeMethod === "file"
                        ? "Continue with File Verification"
                        : "Continue with Meta Tag Verification"}
                    </span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </>
                )}
              </button>
            )}
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

export default function DomainVerificationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-transparent text-slate-400 font-mono text-xs">
        Loading verification workspace...
      </div>
    }>
      <DomainVerificationContent />
    </Suspense>
  );
}
