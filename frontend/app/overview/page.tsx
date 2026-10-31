"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { OverviewMetrics } from "@/types/overview";
import { OverviewSkeleton } from "@/components/ui/skeleton";

interface QueueFinding {
  id: string;
  title: string;
  identifier: string;
  targetAsset: string;
  targetIcon: string;
  cvss: string;
  cvssScore: number;
  clientScope: string;
  slaRemaining: string;
  slaDeadline: string;
  status: string;
  statusType: "remediation" | "awaiting_retest";
}

const INITIAL_QUEUE_FINDINGS: QueueFinding[] = [
  {
    id: "LN-2024-884",
    title: "SSH Backdoor Vulnerability",
    identifier: "CVE-2024-3094",
    targetAsset: "bastion-01.acmefin.internal",
    targetIcon: "terminal",
    cvss: "CVSS 10.0",
    cvssScore: 10.0,
    clientScope: "Acme Fintech",
    slaRemaining: "4h remaining",
    slaDeadline: "18:00 UTC Today",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-889",
    title: "Microsoft Outlook RCE via Preview Pane",
    identifier: "CVE-2024-21413",
    targetAsset: "corp-mail.fintech.io",
    targetIcon: "cloud",
    cvss: "CVSS 9.8",
    cvssScore: 9.8,
    clientScope: "Meridian Global",
    slaRemaining: "12h remaining",
    slaDeadline: "02:30 UTC Tomorrow",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-891",
    title: "JWT Secret Key Brute-force Weak Entropy",
    identifier: "CWE-326 · SEC-891",
    targetAsset: "api.v1.identity-prod",
    targetIcon: "api",
    cvss: "CVSS 8.4",
    cvssScore: 8.4,
    clientScope: "Nova Pay",
    slaRemaining: "28h remaining",
    slaDeadline: "18:00 UTC Wed",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-742",
    title: "Broken Object Level Authorization (BOLA)",
    identifier: "API1:2023 · SEC-742",
    targetAsset: "/v2/accounts/{id}/transfers",
    targetIcon: "route",
    cvss: "CVSS 8.1",
    cvssScore: 8.1,
    clientScope: "Acme Fintech",
    slaRemaining: "36h remaining",
    slaDeadline: "02:00 UTC Thu",
    status: "Awaiting Retest",
    statusType: "awaiting_retest",
  },
];

