"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { OverviewMetrics } from "@/types/overview";
import { formatDateTime } from "@/lib/utils";
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
  Loader2,
  Check,
  X,
  ShieldAlert,
  Inbox,
} from "lucide-react";

export default function OverviewPage() {
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchMetrics = async () => {
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
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleQuickApprove = async (executionId: string, action: "approve" | "reject") => {
    try {
      setApprovingId(executionId);
      await api.approveExecution(executionId, action);
      await fetchMetrics();
    } catch (err: any) {
      alert(`Approval operation failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const isInitialPlatform =
    metrics &&
    metrics.clients_total === 0 &&
    metrics.engagements_total === 0 &&
    metrics.assets_total === 0 &&
    metrics.findings_total === 0;

  return (
    <AppShell title="Platform Overview">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header with Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              FixOps Security Operations
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Live telemetry and automated cybersecurity workflows calculated from verified database records.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[36px]"
              aria-label="Refresh platform telemetry"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/engagements/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Engagement</span>
            </Link>
          </div>
        </div>

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

        {loading && !metrics ? (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/40 h-24 flex flex-col justify-between"
                >
                  <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-7 w-10 bg-zinc-200 dark:bg-zinc-800 rounded" />
                  <div className="h-2.5 w-20 bg-zinc-200 dark:bg-zinc-800 rounded" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 h-72 rounded-lg" />
              <div className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/30 h-72 rounded-lg" />
            </div>
          </div>
        ) : metrics ? (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <Link
                href="/clients"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Clients</span>
                    <Users className="h-4 w-4 text-brand-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metrics.clients_total}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 mt-2 truncate">
                  {metrics.clients_active} active accounts
                </div>
              </Link>

              <Link
                href="/engagements"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Engagements</span>
                    <Layers className="h-4 w-4 text-indigo-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metrics.engagements_total}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 mt-2 truncate">
                  {metrics.engagements_active} ongoing
                </div>
              </Link>

              <Link
                href="/assets"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Assets</span>
                    <Shield className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metrics.assets_total}
                  </div>
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 truncate">
                  {metrics.assets_in_scope} in-scope
                </div>
              </Link>

              <Link
                href="/findings?status=open"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Open Findings</span>
                    <FileCheck2 className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metrics.findings_open}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 mt-2 truncate">
                  {metrics.findings_total} total recorded
                </div>
              </Link>

              <Link
                href="/findings?status=verified_fixed"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Remediated</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {metrics.findings_verified_fixed}
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400 mt-2 truncate">
                  {metrics.findings_in_remediation} in progress
                </div>
              </Link>

              <Link
                href="/automation"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-zinc-500 mb-2">
                    <span className="text-[11px] font-medium uppercase tracking-wider">Automations</span>
                    <Zap className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                    {metrics.automation_executions_total}
                  </div>
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-2 truncate">
                  {metrics.pending_approvals_total} pending approvals
                </div>
              </Link>
            </div>

            {/* Empty Platform Guidance (when workspace has no items yet) */}
            {isInitialPlatform && (
              <div className="p-6 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 text-center space-y-3">
                <Inbox className="h-8 w-8 text-zinc-400 mx-auto" />
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Welcome to Your Security Operations Workspace
                  </h2>
                  <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                    Get started by registering a client organization, defining authorized scope boundaries, and launching your first security assessment.
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/clients"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Register First Client</span>
                  </Link>
                  <Link
                    href="/engagements/new"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span>Create Engagement</span>
                  </Link>
                </div>
              </div>
            )}

            {/* Severity Distribution & Activity Center */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Finding Severity Distribution */}
              <div className="p-4 sm:p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 lg:col-span-1 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Finding Severity Breakdown
                  </h2>
                  <Link
                    href="/findings"
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>View all</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="space-y-3">
                  {[
                    { label: "Critical", count: metrics.severity_distribution.critical, color: "bg-rose-500", text: "text-rose-500" },
                    { label: "High", count: metrics.severity_distribution.high, color: "bg-orange-500", text: "text-orange-500" },
                    { label: "Medium", count: metrics.severity_distribution.medium, color: "bg-amber-500", text: "text-amber-500" },
                    { label: "Low", count: metrics.severity_distribution.low, color: "bg-blue-500", text: "text-blue-500" },
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
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
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

              {/* Audit Trail & Recent Activity */}
              <div className="p-4 sm:p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 lg:col-span-2 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Audit Trail & Recent Activity
                  </h2>
                  <Link
                    href="/settings"
                    className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-0.5"
                  >
                    <span>Audit logs</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {metrics.recent_activity.length === 0 ? (
                    <div className="py-8 text-center text-xs text-zinc-400">
                      No security operations recorded yet. Activity will appear here as assessments and scans are dispatched.
                    </div>
                  ) : (
                    metrics.recent_activity.slice(0, 6).map((log) => (
                      <div key={log.id} className="py-2.5 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3 text-xs">
                        <div className="flex items-start gap-2 min-w-0">
                          <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-[11px] block truncate">
                              {log.action}
                            </span>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5 break-words">
                              {log.details || `Operation on ${log.resource_type}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-left sm:text-right text-[10px] text-zinc-400 font-mono shrink-0 pl-5 sm:pl-0" suppressHydrationWarning>
                          {formatDateTime(log.created_at)}
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
