"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { OverviewMetrics } from "@/types/overview";
import { TimeDisplay } from "@/components/ui/time-display";
import { Button } from "@/components/ui/button";
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
  ShieldAlert,
  Inbox,
  Activity,
  Flame,
  CheckCheck,
  UserCheck,
  FileText,
  UploadCloud,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export default function OverviewPage() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AppShell title="Dashboard">
      <div className="space-y-6 max-w-7xl mx-auto pb-16" data-loading-state={loading && !metrics ? "loading" : "complete"}>
        {/* Top Operations Header with Operational Telemetry Badge */}
        <div className="cockpit-card specular-top border-[#F5C518]/30 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-xl border border-[#F5C518]/40 bg-[#161920] shadow-[0_2px_12px_rgba(245,197,24,0.15),inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center justify-center shrink-0 text-[#F5C518]">
              <Shield className="h-6 w-6 sm:h-7 sm:w-7 text-[#F5C518]" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD84D] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5C518]"></span>
                </span>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-sans">
                  {isClient
                    ? "Organization Security Posture"
                    : "Cybersecurity Operations Dashboard"}
                </h1>
                <span className="badge-cyber bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border-[#F5C518]/35 shrink-0">
                  {user?.role || "Active"} Mode
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] leading-relaxed max-w-2xl font-sans">
                {isClient
                  ? "Real-time vulnerability tracking, automated remediation status, and verified compliance audit logs for your assets."
                  : "Continuous telemetry, tenant isolation, and automated remediation pipeline calculated from live database records."}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchMetrics}
              disabled={loading}
              className="text-xs h-9 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Telemetry</span>
            </Button>
            {!isClient && (
              <>
                <Link href="/clients/new">
                  <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 font-medium">
                    <Users className="h-3.5 w-3.5" />
                    <span>New Client</span>
                  </Button>
                </Link>
                <Link href="/automation?create=true">
                  <Button variant="outline" size="sm" className="text-xs h-9 gap-1.5 font-medium">
                    <Zap className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>New Workflow</span>
                  </Button>
                </Link>
                <Link href="/engagements/new">
                  <Button variant="primary" size="sm" className="text-xs h-9 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    <span>New Engagement</span>
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchMetrics}
              className="text-xs font-semibold underline shrink-0 hover:text-rose-700 dark:hover:text-rose-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Urgent Attention / Action Banners */}
        {metrics && (
          <div className="space-y-3">
            {/* Critical Findings Alert */}
            {hasCriticalAlerts && (
              <div className="p-4 rounded-xl border border-rose-500/30 bg-rose-950/20 text-zinc-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                    <Flame className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-rose-300 font-mono uppercase tracking-wide">
                      URGENT ATTENTION: UNMITIGATED CRITICAL / HIGH VULNERABILITIES
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      There are currently{" "}
                      <strong className="text-rose-400">{metrics.critical_findings_open} Critical</strong> and{" "}
                      <strong className="text-orange-400">{metrics.high_findings_open} High</strong> severity
                      findings requiring remediation verification.
                    </p>
                  </div>
                </div>
                <Link href="/findings?status=open" className="shrink-0">
                  <Button variant="outline" size="sm" className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-xs font-semibold h-8 w-full xl:w-auto">
                    <span>Review Critical Vulnerabilities</span>
                    <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                  </Button>
                </Link>
              </div>
            )}

            {/* Founder Client Registration Queue Alert */}
            {hasPendingRegistrations && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-zinc-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 shadow-md">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-amber-300 font-mono uppercase tracking-wide">
                      CLIENT ONBOARDING QUEUE: FOUNDER REVIEW REQUIRED
                    </h3>
                    <p className="text-xs text-zinc-300 mt-0.5">
                      <strong className="text-amber-400">{metrics.pending_registrations_total} new organization{metrics.pending_registrations_total > 1 ? "s have" : " has"}</strong> submitted self-registration requests pending your review and employee assignment.
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

            {/* Automation Approvals Banner */}
            {hasPendingApprovals && !isClient && (
              <div className="p-3.5 rounded-xl border border-[#F5C518]/30 bg-[#F5C518]/10 text-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Zap className="h-4 w-4 text-[#F5C518] shrink-0" />
                  <p className="text-xs text-zinc-300 min-w-0 truncate">
                    <strong className="text-[#FFD84D]">{metrics.pending_approvals_total} automated execution{metrics.pending_approvals_total > 1 ? "s" : ""}</strong> awaiting human-in-the-loop approval.
                  </p>
                </div>
                <Link href="/automation" className="shrink-0 text-xs text-[#F5C518] hover:text-[#FFD84D] underline font-semibold">
                  Review Approvals &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !metrics ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/40 h-24 flex flex-col justify-between"
                >
                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-7 w-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-2.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30 h-72" />
              <div className="lg:col-span-2 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/30 h-72" />
            </div>
          </div>
        ) : metrics ? (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {/* Clients Card */}
              {!isClient ? (
                <Link
                  href="/clients"
                  className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
                >
                  <div>
                    <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                      <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Clients</span>
                      <Users className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight tabular-nums">
                      {metrics.clients_total}
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span>{metrics.clients_active} active</span>
                  </div>
                </Link>
              ) : (
                <div className="telemetry-card specular-top p-4 flex flex-col justify-between shadow-md">
                  <div>
                    <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                      <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Security State</span>
                      <Shield className="h-4 w-4 text-[#34D399]" />
                    </div>
                    <div className="text-xl font-bold font-sans text-[#34D399] tracking-tight">
                      PROTECTED
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans">
                    FixOps Agent Active
                  </div>
                </div>
              )}

              {/* Engagements Card */}
              <Link
                href="/engagements"
                className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                    <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Engagements</span>
                    <Layers className="h-4 w-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight tabular-nums">
                    {metrics.engagements_total}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                  <span>{metrics.engagements_active} ongoing</span>
                </div>
              </Link>

              {/* Assets Card */}
              <Link
                href="/assets"
                className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                    <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">In-Scope</span>
                    <Shield className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight tabular-nums">
                    {metrics.assets_in_scope}
                  </div>
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-[#34D399] mt-2.5 truncate font-sans flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{metrics.assets_total} total</span>
                </div>
              </Link>

              {/* Open Findings Card */}
              <Link
                href="/findings?status=open"
                className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                    <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Open Findings</span>
                    <FileCheck2 className="h-4 w-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight tabular-nums">
                    {metrics.findings_open}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span>{metrics.findings_total} identified</span>
                </div>
              </Link>

              {/* Remediated Card */}
              <Link
                href="/findings?status=verified_fixed"
                className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                    <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Remediated</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold font-sans text-emerald-600 dark:text-[#34D399] tracking-tight tabular-nums">
                    {metrics.findings_verified_fixed}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>{metrics.findings_in_remediation} in progress</span>
                </div>
              </Link>

              {/* Automations / Reports Card */}
              {!isClient ? (
                <Link
                  href="/automation"
                  className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
                >
                  <div>
                    <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                      <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Automations</span>
                      <Zap className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight tabular-nums">
                      {metrics.automation_executions_total}
                    </div>
                  </div>
                  <div className="text-[10px] text-amber-600 dark:text-[#FFD84D] mt-2.5 truncate font-sans flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#F5C518]" />
                    <span>{metrics.automation_rules_active} rules active</span>
                  </div>
                </Link>
              ) : (
                <Link
                  href="/reports"
                  className="telemetry-card cockpit-card-interactive specular-top p-4 flex flex-col justify-between shadow-md group"
                >
                  <div>
                    <div className="flex items-center justify-between text-zinc-500 dark:text-[#94A3B8] mb-2.5">
                      <span className="text-[11px] font-sans uppercase tracking-wider font-semibold">Reports</span>
                      <FileText className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] tracking-tight">
                      Available
                    </div>
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-[#94A3B8] mt-2.5 truncate font-sans">
                    FixOps Deliverables
                  </div>
                </Link>
              )}
            </div>

            {/* Quick Workflow Hub */}
            <div className="cockpit-card specular-top p-5 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase font-mono tracking-wider text-zinc-500 dark:text-[#9CA3AF]">
                  Quick Workflow Shortcuts
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Link
                  href="/findings"
                  className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-[#F5C518]/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <UploadCloud className="h-4 w-4 text-[#F5C518]" />
                    <span className="text-zinc-800 dark:text-[#F9FAFB]">Import Scanner Output</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                </Link>

                <Link
                  href="/engagements"
                  className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-indigo-500/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <Layers className="h-4 w-4 text-indigo-400" />
                    <span className="text-zinc-800 dark:text-[#F9FAFB]">Engagements & Audits</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                </Link>

                <Link
                  href="/automation"
                  className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-[#F5C518]/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="h-4 w-4 text-[#F5C518]" />
                    <span className="text-zinc-800 dark:text-[#F9FAFB]">Automation & Rules</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                </Link>

                {isFounder ? (
                  <Link
                    href="/registrations"
                    className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-amber-500/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="h-4 w-4 text-amber-400" />
                      <span className="text-zinc-800 dark:text-[#F9FAFB]">Review Onboarding Queue</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                  </Link>
                ) : (
                  <Link
                    href="/assets"
                    className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-emerald-500/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                  >
                    <div className="flex items-center gap-2.5">
                      <Shield className="h-4 w-4 text-emerald-400" />
                      <span className="text-zinc-800 dark:text-[#F9FAFB]">Asset Inventory</span>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                  </Link>
                )}

                <Link
                  href="/reports"
                  className="p-3 rounded-lg border border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/70 hover:border-[#F5C518]/50 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors flex items-center justify-between group text-xs font-medium"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-blue-400" />
                    <span className="text-zinc-800 dark:text-[#F9FAFB]">Security Reports</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-100" />
                </Link>
              </div>
            </div>

            {/* Severity Distribution & Activity Center */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Finding Severity Distribution */}
              <div className="cockpit-card specular-top p-5 lg:col-span-1 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                    Severity Breakdown
                  </h2>
                  <Link
                    href="/findings"
                    className="text-[11px] text-[#F5C518] hover:underline flex items-center gap-0.5 font-semibold"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Critical", count: metrics.severity_distribution.critical, color: "bg-[#F43F5E]", text: "text-[#F43F5E]" },
                    { label: "High", count: metrics.severity_distribution.high, color: "bg-[#FB923C]", text: "text-[#FB923C]" },
                    { label: "Medium", count: metrics.severity_distribution.medium, color: "bg-[#FBBF24]", text: "text-[#FBBF24]" },
                    { label: "Low", count: metrics.severity_distribution.low, color: "bg-[#60A5FA]", text: "text-[#60A5FA]" },
                    { label: "Info", count: metrics.severity_distribution.info, color: "bg-zinc-500", text: "text-zinc-500" },
                  ].map((item) => {
                    const pct = metrics.findings_total > 0 ? (item.count / metrics.findings_total) * 100 : 0;
                    return (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">
                            {item.label}
                          </span>
                          <span className={`font-mono font-semibold ${item.text}`}>
                            {item.count}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-[#161920] rounded-full overflow-hidden border border-transparent dark:border-[#222630]/60">
                          <div
                            className={`h-full ${item.color} rounded-full transition-all duration-500`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Audit Trail & Live Activity */}
              <div className="cockpit-card specular-top p-5 lg:col-span-2 shadow-md space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#222630] pb-2.5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                    Verified Activity & Audit Log
                  </h2>
                  <span className="text-[10px] text-zinc-400 dark:text-[#6B7280] font-mono">
                    Timezone: Asia/Kolkata (IST)
                  </span>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-[#222630]">
                  {metrics.recent_activity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400 dark:text-[#6B7280]">
                      No security operations recorded yet. Activity will appear here in real-time as assessments and scans are dispatched.
                    </div>
                  ) : (
                    metrics.recent_activity.slice(0, 6).map((log) => (
                      <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3 text-xs">
                        <div className="flex items-start gap-2 min-w-0">
                          <Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280] shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-semibold text-zinc-900 dark:text-[#F9FAFB] font-mono text-[11px] block truncate">
                              {log.action}
                            </span>
                            <p className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] mt-0.5 break-words">
                              {log.details || `Operation on ${log.resource_type}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono shrink-0 pl-5 sm:pl-0">
                          <TimeDisplay value={log.created_at} mode="datetime" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
