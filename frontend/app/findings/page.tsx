"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
import { FindingFormModal } from "@/components/findings/finding-form-modal";
import { ScanImportModal } from "@/components/findings/scan-import-modal";
import { ScanLauncherModal } from "@/components/findings/scan-launcher-modal";
import { ScanTelemetryModal } from "@/components/findings/scan-telemetry-modal";
import { VerificationModal } from "@/components/findings/verification-modal";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
import { useViewMode } from "@/lib/use-view-mode";
import { formatDateTime } from "@/lib/utils";
import {
  FileCheck2,
  Plus,
  Search,
  Terminal,
  CheckCircle2,
  Edit2,
  Loader2,
  CheckCheck,
  LayoutList,
  LayoutGrid,
  ShieldAlert,
} from "lucide-react";

export default function FindingsPage() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [telemetryAssessmentId, setTelemetryAssessmentId] = useState<string | null>(null);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Device-aware view mode preference (Cards on mobile/tablet, Table on desktop)
  const { viewMode, setViewMode } = useViewMode("fixops_finding_view_mode", 1024);

  const fetchFindings = async () => {
    try {
      setLoading(true);
      const data = await api.getFindings({
        search: search || undefined,
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        page_size: 100,
      });
      setFindings(data.items);
      setTotal(data.total);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchFindings, 200);
    return () => clearTimeout(timer);
  }, [search, severityFilter, statusFilter]);

  const getSeverityBadge = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return "bg-rose-500/10 text-rose-500 dark:text-[#F43F5E] border-rose-500/30";
      case "high":
        return "bg-orange-500/10 text-orange-500 dark:text-[#FB923C] border-orange-500/30";
      case "medium":
        return "bg-amber-500/10 text-amber-500 dark:text-[#FBBF24] border-amber-500/30";
      default:
        return "bg-blue-500/10 text-blue-500 dark:text-[#60A5FA] border-blue-500/30";
    }
  };

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const inRemediationCount = findings.filter((f) => f.status === "in_remediation").length;
  const fixedCount = findings.filter((f) => f.status === "verified_fixed").length;

  return (
    <AppShell title="Assessment & Findings">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-[#222630] pb-5">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB]">
              Vulnerabilities & Remediation
            </h1>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1 leading-relaxed">
              Vulnerability Pipeline & Scanner Ingestion — Technical findings, CVSS scoring, remediation verification, and scanner imports.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsLauncherOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg btn-glossy-gold text-[#111318] text-xs font-bold transition-all shadow-md min-h-[36px] border-none"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-[#111318]" />
              <span>Launch Security Scan</span>
            </button>
            <button
              onClick={() => setIsScanOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] text-xs font-semibold text-zinc-700 dark:text-[#F9FAFB] bg-white dark:bg-[#161920] hover:bg-zinc-100 dark:hover:bg-[#222630] transition-colors min-h-[36px] shadow-xs"
            >
              <Terminal className="h-3.5 w-3.5 text-[#F5C518]" />
              <span>Import Scan Results</span>
            </button>
            <button
              onClick={() => {
                setSelectedFinding(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] text-xs font-semibold text-zinc-700 dark:text-[#F9FAFB] bg-white dark:bg-[#161920] hover:bg-zinc-100 dark:hover:bg-[#222630] transition-colors min-h-[36px] shadow-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Finding</span>
            </button>
          </div>
        </div>

        {/* 5 Severity KPI Stat Chips (Obsidian Precision) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs">
            <span className="text-[10px] font-mono uppercase text-zinc-500 dark:text-[#9CA3AF] block font-medium">Total Pipeline</span>
            <div className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-[#F9FAFB] mt-1 font-mono">
              {total}
            </div>
          </div>
          <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs border-l-4 border-l-[#F43F5E]">
            <span className="text-[10px] font-mono uppercase text-[#F43F5E] block font-medium">Critical</span>
            <div className="text-xl sm:text-2xl font-bold text-[#F43F5E] mt-1 font-mono">
              {criticalCount}
            </div>
          </div>
          <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs border-l-4 border-l-[#FB923C]">
            <span className="text-[10px] font-mono uppercase text-[#FB923C] block font-medium">High</span>
            <div className="text-xl sm:text-2xl font-bold text-[#FB923C] mt-1 font-mono">
              {highCount}
            </div>
          </div>
          <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs border-l-4 border-l-[#FBBF24]">
            <span className="text-[10px] font-mono uppercase text-[#FBBF24] block font-medium">In Remediation</span>
            <div className="text-xl sm:text-2xl font-bold text-[#FBBF24] mt-1 font-mono">
              {inRemediationCount}
            </div>
          </div>
          <div className="p-3 sm:p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs border-l-4 border-l-[#34D399]">
            <span className="text-[10px] font-mono uppercase text-[#34D399] block font-medium">Verified Fixed</span>
            <div className="text-xl sm:text-2xl font-bold text-[#34D399] mt-1 font-mono">
              {fixedCount}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#6B7280]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings by title, CVE, description..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#6B7280] min-h-[36px] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] min-h-[36px] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
              aria-label="Filter by vulnerability severity"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] min-h-[36px] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
              aria-label="Filter by remediation status"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_remediation">In Remediation</option>
              <option value="verification_pending">Verification Pending</option>
              <option value="verified_fixed">Verified Fixed</option>
              <option value="accepted_risk">Accepted Risk</option>
            </select>

            {/* View Mode Toggle */}
            <div
              role="group"
              aria-label="Findings directory view mode"
              className="inline-flex rounded-lg border border-zinc-200 dark:border-[#222630] p-0.5 bg-zinc-100 dark:bg-[#161920] text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to card view"
                aria-pressed={viewMode === "cards"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to list view"
                aria-pressed={viewMode === "table"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Findings Content */}
        {loading && findings.length === 0 ? (
          viewMode === "cards" ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              <TableSkeleton rows={5} cols={5} />
            </div>
          )
        ) : findings.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30">
            <FileCheck2 className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No security findings recorded</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Import scan results using the Nuclei/Nmap adapter or record manual penetration testing findings.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={() => setIsScanOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-xs font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[36px]"
              >
                <Terminal className="h-3.5 w-3.5" />
                <span>Import Scan Results</span>
              </button>
              <button
                onClick={() => {
                  setSelectedFinding(null);
                  setIsFormOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F5C518] hover:bg-[#FFD84D] active:bg-[#DDAA07] text-[#111318] text-xs font-semibold min-h-[36px]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Finding</span>
              </button>
            </div>
          </div>
        ) : viewMode === "cards" ? (
          /* Responsive Cards View (Default on Mobile) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className={`rounded-xl border bg-white dark:bg-[#111318] p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-[#F5C518]/30 transition-all flex flex-col justify-between gap-4 border-l-4 ${
                  finding.severity === "critical"
                    ? "border-l-[#F43F5E] border-zinc-200 dark:border-[#222630]"
                    : finding.severity === "high"
                    ? "border-l-[#FB923C] border-zinc-200 dark:border-[#222630]"
                    : finding.severity === "medium"
                    ? "border-l-[#FBBF24] border-zinc-200 dark:border-[#222630]"
                    : "border-l-[#60A5FA] border-zinc-200 dark:border-[#222630]"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(
                        finding.severity
                      )}`}
                    >
                      {finding.severity}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        finding.status === "verified_fixed"
                          ? "text-emerald-600 dark:text-[#34D399]"
                          : finding.status === "in_remediation"
                          ? "text-amber-600 dark:text-[#FBBF24]"
                          : "text-zinc-600 dark:text-[#9CA3AF]"
                      }`}
                    >
                      {finding.status === "verified_fixed" ? (
                        <CheckCheck className="h-3.5 w-3.5 text-[#34D399]" />
                      ) : null}
                      <span className="capitalize">{finding.status.replace("_", " ")}</span>
                    </span>
                  </div>

                  <div>
                    <Link
                      href={`/findings/${finding.id}`}
                      className="font-semibold text-zinc-900 dark:text-[#F9FAFB] hover:text-[#B88700] dark:hover:text-[#FFD84D] hover:underline text-sm leading-snug line-clamp-2"
                    >
                      {finding.title}
                    </Link>
                    <div className="text-[11px] text-zinc-500 dark:text-[#9CA3AF] mt-1 truncate font-mono">
                      {finding.engagement_name || "Engagement"}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-[#222630] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 dark:text-[#9CA3AF]">
                      <span className="text-[11px] text-zinc-400 dark:text-[#6B7280]">Target Asset:</span>
                      <span className="font-mono text-[11px] truncate max-w-[180px] text-zinc-800 dark:text-zinc-200">
                        {finding.asset_name || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-[#9CA3AF]">
                      <span className="text-[11px] text-zinc-400 dark:text-[#6B7280]">Identifier:</span>
                      <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
                        {finding.cve_id || (finding.cvss_score ? `CVSS ${finding.cvss_score}` : "—")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-[#222630] flex items-center justify-between gap-2">
                  <Link
                    href={`/findings/${finding.id}`}
                    className="text-xs text-[#B88700] dark:text-[#FFD84D] hover:underline font-semibold"
                  >
                    View Details
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedFinding(finding);
                        setIsVerifyOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#161920] hover:bg-zinc-200 dark:hover:bg-[#222630] text-xs text-zinc-700 dark:text-[#F9FAFB] min-h-[34px] font-medium border border-zinc-200 dark:border-[#222630]"
                      title="Record Verification Retest"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399]" />
                      <span>Verify</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFinding(finding);
                        setIsFormOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center border border-transparent dark:hover:border-[#222630]"
                      title="Edit Finding"
                      aria-label={`Edit finding ${finding.title}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View (Default on Desktop) */
          <div className="border border-zinc-200 dark:border-[#222630] rounded-xl overflow-hidden bg-white dark:bg-[#111318] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920] text-zinc-600 dark:text-[#9CA3AF] font-mono text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 font-semibold">Severity</th>
                    <th className="py-3 px-4 font-semibold">Vulnerability Title</th>
                    <th className="py-3 px-4 font-semibold">Target Asset</th>
                    <th className="py-3 px-4 font-semibold">CVE / CVSS</th>
                    <th className="py-3 px-4 font-semibold">Remediation Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#222630]">
                  {findings.map((finding) => (
                    <tr
                      key={finding.id}
                      className={`hover:bg-zinc-50 dark:hover:bg-[#161920]/80 transition-colors border-l-4 ${
                        finding.severity === "critical"
                          ? "border-l-[#F43F5E]"
                          : finding.severity === "high"
                          ? "border-l-[#FB923C]"
                          : finding.severity === "medium"
                          ? "border-l-[#FBBF24]"
                          : "border-l-[#60A5FA]"
                      }`}
                    >
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={`/findings/${finding.id}`}
                          className="font-semibold text-zinc-900 dark:text-[#F9FAFB] hover:text-[#B88700] dark:hover:text-[#FFD84D] hover:underline"
                        >
                          {finding.title}
                        </Link>
                        <div className="text-[10px] text-zinc-400 dark:text-[#6B7280] truncate max-w-sm font-mono mt-0.5">
                          {finding.engagement_name || "Engagement"}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] text-zinc-600 dark:text-[#9CA3AF]">
                          {finding.asset_name || "System"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-200">
                          {finding.cve_id || "—"}
                        </div>
                        {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                          <div className="text-[10px] text-zinc-400 dark:text-[#6B7280] font-mono">
                            CVSS {finding.cvss_score}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            finding.status === "verified_fixed"
                              ? "text-emerald-600 dark:text-[#34D399]"
                              : finding.status === "in_remediation"
                              ? "text-amber-600 dark:text-[#FBBF24]"
                              : "text-zinc-600 dark:text-[#9CA3AF]"
                          }`}
                        >
                          {finding.status === "verified_fixed" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-[#34D399]" />
                          ) : null}
                          <span className="capitalize">{finding.status.replace("_", " ")}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedFinding(finding);
                              setIsVerifyOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-[#161920] hover:bg-zinc-200 dark:hover:bg-[#222630] text-xs text-zinc-700 dark:text-[#F9FAFB] min-h-[34px] border border-zinc-200 dark:border-[#222630]"
                            title="Record Verification Retest"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#34D399]" />
                            <span>Verify</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFinding(finding);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center border border-transparent dark:hover:border-[#222630]"
                            title="Edit Finding"
                            aria-label={`Edit finding ${finding.title}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <FindingFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSaved={fetchFindings}
          findingToEdit={selectedFinding}
        />

        <ScanImportModal
          isOpen={isScanOpen}
          onClose={() => setIsScanOpen(false)}
          onImported={fetchFindings}
        />

        <ScanLauncherModal
          isOpen={isLauncherOpen}
          onClose={() => setIsLauncherOpen(false)}
          onScanLaunched={(assessment) => {
            setTelemetryAssessmentId(assessment.id);
            setIsTelemetryOpen(true);
          }}
        />

        <ScanTelemetryModal
          isOpen={isTelemetryOpen}
          onClose={() => {
            setIsTelemetryOpen(false);
            fetchFindings();
          }}
          assessmentId={telemetryAssessmentId}
          onViewFindings={(id) => {
            setIsTelemetryOpen(false);
            fetchFindings();
          }}
        />

        <VerificationModal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          onVerified={fetchFindings}
          finding={selectedFinding}
        />
      </div>
    </AppShell>
  );
}