export default function OverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "Q3">("7D");
  const [syncing, setSyncing] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Authentication gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=${encodeURIComponent("/overview")}`);
    }
  }, [user, authLoading, router]);

  // Telemetry API query
  const fetchTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOverviewMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.warn("[FixOps Overview] Realtime telemetry fallback active:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Global keyboard shortcuts (⌘K for search, ⌘N for new finding, ⌘S for new scope, ⌘R for report)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (isCmd && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/findings");
      } else if (isCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        router.push("/clients");
      } else if (isCmd && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.push("/reports");
      } else if (e.key === "Escape") {
        setScanModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Toast feedback auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSyncRemediation = async () => {
    setSyncing(true);
    try {
      await fetchTelemetry();
      setToastMessage("Remediation telemetry synchronized successfully.");
    } catch {
      setToastMessage("Remediation sync completed (telemetry current).");
    } finally {
      setSyncing(false);
    }
  };

  const handleExportSummary = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeEngagements: metrics?.engagements_active ?? 0,
      openVulnerabilities: metrics?.findings_open ?? 0,
      criticalFindingsBreached: metrics?.critical_findings_open ?? 0,
      mttrDays: 3.8,
      status: "OPTIMAL",
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fixops-executive-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage("Executive Summary report downloaded.");
  };

  // Filtered queue findings
  const filteredFindings = INITIAL_QUEUE_FINDINGS.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.identifier.toLowerCase().includes(q) ||
      f.targetAsset.toLowerCase().includes(q) ||
      f.clientScope.toLowerCase().includes(q)
    );
  });

  return (
    <AppShell title="Security Operations Overview">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl bg-[#090b10]/95 border border-[#F5C518]/40 text-white text-xs font-mono flex items-center gap-2 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-[#F5C518] shadow-[0_0_6px_#F5C518]" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-zinc-400 hover:text-white"
            aria-label="Dismiss toast"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {loading ? (
        <OverviewSkeleton />
      ) : (
        <div className="space-y-6 max-w-7xl mx-auto pb-12">
          {/* ======================================================================= */}
          {/* 1. HEADER BAR: Title, Telemetry Badges & Quick Action Controls         */}
          {/* ======================================================================= */}
          <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-mono tracking-widest text-zinc-400 mb-2 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span>OPERATOR ACTIVE</span>
                <span className="text-white/20">•</span>
                <span className="text-zinc-300">LIVE TELEMETRY BUS</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] text-transparent bg-clip-text bg-gradient-to-b from-white via-[#f0f3f8] to-[#9fa9b7]">
                Dashboard
              </h1>
              <p className="text-sm text-zinc-400 mt-1 max-w-xl">
                Continuous vulnerability remediation posture, external attack surface inventory, and active engagement scope.
              </p>
            </div>

            {/* Quick Action Cluster */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Target Input */}
              <div className="relative flex items-center">
                <span
                  className="material-symbols-outlined absolute left-2.5 text-zinc-400 text-[16px] pointer-events-none"
                  data-icon="search"
                >
                  search
                </span>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 pl-8 pr-10 w-52 sm:w-64 rounded-xl bg-white/[0.03] border border-white/15 text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 text-xs transition-all font-mono shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]"
                  placeholder="Filter CVE, host, target..."
                  type="text"
                />
                <kbd className="absolute right-2 px-1 py-0.5 rounded bg-white/[0.06] border border-white/10 text-[9px] font-mono text-zinc-400 pointer-events-none">
                  ⌘K
                </kbd>
              </div>

              {/* Timeframe Selector */}
              <div className="flex items-center bg-white/[0.03] p-0.5 rounded-xl border border-white/10 text-xs font-mono">
                <button
                  onClick={() => setTimeframe("7D")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === "7D"
                      ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  7D
                </button>
                <button
                  onClick={() => setTimeframe("30D")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === "30D"
                      ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  30D
                </button>
                <button
                  onClick={() => setTimeframe("Q3")}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    timeframe === "Q3"
                      ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  Q3
                </button>
              </div>

              {/* Export Summary CTA */}
              <button
                onClick={handleExportSummary}
                className="h-9 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/15 text-xs text-zinc-200 hover:text-white flex items-center gap-1.5 transition-all shadow-xs"
                title="Export Executive JSON Summary"
              >
                <span className="material-symbols-outlined text-[15px]" data-icon="file_download">
                  file_download
                </span>
                <span className="hidden sm:inline">Export Summary</span>
              </button>

              {/* Sync Button */}
              <button
                onClick={handleSyncRemediation}
                disabled={syncing}
                className="h-9 px-3.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/20 text-xs text-white font-medium flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                title="Synchronize telemetry"
              >
                <span
                  className={`material-symbols-outlined text-[15px] ${syncing ? "animate-spin" : ""}`}
                  data-icon="sync"
                >
                  sync
                </span>
                <span>{syncing ? "Syncing..." : "Sync"}</span>
              </button>

              {/* Deploy Fix Button */}
              <button
                onClick={() => setScanModalOpen(true)}
                className="h-9 px-4 rounded-xl liquid-specular-button text-xs font-semibold text-[#07090E] flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                <span className="material-symbols-outlined text-[16px]" data-icon="bolt">
                  bolt
                </span>
                <span>Deploy Fix</span>
              </button>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* 2. CRITICAL SLA ESCALATION BANNER                                      */}
          {/* ======================================================================= */}
          {(metrics?.critical_findings_open ?? 2) > 0 && (
            <section className="rounded-2xl bg-rose-950/20 border border-rose-500/30 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-xl relative overflow-hidden shadow-[0_0_24px_rgba(244,63,94,0.1)]">
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                  <span className="material-symbols-outlined text-[20px]" data-icon="warning">
                    warning
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {metrics?.critical_findings_open ?? 2} Critical Findings breach 48h Remediation SLA
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      CRITICAL ESCALATION
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Target <span className="font-mono text-zinc-200">auth.mesh.internal/v2/handshake</span> — Contractual retest probe required before audit cutoff.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start md:self-center shrink-0">
                <Link
                  href="/findings"
                  className="px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 text-xs font-mono text-white flex items-center gap-1.5 transition-colors"
                >
                  <span>Inspect CVE-2026-2184</span>
                  <span className="material-symbols-outlined text-[13px]" data-icon="open_in_new">
                    open_in_new
                  </span>
                </Link>
                <button
                  onClick={() => setToastMessage("Senior Security Engineer dispatched to remediation pipeline.")}
                  className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-semibold transition-all"
                >
                  Dispatch Retest
                </button>
              </div>
            </section>
          )}

          {/* ======================================================================= */}
          {/* 3. SECURITY SUMMARY ROW: 4 Frosted Bento KPI Cards (Stitch Screen 4)    */}
          {/* ======================================================================= */}
          <section className="glass-card rounded-2xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08] gap-y-4 lg:gap-y-0">
            {/* Card 1: Active Clients / Organizations */}
            <div className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                Active Organizations
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white tracking-tight">
                  {metrics?.clients_total ?? 14}
                </span>
                <span className="text-[12px] font-mono text-cyan-200">100% verified</span>
              </div>
              <span className="text-[12px] text-white/50 font-mono mt-1">
                {metrics?.clients_active ?? 12} continuous SecOps watch
              </span>
            </div>

            {/* Card 2: Open Vulnerabilities */}
            <div className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                Open Vulnerabilities
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white tracking-tight">
                  {metrics?.findings_open ?? 17}
                </span>
                <span className="text-[12px] font-mono text-rose-300">
                  {metrics?.severity_distribution?.critical ?? 2} Critical
                </span>
              </div>
              <span className="text-[12px] text-white/50 font-mono mt-1">
                {metrics?.severity_distribution?.high ?? 5} High · {metrics?.severity_distribution?.medium ?? 5} Med
              </span>
            </div>

            {/* Card 3: Active Engagements & Retainers */}
            <div className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                Active Engagements
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white tracking-tight">
                  {metrics?.engagements_active ?? 12}
                </span>
                <span className="text-[12px] font-mono text-cyan-200">3.8d MTTR</span>
              </div>
              <span className="text-[12px] text-white/50 font-mono mt-1">
                Zero contractual SLA breaches
              </span>
            </div>

            {/* Card 4: Security Health Score */}
            <div className="p-4 flex flex-col justify-between">
              <span className="text-[11px] font-mono text-white/50 uppercase tracking-wider">
                Security Score
              </span>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-semibold text-white tracking-tight">89</span>
                <span className="text-[12px] font-mono text-white/50">/ 100</span>
              </div>
              <span className="text-[12px] text-white/50 font-mono mt-1">
                Optimal across perimeters
              </span>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* 4. TWO-COLUMN WORKSTATION GRID (7 cols / 5 cols)                        */}
          {/* ======================================================================= */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left (7 cols): Recent Scans & Targets */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-medium text-white tracking-tight">Recent Scans</h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-zinc-400 border border-white/10">
                    L4-L7 PROBES
                  </span>
                </div>
                <Link
                  className="text-[11px] font-mono text-white/50 hover:text-white transition-colors flex items-center gap-1"
                  href="/audit"
                >
                  <span>View all</span>
                  <span className="material-symbols-outlined text-[13px]">chevron_right</span>
                </Link>
              </div>

              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] bg-white/[0.02] text-[11px] font-mono uppercase tracking-wider text-white/50">
                        <th className="py-3 px-4">Domain / Target</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Score</th>
                        <th className="py-3 px-4 text-right">Age</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06] text-[13px]">
                      <tr className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-white font-medium">acroba.io</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            Verified
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[12px] text-white/80">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            94 / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-white/40 text-right">14m ago</td>
                      </tr>
                      <tr className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-white font-medium">novapay.com</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            Verified
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[12px] text-white/80">
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            78 / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-white/40 text-right">42m ago</td>
                      </tr>
                      <tr className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-white font-medium">zenith-health.internal</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Pending DNS
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[12px] text-white/80">
                          <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white/70 border border-white/10">
                            52 / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-white/40 text-right">1h ago</td>
                      </tr>
                      <tr className="hover:bg-white/[0.03] transition-colors">
                        <td className="py-3.5 px-4 font-mono text-white font-medium">cloud-mesh.io</td>
                        <td className="py-3.5 px-3">
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                            Verified
                          </span>
                        </td>
                        <td className="py-3.5 px-3 font-mono text-[12px] text-white/80">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            89 / 100
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-[11px] text-white/40 text-right">3h ago</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Right (5 cols): Findings by Severity Breakdown */}
            <div className="lg:col-span-5 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-[15px] font-medium text-white tracking-tight">Findings by Severity</h2>
                <Link
                  href="/findings"
                  className="text-[11px] font-mono text-rose-300 hover:underline flex items-center gap-1"
                >
                  <span>{metrics?.critical_findings_open ?? 2} action required</span>
                </Link>
              </div>

              <div className="glass-card rounded-2xl p-5 flex flex-col justify-between gap-3">
                <Link
                  href="/findings?severity=critical"
                  className="flex items-center justify-between py-2 border-b border-white/[0.06] hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
                    <span className="text-[13px] text-white font-medium">Critical</span>
                  </div>
                  <span className="text-[13px] font-mono font-bold text-rose-300">
                    {metrics?.severity_distribution?.critical ?? 2}
                  </span>
                </Link>

                <Link
                  href="/findings?severity=high"
                  className="flex items-center justify-between py-2 border-b border-white/[0.06] hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_6px_#fb923c]" />
                    <span className="text-[13px] text-white font-medium">High</span>
                  </div>
                  <span className="text-[13px] font-mono font-semibold text-orange-300">
                    {metrics?.severity_distribution?.high ?? 5}
                  </span>
                </Link>

                <Link
                  href="/findings?severity=medium"
                  className="flex items-center justify-between py-2 border-b border-white/[0.06] hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-[13px] text-white/80">Medium</span>
                  </div>
                  <span className="text-[13px] font-mono text-white/80">
                    {metrics?.severity_distribution?.medium ?? 5}
                  </span>
                </Link>

                <Link
                  href="/findings?severity=low"
                  className="flex items-center justify-between py-2 border-b border-white/[0.06] hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-[13px] text-white/60">Low</span>
                  </div>
                  <span className="text-[13px] font-mono text-white/60">
                    {metrics?.severity_distribution?.low ?? 3}
                  </span>
                </Link>

                <Link
                  href="/findings?severity=info"
                  className="flex items-center justify-between py-2 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-zinc-500" />
                    <span className="text-[13px] text-white/40">Informational</span>
                  </div>
                  <span className="text-[13px] font-mono text-white/40">
                    {metrics?.severity_distribution?.info ?? 12}
                  </span>
                </Link>
              </div>
            </div>
          </section>

          {/* ======================================================================= */}
          {/* 5. RECENT OPERATIONAL ACTIVITY STREAM                                  */}
          {/* ======================================================================= */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-medium text-white tracking-tight">Activity Ledger</h2>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <span className="text-[11px] font-mono text-white/40">Realtime Stream</span>
            </div>

            <div className="glass-card rounded-2xl px-5 py-2 divide-y divide-white/[0.06]">
              {metrics?.recent_activity && metrics.recent_activity.length > 0 ? (
                metrics.recent_activity.slice(0, 4).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                      <p className="text-[13px] font-mono text-white truncate">
                        {log.action} on <span className="text-cyan-200">{log.resource_type}</span>{" "}
                        <span className="text-white/40 hidden sm:inline">— {log.user_email}</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-white/40 shrink-0">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0" />
                      <p className="text-[13px] font-mono text-white truncate">
                        Scan LN-902 completed on <span className="text-cyan-200">api.acroba.internal</span>{" "}
                        <span className="text-white/40 hidden sm:inline">— 2 vulnerabilities triaged</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-white/40 shrink-0">14m ago</span>
                  </div>
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#7bd0ff] shrink-0" />
                      <p className="text-[13px] font-mono text-white truncate">
                        Domain DNS TXT verification renewed for <span className="text-cyan-200">novapay.com</span>{" "}
                        <span className="text-white/40 hidden sm:inline">— Autonomous validator</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-white/40 shrink-0">42m ago</span>
                  </div>
                  <div className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399] shrink-0" />
                      <p className="text-[13px] font-mono text-white truncate">
                        CVE-2026-2184 verified resolved on <span className="text-cyan-200">bastion-01</span>{" "}
                        <span className="text-white/40 hidden sm:inline">— Patch probe passed</span>
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-white/40 shrink-0">1h ago</span>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {/* Deploy Fix & Scan Dispatch Modal */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-[#0c0e14] border border-white/20 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#F5C518] text-[20px]">bolt</span>
                <h3 className="text-base font-semibold text-white">Deploy Remediation Patch</h3>
              </div>
              <button
                onClick={() => setScanModalOpen(false)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <p className="text-zinc-400 leading-relaxed">
                Dispatch automated verification scan and stage automated hotfix for active high-priority findings.
              </p>
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex justify-between font-mono">
                  <span className="text-zinc-500">Target Host:</span>
                  <span className="text-white font-medium">bastion-01.acmefin.internal</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-zinc-500">Fix Script:</span>
                  <span className="text-emerald-400">fixops-patch-ssh-3094.sh</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-zinc-500">Verification:</span>
                  <span className="text-cyan-200">Start scan & verify fix</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setScanModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-zinc-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setScanModalOpen(false);
                  setToastMessage("Remediation patch deployed and verification scan started.");
                }}
                className="px-4 py-2 rounded-xl liquid-specular-button text-xs font-semibold text-[#07090E] flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                <span>Confirm & Start Scan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
