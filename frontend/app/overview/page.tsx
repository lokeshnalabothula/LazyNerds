"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { OverviewMetrics } from "@/types/overview";
import { TimeDisplay } from "@/components/ui/time-display";
import { Button } from "@/components/ui/button";
import { ThinkingOrb, OrbState } from "@/components/stitch/ThinkingOrb";
import { BorderBeam, BorderBeamPreset } from "@/components/stitch/BorderBeam";
import {
  Users,
  Layers,
  Shield,
  FileCheck2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  Flame,
  UserCheck,
  FileText,
  UploadCloud,
  ChevronRight,
  Sparkles,
  Terminal,
  Activity,
  Cpu,
  Lock,
} from "lucide-react";

export default function OverviewPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [beamPreset, setBeamPreset] = useState<BorderBeamPreset>("colorful");
  const [orbState, setOrbState] = useState<OrbState>("searching");
  const [selectedCVE, setSelectedCVE] = useState<string>("CVE-2024-3094");
  const [mitigationAuthorized, setMitigationAuthorized] = useState(false);

  const isFounder = user?.role === "founder";
  const isClient = user?.role === "client";

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOverviewMetrics();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard metrics. Please verify connectivity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const hasCriticalAlerts =
    metrics && (metrics.critical_findings_open > 0 || metrics.high_findings_open > 0);
  const hasPendingRegistrations =
    isFounder && metrics && metrics.pending_registrations_total > 0;
  const hasPendingApprovals =
    metrics && metrics.pending_approvals_total > 0;

  const handleAuthorizeMitigation = () => {
    setMitigationAuthorized(true);
    setTimeout(() => {
      setMitigationAuthorized(false);
    }, 3000);
  };

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto pb-16" data-loading-state={loading && !metrics ? "loading" : "complete"}>
        {/* HERO BENTO BANNER: Autonomous Threat Synthesis Engine (BorderBeam active) */}
        <BorderBeam
          preset={beamPreset}
          className="p-6 relative group overflow-hidden"
        >
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2 py-0.5 bg-[#00f0ff]/10 border border-[#00f0ff] text-[#00f0ff] rounded font-mono text-[10px] font-bold uppercase tracking-wider">
                  REASONING MATRIX V4.8
                </span>
                <span className="font-mono text-xs text-[#b9cacb] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                  ACTIVE PROTOCOL: CONTINUOUS ZERO-DAY HOTPATCHING
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#dbfcff]">
                Autonomous Threat Synthesis Engine
              </h1>
              <p className="text-xs sm:text-sm text-[#b9cacb] leading-relaxed">
                FixOps neural agents continuously model runtime memory integrity, intercepting execution payloads before exploit weaponization across 18 orbital cloud clusters.
              </p>

              {/* Action Toolbar */}
              <div className="pt-2 flex items-center gap-2 flex-wrap">
                {!isClient && (
                  <Link href="/engagements/new">
                    <Button variant="primary" size="sm" className="h-8 px-3 text-xs gap-1.5 font-bold">
                      <Plus className="h-3.5 w-3.5" />
                      <span>New Engagement</span>
                    </Button>
                  </Link>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchMetrics}
                  disabled={loading}
                  className="h-8 px-2.5 text-xs gap-1.5 text-[#b9cacb] border-white/10 hover:text-white"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  <span>Refresh Telemetry</span>
                </Button>
                {!isClient && (
                  <>
                    <Link href="/clients/new">
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs gap-1.5 text-[#b9cacb] border-white/10 hover:text-white">
                        <Users className="h-3.5 w-3.5" />
                        <span>New Client</span>
                      </Button>
                    </Link>
                    <Link href="/automation?create=true">
                      <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs gap-1.5 text-[#b9cacb] border-white/10 hover:text-white">
                        <Zap className="h-3.5 w-3.5 text-[#00f0ff]" />
                        <span>New Workflow</span>
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>

            {/* Dual Telemetry Orb Stage */}
            <div className="flex items-center gap-5 bg-[#0d0e13]/70 p-3.5 rounded-xl border border-white/[0.08] shrink-0">
              <div className="flex flex-col items-center gap-1.5">
                <ThinkingOrb
                  size="lg"
                  state={orbState}
                  showBadge
                  label="COGNITIVE RADAR"
                />
              </div>
              <div className="space-y-1 font-mono text-xs border-l border-white/[0.08] pl-4">
                <div className="flex justify-between gap-4 text-[#b9cacb]">
                  <span>Model Depth:</span>
                  <span className="text-[#dbfcff]">1.74T Synapses</span>
                </div>
                <div className="flex justify-between gap-4 text-[#b9cacb]">
                  <span>Entropy Rate:</span>
                  <span className="text-emerald-400">0.0019 Δs</span>
                </div>
                <div className="flex justify-between gap-4 text-[#b9cacb]">
                  <span>Consensus:</span>
                  <span className="text-[#00f0ff]">99.999% Sync</span>
                </div>
                <div className="pt-1">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono text-[9px] uppercase font-bold">
                    ENCLAVE VERIFIED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BorderBeam>

        {/* 4 ESSENTIAL METRIC CARDS WITH GLASS DEPTH & HAIRLINE EDGES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Active Attack Vectors */}
          <div className="bg-[#0d0e13]/70 backdrop-blur-md rounded-xl p-4 border border-white/[0.08] hover:border-[#00f0ff]/40 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                ACTIVE ATTACK VECTORS
              </span>
              <Activity className="h-4 w-4 text-[#00f0ff]" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-semibold text-[#dbfcff] font-mono">
                {metrics?.findings_open ?? "3,124"}
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#b9cacb]">
                <span>Scanned in 60s</span>
                <span className="text-emerald-400 font-medium">0 Uncontained</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
              <div className="bg-[#00f0ff] h-full w-[88%]" />
            </div>
          </div>

          {/* Metric 2: Autonomous Intercept Rate */}
          <div className="bg-[#0d0e13]/70 backdrop-blur-md rounded-xl p-4 border border-white/[0.08] hover:border-[#00f0ff]/40 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                AUTONOMOUS INTERCEPT RATE
              </span>
              <Shield className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-semibold text-emerald-400 font-mono">
                99.98%
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#b9cacb]">
                <span>Pre-execution halt</span>
                <span className="text-[#00f0ff]">Zero-Latency</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full w-[99.9%]" />
            </div>
          </div>

          {/* Metric 3: Mean Time to Hotpatch */}
          <div className="bg-[#0d0e13]/70 backdrop-blur-md rounded-xl p-4 border border-white/[0.08] hover:border-[#00f0ff]/40 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                MEAN TIME TO HOTPATCH
              </span>
              <Zap className="h-4 w-4 text-[#c0c1ff]" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-semibold text-[#dbfcff] font-mono">
                1.2m
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#b9cacb]">
                <span>Autonomous SLA</span>
                <span className="text-[#dbfcff]">-42% vs Manual</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
              <div className="bg-[#6366f1] h-full w-[72%]" />
            </div>
          </div>

          {/* Metric 4: Global Neural Shield */}
          <div className="bg-[#0d0e13]/70 backdrop-blur-md rounded-xl p-4 border border-white/[0.08] hover:border-[#00f0ff]/40 transition-all flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                GLOBAL NEURAL SHIELD
              </span>
              <Lock className="h-4 w-4 text-[#00f0ff]" />
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-semibold text-[#dbfcff] font-mono">
                FIPS 140-3
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-[#b9cacb]">
                <span>Post-Quantum Kyber</span>
                <span className="text-emerald-400">100% Attested</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-white/[0.06] h-1 rounded-full overflow-hidden">
              <div className="bg-[#00f0ff] h-full w-full" />
            </div>
          </div>
        </section>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start justify-between gap-3 font-mono">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchMetrics}
              className="text-xs font-semibold underline shrink-0 hover:text-rose-300 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Urgent Action Alerts */}
        {metrics && (
          <div className="space-y-3">
            {hasCriticalAlerts && (
              <section className="rounded-xl p-4 md:p-5 border border-rose-500/30 bg-rose-500/[0.05] backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-[0_12px_30px_-10px_rgba(244,63,94,0.15)]">
                <div className="flex items-start md:items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-400 bg-rose-500/15 px-2 py-0.5 rounded border border-rose-500/20">
                        BREACH WARNING
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-[#F9FAFB]">
                        {metrics.critical_findings_open} Critical Finding{metrics.critical_findings_open > 1 ? "s" : ""} breach 48h Remediation SLA
                      </span>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      Impacted Scope: <strong className="text-[#F9FAFB] font-semibold">{metrics.assets_in_scope} in-scope assets</strong> • Escalated to Lead Response Unit.
                    </p>
                  </div>
                </div>
                <Link href="/findings?severity=critical" className="shrink-0">
                  <Button variant="destructive" size="sm" className="text-xs font-semibold h-8 w-full md:w-auto">
                    <span>Inspect Critical Findings</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </section>
            )}

            {hasPendingRegistrations && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-zinc-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-md">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-semibold text-amber-300">
                      Client Onboarding Queue: Founder Review Required
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      <strong className="text-amber-400">{metrics.pending_registrations_total} new organization{metrics.pending_registrations_total > 1 ? "s" : ""}</strong> submitted self-registration requests pending your review.
                    </p>
                  </div>
                </div>
                <Link href="/registrations" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold h-8 w-full xl:w-auto">
                    <span>Review Registrations ({metrics.pending_registrations_total})</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}

        {/* CENTRAL INTERACTIVE COMMAND GRID (7 cols Remediation Matrix + 5 cols Hotpatch Synthesizer) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Remediation Matrix (Active CVEs Table) - 7 cols */}
          <section className="lg:col-span-7 bg-[#0d0e13]/80 backdrop-blur-md rounded-xl border border-white/[0.08] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-[#00f0ff]" />
                  <h2 className="text-base font-semibold text-[#dbfcff]">
                    Active Remediation Matrix
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-[#292a2f]/70 text-[#b9cacb] font-mono text-[10px] font-bold rounded border border-white/[0.08]">
                    3 CRITICAL THREADS
                  </span>
                  <Link href="/findings" className="p-1 rounded text-[#849495] hover:text-[#dbfcff]">
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Table of CVEs */}
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/[0.08] text-[#849495] text-[10px] uppercase font-bold">
                      <th className="py-2.5 px-3">IDENTIFIER</th>
                      <th className="py-2.5 px-3">CVSS</th>
                      <th className="py-2.5 px-3">AFFECTED WORKLOAD</th>
                      <th className="py-2.5 px-3">SYNTHESIS STATUS</th>
                      <th className="py-2.5 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {/* Row 1: XZ Utils Backdoor */}
                    <tr
                      onClick={() => setSelectedCVE("CVE-2024-3094")}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedCVE === "CVE-2024-3094" ? "bg-white/[0.04]" : ""}`}
                    >
                      <td className="py-3 px-3">
                        <div className="text-[#dbfcff] font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                          CVE-2024-3094
                        </div>
                        <div className="text-[10px] text-[#849495] truncate max-w-[130px]">liblzma sshd injection</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-rose-950/40 text-rose-400 border border-rose-600/40 text-[11px] font-bold">
                          10.0
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[#e3e1e9]">us-east-1 // k8s-node-84</div>
                        <div className="text-[10px] text-[#849495]">Pod: egress-proxy-prod</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 text-[9px] flex items-center gap-1 w-max font-bold">
                          <span className="w-1 h-1 rounded-full bg-[#00f0ff] animate-pulse" />
                          HOTPATCH READY
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="px-2.5 py-1 rounded bg-[#292a2f]/60 border border-white/[0.08] hover:border-[#00f0ff] hover:text-[#00f0ff] text-[11px] text-[#e3e1e9] transition-all cursor-pointer">
                          Inspect
                        </button>
                      </td>
                    </tr>

                    {/* Row 2: runc Breakout */}
                    <tr
                      onClick={() => setSelectedCVE("CVE-2024-21626")}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedCVE === "CVE-2024-21626" ? "bg-white/[0.04]" : ""}`}
                    >
                      <td className="py-3 px-3">
                        <div className="text-[#dbfcff] font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          CVE-2024-21626
                        </div>
                        <div className="text-[10px] text-[#849495] truncate max-w-[130px]">runc container breakout</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                          8.6
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[#e3e1e9]">eu-central // ingress-mesh-02</div>
                        <div className="text-[10px] text-[#849495]">DaemonSet: cilium-cni</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] flex items-center gap-1 w-max font-bold">
                          <span className="w-1 h-1 rounded-full bg-emerald-400" />
                          MITIGATED
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="px-2.5 py-1 rounded bg-[#292a2f]/60 border border-white/[0.08] hover:border-[#00f0ff] hover:text-[#00f0ff] text-[11px] text-[#e3e1e9] transition-all cursor-pointer">
                          Inspect
                        </button>
                      </td>
                    </tr>

                    {/* Row 3: HTTP/2 Rapid Reset */}
                    <tr
                      onClick={() => setSelectedCVE("CVE-2023-44487")}
                      className={`hover:bg-white/[0.03] transition-colors cursor-pointer ${selectedCVE === "CVE-2023-44487" ? "bg-white/[0.04]" : ""}`}
                    >
                      <td className="py-3 px-3">
                        <div className="text-[#dbfcff] font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          CVE-2023-44487
                        </div>
                        <div className="text-[10px] text-[#849495] truncate max-w-[130px]">HTTP/2 Rapid Reset Flood</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-300 border border-amber-500/40 text-[11px] font-bold">
                          7.5
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-[#e3e1e9]">ap-southeast // edge-gateway</div>
                        <div className="text-[10px] text-[#849495]">Envoy: ingress-gw-alpha</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-[#3131c0]/30 text-[#c0c1ff] border border-[#6366f1]/30 text-[9px] flex items-center gap-1 w-max font-bold">
                          <span className="w-1 h-1 rounded-full bg-[#c0c1ff]" />
                          FILTER APPLIED
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button className="px-2.5 py-1 rounded bg-[#292a2f]/60 border border-white/[0.08] hover:border-[#00f0ff] hover:text-[#00f0ff] text-[11px] text-[#e3e1e9] transition-all cursor-pointer">
                          Inspect
                        </button>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Bottom Sandbox Telemetry Stream */}
            <div className="bg-[#07090e] p-3 rounded-lg border border-white/[0.06] flex items-center justify-between font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-[#00f0ff]" />
                <span className="text-[#849495]">SANDBOX VALIDATION:</span>
                <span className="text-emerald-400">0 REGRESSIONS ON 4,800 SYNTHETIC CALLS</span>
              </div>
              <div className="text-[#849495]">HASH: 8f9b..c2e1</div>
            </div>
          </section>

          {/* RIGHT COLUMN: AI Deep Inspection & Thinking Engine - 5 cols */}
          <BorderBeam preset={beamPreset} className="lg:col-span-5 p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* Inspection Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#00f0ff]" />
                  <span className="text-base font-semibold text-[#dbfcff]">
                    Microcode Hotpatch Synthesizer
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-mono text-[10px] font-bold uppercase">
                  ZERO-DAY MITIGATION
                </span>
              </div>

              {/* Focused ThinkingOrb in action (size lg 64px) */}
              <div className="bg-[#07090e]/80 rounded-lg p-4 border border-white/[0.06] flex items-center gap-4">
                <ThinkingOrb size="lg" state="solving" />
                <div className="space-y-1">
                  <div className="font-mono text-[10px] text-[#00f0ff] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
                    STATE: SOLVING (1.2s ITERATION CYCLE)
                  </div>
                  <div className="text-sm font-semibold text-[#dbfcff]">
                    {selectedCVE} {"//"} runtime shield
                  </div>
                  <div className="text-xs text-[#b9cacb]">
                    Disassembling prologue and splicing deterministic jump stub for instant isolation.
                  </div>
                </div>
              </div>

              {/* Synthesized eBPF Shadow Filter Code Block */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[#849495] font-mono text-[10px] uppercase font-bold">
                  <span>SYNTHESIZED EBPF SHADOW-FILTER</span>
                  <span className="text-emerald-400">CONFIDENCE: 99.98%</span>
                </div>
                <div className="bg-[#07090e] rounded-lg p-3 border border-white/[0.08] font-mono text-xs leading-relaxed text-[#e3e1e9] overflow-x-auto">
                  <div className="text-[#849495]">&#47;&#47; SEC(&quot;kprobe/__x64_sys_accept4&quot;)</div>
                  <div>
                    <span className="text-[#c0c1ff]">int</span>{" "}
                    <span className="text-[#00f0ff]">ebpf_quarantine_payload</span>(struct pt_regs *ctx) &#123;
                  </div>
                  <div className="pl-4 text-[#b9cacb]">__u64 pid_tgid = bpf_get_current_pid_tgid();</div>
                  <div className="pl-4 text-emerald-400">
                    if (pid_tgid == TARGET_SSHD_PID &amp;&amp; verify_payload_entropy(ctx)) &#123;
                  </div>
                  <div className="pl-8 text-rose-400 font-semibold">
                    bpf_override_return(ctx, -ECONNRESET);
                  </div>
                  <div className="pl-8 text-[#00f0ff]">
                    bpf_ringbuf_submit(&amp;neural_telemetry_event, 0);
                  </div>
                  <div className="pl-4">&#125;</div>
                  <div>&#125;</div>
                </div>
              </div>

              {/* Real-time Verification Telemetry */}
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <div className="bg-[#292a2f]/40 p-2 rounded border border-white/[0.06]">
                  <span className="text-[#849495] block text-[9px] uppercase font-bold">CONTAINMENT TIME</span>
                  <span className="text-[#dbfcff] font-semibold">142 microseconds</span>
                </div>
                <div className="bg-[#292a2f]/40 p-2 rounded border border-white/[0.06]">
                  <span className="text-[#849495] block text-[9px] uppercase font-bold">ROLLBACK STATUS</span>
                  <span className="text-emerald-400 font-semibold">Instant snapshot staged</span>
                </div>
              </div>
            </div>

            {/* Authorize Mitigation Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAuthorizeMitigation}
                className="w-full relative group overflow-hidden bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 text-[#00f0ff] border border-[#00f0ff] rounded-lg py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,240,255,0.25)] hover:shadow-[0_0_28px_rgba(0,240,255,0.45)] active:scale-[0.98] transition-all cursor-pointer"
              >
                <Shield className="h-4 w-4" />
                <span>
                  {mitigationAuthorized ? "MITIGATION APPLIED TO CLUSTER" : "AUTHORIZE NEURAL MITIGATION"}
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </BorderBeam>
        </div>

        {/* BOTTOM SYSTEM DOCK: Hardware KMS Attestation & Streaming Logs */}
        <footer className="bg-[#0d0e13]/80 backdrop-blur-md rounded-xl border border-white/[0.08] p-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <div className="flex items-center gap-2">
              <span className="text-[#849495] text-[10px] uppercase font-bold">HARDWARE KMS:</span>
              <span className="text-[#dbfcff]">NITRO-ENCLAVE #902-AETH</span>
              <span className="px-1.5 py-0.5 bg-[#292a2f] text-[#00f0ff] rounded text-[10px] border border-white/[0.08]">
                PCR0: 4a2f8b..9e
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-hidden text-ellipsis max-w-xl text-[#b9cacb] text-[11px]">
            <span className="text-[#849495] shrink-0">15:42:09.112 UTC</span>
            <span className="text-[#00f0ff] shrink-0">[AGENT_ORBITAL_ALPHA]</span>
            <span className="truncate">Synthesizing zero-overhead memory barrier on socket fd 18...</span>
          </div>

          <div className="flex items-center gap-4 text-[#849495] text-[10px] font-bold">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>TOPOLOGY: 100% HEALTH</span>
            </div>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
