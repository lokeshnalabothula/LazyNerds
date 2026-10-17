"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
import { FindingFormModal } from "@/components/findings/finding-form-modal";
import { ScanImportModal } from "@/components/findings/scan-import-modal";
import { VerificationModal } from "@/components/findings/verification-modal";
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
    switch (severity) {
      case "critical":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  return (
    <AppShell title="Assessment & Findings">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              Vulnerabilities & Remediation
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Recorded cybersecurity findings, CVSS scores, remediation workflows, and verification records.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setIsScanOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[36px]"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Import Scan Results</span>
            </button>
            <button
              onClick={() => {
                setSelectedFinding(null);
                setIsFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Record Finding</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search findings by title, CVE, description..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 min-h-[36px]"
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
              className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 min-h-[36px]"
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
              className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-100 dark:bg-zinc-900 text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to Card View"
                aria-pressed={viewMode === "cards"}
                className={`px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to Table View"
                aria-pressed={viewMode === "table"}
                className={`px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  viewMode === "table"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
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
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <span className="text-xs font-mono">Loading security findings…</span>
          </div>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium min-h-[36px]"
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
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(
                        finding.severity
                      )}`}
                    >
                      {finding.severity}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                        finding.status === "verified_fixed"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : finding.status === "in_remediation"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {finding.status === "verified_fixed" ? (
                        <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                      ) : null}
                      <span className="capitalize">{finding.status.replace("_", " ")}</span>
                    </span>
                  </div>

                  <div>
                    <Link
                      href={`/findings/${finding.id}`}
                      className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-brand-600 dark:hover:text-brand-400 hover:underline text-sm leading-snug line-clamp-2"
                    >
                      {finding.title}
                    </Link>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
                      {finding.engagement_name || "Engagement"}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-[11px] text-zinc-400">Target Asset:</span>
                      <span className="font-mono text-[11px] truncate max-w-[180px]">
                        {finding.asset_name || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-[11px] text-zinc-400">Identifier:</span>
                      <span className="font-mono text-[11px]">
                        {finding.cve_id || (finding.cvss_score ? `CVSS ${finding.cvss_score}` : "—")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
                  <Link
                    href={`/findings/${finding.id}`}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                  >
                    View Details
                  </Link>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setSelectedFinding(finding);
                        setIsVerifyOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 min-h-[34px] font-medium"
                      title="Record Verification Retest"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Verify</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedFinding(finding);
                        setIsFormOpen(true);
                      }}
                      className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
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
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                    <th className="py-2.5 px-3 font-semibold">Severity</th>
                    <th className="py-2.5 px-3 font-semibold">Vulnerability Title</th>
                    <th className="py-2.5 px-3 font-semibold">Target Asset</th>
                    <th className="py-2.5 px-3 font-semibold">CVE / CVSS</th>
                    <th className="py-2.5 px-3 font-semibold">Remediation Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {findings.map((finding) => (
                    <tr key={finding.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${getSeverityBadge(
                            finding.severity
                          )}`}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Link
                          href={`/findings/${finding.id}`}
                          className="font-semibold text-zinc-900 dark:text-zinc-100 hover:text-brand-600 dark:hover:text-brand-400 hover:underline"
                        >
                          {finding.title}
                        </Link>
                        <div className="text-[10px] text-zinc-400 truncate max-w-sm">
                          {finding.engagement_name || "Engagement"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                          {finding.asset_name || "System"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300">
                          {finding.cve_id || "—"}
                        </div>
                        {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                          <div className="text-[10px] text-zinc-400">
                            CVSS {finding.cvss_score}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                            finding.status === "verified_fixed"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : finding.status === "in_remediation"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-zinc-600 dark:text-zinc-400"
                          }`}
                        >
                          {finding.status === "verified_fixed" ? (
                            <CheckCheck className="h-3.5 w-3.5 text-emerald-500" />
                          ) : null}
                          <span className="capitalize">{finding.status.replace("_", " ")}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedFinding(finding);
                              setIsVerifyOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-xs text-zinc-700 dark:text-zinc-300 min-h-[34px]"
                            title="Record Verification Retest"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Verify</span>
                          </button>
                          <button
                            onClick={() => {
                              setSelectedFinding(finding);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
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
