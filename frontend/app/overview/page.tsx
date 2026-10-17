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
      setError(err.message || "Failed to load dashboard metrics.");
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
      alert(`Action failed: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <AppShell title="Platform Overview">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header with Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              FixOps Security Orchestration
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Live telemetry and automated cybersecurity workflows calculated from verified database records.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/engagements/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Engagement</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {loading && !metrics ? (
          <div className="h-64 flex items-center justify-center text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500 mr-2" />
            <span className="text-xs font-mono">Loading platform telemetry...</span>
          </div>
        ) : metrics ? (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Link
                href="/clients"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Clients</span>
                  <Users className="h-4 w-4 text-brand-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {metrics.clients_total}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {metrics.clients_active} active accounts
                </div>
              </Link>

              <Link
                href="/engagements"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Engagements</span>
                  <Layers className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {metrics.engagements_total}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {metrics.engagements_active} ongoing
                </div>
              </Link>

              <Link
                href="/assets"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Assets</span>
                  <Shield className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {metrics.assets_total}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                  {metrics.assets_in_scope} in-scope
                </div>
              </Link>

              <Link
                href="/findings?status=open"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Open Findings</span>
                  <FileCheck2 className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {metrics.findings_open}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {metrics.findings_total} total recorded
                </div>
              </Link>

              <Link
                href="/findings?status=verified_fixed"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Remediated</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {metrics.findings_verified_fixed}
                </div>
                <div className="text-[10px] text-zinc-400 mt-1">
                  {metrics.findings_in_remediation} in progress
                </div>
              </Link>

              <Link
                href="/automation"
                className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
              >
                <div className="flex items-center justify-between text-zinc-500 mb-2">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Automations</span>
                  <Zap className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-100">
                  {metrics.automation_executions_total}
                </div>
                <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                  {metrics.pending_approvals_total} pending approvals
                </div>
              </Link>
            </div>

            {/* Severity Distribution & Automation Action Center */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Finding Severity Distribution */}
              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 lg:col-span-1">
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

              {/* Pending Approvals & Activity Feed */}
              <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 lg:col-span-2">
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
                      No activity recorded yet.
                    </div>
                  ) : (
                    metrics.recent_activity.slice(0, 6).map((log) => (
                      <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                        <div className="flex items-start gap-2">
                          <Clock className="h-3.5 w-3.5 text-zinc-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100 font-mono text-[11px]">
                              {log.action}
                            </span>
                            <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5">
                              {log.details || `Operation on ${log.resource_type}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-zinc-400 font-mono shrink-0">
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
