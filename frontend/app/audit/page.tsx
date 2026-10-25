"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanTelemetryModal } from "@/components/findings/scan-telemetry-modal";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Client } from "@/types/client";
import { Engagement, WebsiteAuditResponse } from "@/types/engagement";
import {
  Globe,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Lock,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
  Zap,
  Info,
  Clock,
  Building2,
  FileCheck2,
  GitBranch,
  Terminal,
  Activity,
} from "lucide-react";

export default function WebsiteAuditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isClientRole = user?.role === "client";

  // Form State
  const [url, setUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [scanMode] = useState<"blackbox">("blackbox");
  const [confirmedAuth, setConfirmedAuth] = useState(false);
  const [notes, setNotes] = useState("");

  // UI / Async State
  const [clients, setClients] = useState<Client[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<WebsiteAuditResponse | null>(null);
  const [isTelemetryModalOpen, setIsTelemetryModalOpen] = useState(false);

  // Load clients and active engagements
  const loadInitialData = useCallback(async () => {
    setIsLoadingClients(true);
    try {
      const [clientsRes, engRes] = await Promise.all([
        api.getClients({ page: 1, page_size: 50, status: "active" }),
        api.getEngagements({ page: 1, page_size: 50, status: "in_progress" }),
      ]);
      setClients(clientsRes.items);
      setEngagements(engRes.items);

      // Default client selection
      if (clientsRes.items.length > 0) {
        if (isClientRole && user?.client_id) {
          setClientId(user.client_id);
        } else {
          setClientId(clientsRes.items[0].id);
        }
      }
    } catch (err: any) {
      console.error("Failed to load audit initial data:", err);
    } finally {
      setIsLoadingClients(false);
    }
  }, [isClientRole, user]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Real-time URL SSRF & Security Validation
  const urlValidation = useMemo(() => {
    const trimmed = url.trim();
    if (!trimmed) {
      return {
        isValid: false,
        message: "Enter a fully qualified web application URL (e.g. https://example.com or http://127.0.0.1:8888)",
        severity: "neutral",
      };
    }

    const lower = trimmed.toLowerCase();

    // Check scheme
    if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
      return {
        isValid: false,
        message: "Invalid URL protocol. Only standard http:// and https:// URLs are supported.",
        severity: "error",
      };
    }

    // Check dangerous schemes
    if (
      lower.startsWith("javascript:") ||
      lower.startsWith("file:") ||
      lower.startsWith("data:") ||
      lower.startsWith("ftp:")
    ) {
      return {
        isValid: false,
        message: "Dangerous URI scheme detected. Target is strictly blocked by security policy.",
        severity: "critical",
      };
    }

    // Parse URL
    try {
      const parsed = new URL(trimmed);
      const host = parsed.hostname.toLowerCase();
      const port = parsed.port;

      // Blocked Cloud Metadata addresses (unconditionally blocked)
      if (
        host === "169.254.169.254" ||
        host === "169.254.170.2" ||
        host === "100.100.100.200" ||
        host.includes("metadata.google.internal") ||
        host.includes("instance-data")
      ) {
        return {
          isValid: false,
          message: "SSRF Violation: Cloud instance metadata addresses are strictly prohibited.",
          severity: "critical",
        };
      }

      // Prohibited Infrastructure / Database Ports (including FixOps self-ports)
      if (["22", "25", "53", "3000", "3306", "5432", "6379", "7233", "8000", "8233", "27017"].includes(port)) {
        return {
          isValid: false,
          message: `SSRF Violation: Target port ${port} is an internal infrastructure service. Self-scanning FixOps services is prohibited.`,
          severity: "critical",
        };
      }

      // Loopback / Localhost handling
      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "0.0.0.0" ||
        host === "::1" ||
        host === "[::1]" ||
        host.includes("::") ||
        host.endsWith(".localhost")
      ) {
        if (port === "8888") {
          return {
            isValid: true,
            message: "Authorized Local Lab Target: Vulnerable Test Application (Port 8888)",
            severity: "success",
            hostname: host,
          };
        }
        return {
          isValid: false,
          message: "SSRF Violation: Loopback addresses are blocked. Only the authorized vulnerable lab on port 8888 is permitted in development.",
          severity: "critical",
        };
      }

      // Blocked RFC 1918 Private Subnets
      if (
        host.startsWith("10.") ||
        host.startsWith("192.168.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
      ) {
        return {
          isValid: false,
          message: "SSRF Violation: Private RFC 1918 subnets are restricted. Audit requires a routable web target.",
          severity: "critical",
        };
      }

      // Valid target
      return {
        isValid: true,
        message: `Authorized Web Target: ${host} (Port ${port || (parsed.protocol === "https:" ? "443" : "80")})`,
        severity: "success",
        hostname: host,
      };
    } catch {
      return {
        isValid: false,
        message: "Malformed URL syntax. Please verify host and domain format.",
        severity: "error",
      };
    }
  }, [url]);

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!urlValidation.isValid) {
      setSubmitError(urlValidation.message);
      return;
    }

    if (!clientId) {
      setSubmitError("Please select a client organization to anchor this audit scope.");
      return;
    }

    if (!confirmedAuth) {
      setSubmitError("You must certify written authorization to perform security testing on this domain.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.submitWebsiteAudit({
        url: url.trim(),
        client_id: clientId,
        engagement_id: engagementId || undefined,
        scan_mode: "blackbox",
        confirmed_authorization: confirmedAuth,
        notes: notes.trim() || undefined,
      });

      setAuditResult(res);
      setIsTelemetryModalOpen(true);
      // Reset input URL on success
      setUrl("");
      setNotes("");
    } catch (err: any) {
      setSubmitError(err.message || "Failed to initiate website security audit. Please check connectivity.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell title="Website Security Audit">
      <div className="space-y-6 max-w-5xl mx-auto pb-16">
        {/* Cockpit Header Card */}
        <div className="cockpit-card specular-top border-[#F5C518]/30 p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="h-12 w-12 rounded-xl border border-[#F5C518]/40 bg-[#161920] shadow-[0_2px_12px_rgba(245,197,24,0.15)] flex items-center justify-center shrink-0 text-[#F5C518]">
                <Globe className="h-6 w-6 text-[#F5C518]" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB]">
                    Website Security Audit
                  </h1>
                  <span className="badge-cyber bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border-[#F5C518]/35 shrink-0">
                    Automated URL Assessment
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] leading-relaxed max-w-2xl">
                  Paste a fully qualified website URL to execute automated vulnerability scans, verify SSL/TLS cipher hygiene, detect exposed assets, and generate compliance audit records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link href="/engagements">
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  <span>View All Engagements</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Audit Success Banner / Active Assessment Telemetry */}
        {auditResult && (
          <div className="cockpit-card specular-top p-5 border-emerald-500/30 bg-emerald-950/15 shadow-lg space-y-4 animate-fadeIn">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-semibold text-emerald-300">
                      Website Security Audit Dispatched
                    </h3>
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active Scanner Dispatch
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 mt-1">
                    Target: <strong className="font-mono text-emerald-400">{auditResult.target_url}</strong> • Tool:{" "}
                    <span className="font-mono text-zinc-200 uppercase">{auditResult.assessment_tool}</span> • Status:{" "}
                    <span className="capitalize font-mono text-emerald-300">{auditResult.assessment_status}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAuditResult(null)}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Dismiss
              </button>
            </div>

            <div className="pt-2 border-t border-emerald-500/20 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsTelemetryModalOpen(true)}
                className="text-xs h-8 gap-1.5 font-bold"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Open Live Scan Telemetry</span>
              </Button>
              <Link href={`/findings?engagement_id=${auditResult.engagement_id}`}>
                <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5 text-[#F5C518]" />
                  <span>Inspect Findings</span>
                </Button>
              </Link>
              <Link href={`/engagements/${auditResult.engagement_id}`}>
                <Button variant="ghost" size="sm" className="text-xs h-8 gap-1.5 text-zinc-300 hover:text-white">
                  <span>Open Engagement Details</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </div>
        )}

        {/* Target URL Submission Form */}
        <form onSubmit={handleSubmit} className="cockpit-card specular-top p-6 shadow-md space-y-6">
          <div className="space-y-1 border-b border-white/[0.08] pb-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB] flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#F5C518]" />
              <span>Target Configuration & Security Boundaries</span>
            </h2>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
              All audit requests are validated against strict SSRF controls and tied to registered organization scope.
            </p>
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="target-url" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Website Target URL <span className="text-[#F5C518]">*</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setUrl("http://127.0.0.1:8888");
                  setConfirmedAuth(true);
                  setNotes("Authorized Local Vulnerable Lab verification (OWASP Benchmark).");
                }}
                className="text-[11px] text-[#F5C518] hover:underline flex items-center gap-1 font-medium transition-colors"
              >
                <Zap className="h-3 w-3" />
                <span>Use Local Vulnerable Lab (127.0.0.1:8888)</span>
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                <Globe className="h-4 w-4" />
              </div>
              <input
                id="target-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://app.yourdomain.com or http://127.0.0.1:8888"
                className="w-full h-10 pl-10 pr-4 text-xs rounded-lg glass-input text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Real-time SSRF / Validation Feedback Chip */}
            <div
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 transition-all ${
                urlValidation.severity === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/25 text-emerald-400"
                  : urlValidation.severity === "critical"
                  ? "bg-rose-500/10 border border-rose-500/25 text-rose-400 font-medium"
                  : urlValidation.severity === "error"
                  ? "bg-amber-500/10 border border-amber-500/25 text-amber-400"
                  : "bg-white/[0.03] border border-white/[0.06] text-slate-400"
              }`}
            >
              {urlValidation.severity === "success" && <ShieldCheck className="h-4 w-4 shrink-0" />}
              {urlValidation.severity === "critical" && <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />}
              {urlValidation.severity === "error" && <AlertTriangle className="h-4 w-4 shrink-0" />}
              {urlValidation.severity === "neutral" && <Info className="h-4 w-4 shrink-0" />}
              <span className="leading-tight">{urlValidation.message}</span>
            </div>
          </div>

          {/* Client Organization & Engagement Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Organization */}
            <div className="space-y-1.5">
              <label htmlFor="client-select" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Client Organization <span className="text-[#F5C518]">*</span>
              </label>
              <select
                id="client-select"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                disabled={isClientRole || isLoadingClients || isSubmitting}
                className="w-full h-10 rounded-lg border border-white/[0.08] bg-[#07090E]/90 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id} className="bg-[#07090E] text-slate-200">
                    {c.company_name} ({c.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Engagement Association */}
            <div className="space-y-1.5">
              <label htmlFor="engagement-select" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                Audit Engagement Scope
              </label>
              <select
                id="engagement-select"
                value={engagementId}
                onChange={(e) => setEngagementId(e.target.value)}
                disabled={isSubmitting}
                className="w-full h-10 rounded-lg border border-white/[0.08] bg-[#07090E]/90 px-3 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              >
                <option value="" className="bg-[#07090E] text-[#FFD84D]">
                  ✨ Create On-Demand Audit Engagement (Recommended)
                </option>
                {engagements
                  .filter((e) => !clientId || e.client_id === clientId)
                  .map((e) => (
                    <option key={e.id} value={e.id} className="bg-[#07090E] text-slate-200">
                      {e.name} ({e.status})
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Audit Profile Selection */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Audit Scan Methodology
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className="p-3.5 rounded-xl border border-[#F5C518] bg-[#F5C518]/10 shadow-sm flex items-start gap-3 cursor-default"
              >
                <input
                  type="radio"
                  name="scan-mode"
                  value="blackbox"
                  checked={true}
                  readOnly
                  className="mt-0.5 text-[#F5C518] focus:ring-[#F5C518]"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] block">
                      Blackbox Vulnerability Scan (Active)
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
                      READY
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 dark:text-[#9CA3AF] block leading-relaxed">
                    Passive and active perimeter probes: TLS ciphers, CORS, security headers, OWASP Top 10 exposed endpoints. URL-only, no source required.
                  </span>
                </div>
              </label>

              <label
                className="p-3.5 rounded-xl border border-white/[0.08] bg-white/[0.02] opacity-60 cursor-not-allowed flex items-start gap-3"
              >
                <input
                  type="radio"
                  name="scan-mode"
                  value="source_assisted"
                  disabled={true}
                  checked={false}
                  className="mt-0.5 text-zinc-600 focus:ring-0 cursor-not-allowed"
                />
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-zinc-400 block">
                      Source-Assisted Dynamic Pentest
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                      UNAVAILABLE
                    </span>
                  </div>
                  <span className="text-[11px] text-zinc-500 block leading-relaxed">
                    Requires mounted repository acquisition and Shannon AI agent container deployment. For automated URL assessments, select Blackbox Vulnerability Scan.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Scope Notes */}
          <div className="space-y-1.5">
            <label htmlFor="audit-notes" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Audit Directives & Scope Notes (Optional)
            </label>
            <input
              id="audit-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Target authenticated endpoints; avoid rate-limited checkout routes"
              className="w-full h-10 px-3 text-xs rounded-lg glass-input text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              disabled={isSubmitting}
            />
          </div>

          {/* Written Authorization Declaration */}
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 space-y-2">
            <div className="flex items-start gap-3">
              <input
                id="confirm-auth"
                type="checkbox"
                checked={confirmedAuth}
                onChange={(e) => setConfirmedAuth(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-400 text-[#F5C518] focus:ring-[#F5C518] cursor-pointer shrink-0"
                required
              />
              <label htmlFor="confirm-auth" className="text-xs text-zinc-200 leading-relaxed cursor-pointer select-none">
                <strong className="text-amber-300">Mandatory Rules of Engagement (RoE) Certification:</strong> I certify and declare under penalty of authorization revocation that our organization holds explicit written authorization and legal consent from the domain owner to perform automated security assessment and scanning against this target.
              </label>
            </div>
          </div>

          {/* Error Message */}
          {submitError && (
            <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Submit Action: Single prominent primary action */}
          <div className="pt-2 flex items-center justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!urlValidation.isValid || !confirmedAuth || isSubmitting}
              isLoading={isSubmitting}
              className="text-xs h-10 px-6 gap-2 font-bold w-full sm:w-auto shadow-md"
            >
              <Zap className="h-4 w-4 text-[#090A0D]" />
              <span>Launch Website Audit</span>
            </Button>
          </div>
        </form>

        {/* Audit Pipeline Architecture Notice */}
        <div className="cockpit-card specular-top p-5 shadow-sm space-y-2 text-xs text-slate-400">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Info className="h-4 w-4 text-[#F5C518]" />
            <span>How FixOps Automated Website Audits Run</span>
          </div>
          <p className="leading-relaxed">
            FixOps validates your target URL against SSRF filters, binds the web target to an active client engagement, and registers an assessment execution job with the scanner worker daemon. Real findings are ingested into the database as SARIF vulnerability records, categorized by severity, and tracked through verified remediation.
          </p>
        </div>
      </div>

      {/* Live Scan Telemetry Modal */}
      <ScanTelemetryModal
        isOpen={isTelemetryModalOpen}
        onClose={() => setIsTelemetryModalOpen(false)}
        assessmentId={auditResult?.assessment_id || null}
        onViewFindings={(id) => {
          setIsTelemetryModalOpen(false);
          router.push(`/findings?assessment_id=${id}`);
        }}
      />
    </AppShell>
  );
}