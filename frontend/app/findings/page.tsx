"use client";

import React, { useEffect, useState, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
import { Button } from "@/components/ui/button";
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
  AlertTriangle,
  AlertCircle,
  Info,
  Globe,
  Server,
  Layers,
  Clock,
  Shield,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// Severity Badge & Icon Definitions
const SEVERITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; rowBorderClass: string; icon: any }
> = {
  critical: {
    label: "Critical",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/35 shadow-[0_0_12px_rgba(244,63,94,0.18)]",
    rowBorderClass: "border-l-rose-500",
    icon: ShieldAlert,
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/35 shadow-[0_0_12px_rgba(251,146,60,0.18)]",
    rowBorderClass: "border-l-orange-500",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    rowBorderClass: "border-l-amber-500",
    icon: AlertCircle,
  },
  low: {
    label: "Low",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    rowBorderClass: "border-l-sky-500",
    icon: Info,
  },
  info: {
    label: "Info",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/35",
    rowBorderClass: "border-l-slate-500",
    icon: Info,
  },
};

// Remediation Status Badge Definitions
const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  open: {
    label: "Open",
    badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    icon: AlertCircle,
  },
  in_remediation: {
    label: "In Remediation",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  verification_pending: {
    label: "Retest Pending",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/30",
    icon: Loader2,
  },
  verified_fixed: {
    label: "Verified Fixed",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    icon: CheckCheck,
  },
  accepted_risk: {
    label: "Accepted Risk",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    icon: Shield,
  },
};

// Clean helper to check if CVE is meaningful
function isValidCve(cveId?: string | null): boolean {
  if (!cveId) return false;
  const trimmed = cveId.trim().toLowerCase();
  if (trimmed === "" || trimmed === "none" || trimmed === "null" || trimmed === "n/a" || trimmed === "—") {
    return false;
  }
  return true;
}

function FindingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL query params
  const engagementFilter = searchParams.get("engagement_id") || searchParams.get("engagementId") || "";

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
        engagement_id: engagementFilter || undefined,
        page_size: 100,
      });
      setFindings(data.items);
      setTotal(data.total);
    } catch {
      // Ignore network errors in polling
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchFindings, 200);
    return () => clearTimeout(timer);
  }, [search, severityFilter, statusFilter, engagementFilter]);

  // Metric counts across full returned list
  const criticalCount = useMemo(
    () => findings.filter((f) => f.severity === "critical").length,
    [findings]
  );
  const highCount = useMemo(
    () => findings.filter((f) => f.severity === "high").length,
    [findings]
  );
  const inRemediationCount = useMemo(
    () => findings.filter((f) => f.status === "in_remediation").length,
    [findings]
  );
  const fixedCount = useMemo(
    () => findings.filter((f) => f.status === "verified_fixed").length,
    [findings]
  );

  const clearEngagementFilter = () => {
    router.push("/findings");
  };

  return (
    <AppShell title="Assessment & Findings">
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Cockpit Header Card */}
        <div className="cockpit-card specular-top border-[#F5C518]/25 p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div className="h-12 w-12 rounded-xl border border-[#F5C518]/40 bg-[#161920] shadow-[0_2px_14px_rgba(245,197,24,0.18)] flex items-center justify-center shrink-0 text-[#F5C518]">
                <ShieldAlert className="h-6 w-6 text-[#F5C518]" />
              </div>
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB]">
                    Vulnerabilities & Remediation
                  </h1>
                  <span className="badge-cyber bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border-[#F5C518]/35 shrink-0">
                    Live Security Pipeline
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] leading-relaxed max-w-2xl">
                  Centralized vulnerability triage, CVSS scoring, technical proof-of-concept evidence, and verified remediation audit trails.
                </p>
              </div>
            </div>

            {/* Header Actions: Single prominent primary action with subordinate helpers */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsLauncherOpen(true)}
                className="text-xs h-9 px-4 gap-2 font-bold shadow-md"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Launch Security Scan</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsScanOpen(true)}
                className="text-xs h-9 px-3 gap-1.5 font-medium"
              >
                <Terminal className="h-3.5 w-3.5 text-[#F5C518]" />
                <span>Import Scan Results</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedFinding(null);
                  setIsFormOpen(true);
                }}
                className="text-xs h-9 px-3 gap-1.5 font-medium"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Record Finding</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Interactive KPI Telemetry Strip (Clickable Fast-Filters) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Total Findings (Reset filter) */}
          <button
            type="button"
            onClick={() => {
              setSeverityFilter("");
              setStatusFilter("");
            }}
            className={`cockpit-card cockpit-card-interactive specular-top p-3.5 text-left transition-all ${
              severityFilter === "" && statusFilter === ""
                ? "ring-1 ring-[#F5C518] bg-[#F5C518]/5 shadow-md"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400 dark:text-slate-400 text-[11px] font-medium">
              <span>All Findings</span>
              <FileCheck2 className="h-3.5 w-3.5 text-[#F5C518]" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-[#F9FAFB] mt-1 tracking-tight tabular-nums">
              {total}
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-slate-500 mt-0.5 block truncate">
              {severityFilter === "" && statusFilter === "" ? "Active scope" : "Click to view all"}
            </span>
          </button>

          {/* Critical */}
          <button
            type="button"
            onClick={() => {
              setSeverityFilter(severityFilter === "critical" ? "" : "critical");
            }}
            className={`cockpit-card cockpit-card-interactive specular-top p-3.5 text-left transition-all border-l-4 border-l-rose-500 ${
              severityFilter === "critical"
                ? "ring-1 ring-rose-500 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-rose-400 text-[11px] font-semibold">
              <span>Critical</span>
              <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-1 tracking-tight tabular-nums">
              {criticalCount}
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-slate-500 mt-0.5 block truncate">
              {severityFilter === "critical" ? "Filtering Critical" : "Immediate triage"}
            </span>
          </button>

          {/* High */}
          <button
            type="button"
            onClick={() => {
              setSeverityFilter(severityFilter === "high" ? "" : "high");
            }}
            className={`cockpit-card cockpit-card-interactive specular-top p-3.5 text-left transition-all border-l-4 border-l-orange-500 ${
              severityFilter === "high"
                ? "ring-1 ring-orange-500 bg-orange-500/10 shadow-[0_0_15px_rgba(251,146,60,0.2)]"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-orange-400 text-[11px] font-semibold">
              <span>High Severity</span>
              <AlertTriangle className="h-3.5 w-3.5 text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-orange-400 mt-1 tracking-tight tabular-nums">
              {highCount}
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-slate-500 mt-0.5 block truncate">
              {severityFilter === "high" ? "Filtering High" : "Priority remediation"}
            </span>
          </button>

          {/* In Remediation */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "in_remediation" ? "" : "in_remediation");
            }}
            className={`cockpit-card cockpit-card-interactive specular-top p-3.5 text-left transition-all border-l-4 border-l-amber-500 ${
              statusFilter === "in_remediation"
                ? "ring-1 ring-amber-500 bg-amber-500/10 shadow-[0_0_15px_rgba(245,197,24,0.2)]"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-amber-300 text-[11px] font-semibold">
              <span>In Remediation</span>
              <Clock className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-300 mt-1 tracking-tight tabular-nums">
              {inRemediationCount}
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-slate-500 mt-0.5 block truncate">
              {statusFilter === "in_remediation" ? "Filtering in progress" : "Under active fix"}
            </span>
          </button>

          {/* Verified Fixed */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === "verified_fixed" ? "" : "verified_fixed");
            }}
            className={`cockpit-card cockpit-card-interactive specular-top p-3.5 text-left transition-all border-l-4 border-l-emerald-500 ${
              statusFilter === "verified_fixed"
                ? "ring-1 ring-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                : "opacity-90 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between text-emerald-300 text-[11px] font-semibold">
              <span>Verified Fixed</span>
              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-300 mt-1 tracking-tight tabular-nums">
              {fixedCount}
            </div>
            <span className="text-[10px] text-zinc-500 dark:text-slate-500 mt-0.5 block truncate">
              {statusFilter === "verified_fixed" ? "Filtering fixed" : "Audited & closed"}
            </span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="cockpit-card specular-top p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-md">
          <div className="flex-1 flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#6B7280]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search findings by title, CVE, description..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg glass-input text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#6B7280] min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Active Engagement Filter Pill */}
            {engagementFilter && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 text-xs text-[#FFD84D]">
                <Layers className="h-3.5 w-3.5" />
                <span>Scope Filtered</span>
                <button
                  type="button"
                  onClick={clearEngagementFilter}
                  className="ml-1 p-0.5 hover:bg-white/[0.1] rounded text-[#FFD84D]"
                  title="Clear Engagement Scope Filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#07090E]/90 text-xs text-slate-200 min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-label="Filter by vulnerability severity"
            >
              <option value="" className="bg-[#07090E] text-slate-300">All Severities</option>
              <option value="critical" className="bg-[#07090E] text-rose-400">Critical</option>
              <option value="high" className="bg-[#07090E] text-orange-400">High</option>
              <option value="medium" className="bg-[#07090E] text-amber-400">Medium</option>
              <option value="low" className="bg-[#07090E] text-sky-400">Low</option>
              <option value="info" className="bg-[#07090E] text-slate-400">Info</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-white/[0.08] bg-[#07090E]/90 text-xs text-slate-200 min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-label="Filter by remediation status"
            >
              <option value="" className="bg-[#07090E] text-slate-300">All Statuses</option>
              <option value="open" className="bg-[#07090E] text-rose-300">Open</option>
              <option value="in_remediation" className="bg-[#07090E] text-amber-300">In Remediation</option>
              <option value="verification_pending" className="bg-[#07090E] text-sky-300">Retest Pending</option>
              <option value="verified_fixed" className="bg-[#07090E] text-emerald-300">Verified Fixed</option>
              <option value="accepted_risk" className="bg-[#07090E] text-slate-400">Accepted Risk</option>
            </select>

            {/* View Mode Toggle */}
            <div
              role="group"
              aria-label="Findings directory view mode"
              className="inline-flex rounded-lg border border-white/[0.08] p-0.5 bg-white/[0.02] text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to card view"
                aria-pressed={viewMode === "cards"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-1 focus:ring-[#F5C518] ${
                  viewMode === "cards"
                    ? "bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 shadow-xs font-semibold"
                    : "text-slate-400 hover:text-slate-200"
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
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-1 focus:ring-[#F5C518] ${
                  viewMode === "table"
                    ? "bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 shadow-xs font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Findings Directory Content */}
        <div data-loading-state={loading && findings.length === 0 ? "loading" : "complete"}>
          {loading && findings.length === 0 ? (
            viewMode === "cards" ? (
              <CardGridSkeleton count={6} />
            ) : (
              <div className="cockpit-card specular-top rounded-xl overflow-hidden shadow-md">
                <TableSkeleton rows={6} cols={6} />
              </div>
            )
          ) : findings.length === 0 ? (
            <div
              data-empty="true"
              className="cockpit-card specular-top p-12 text-center rounded-xl shadow-md border-dashed border-white/[0.12] space-y-3"
            >
              <div className="h-12 w-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto text-slate-400">
                <FileCheck2 className="h-6 w-6 opacity-70" />
              </div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                No security vulnerabilities found
              </p>
              <p className="text-xs text-zinc-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                {search || severityFilter || statusFilter || engagementFilter
                  ? "No findings match your current filters. Try resetting search criteria or selecting all severities."
                  : "Launch an automated website security audit or import scan results from Nuclei/Shannon to populate findings."}
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-2">
                {(search || severityFilter || statusFilter || engagementFilter) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch("");
                      setSeverityFilter("");
                      setStatusFilter("");
                      if (engagementFilter) clearEngagementFilter();
                    }}
                    className="text-xs h-8"
                  >
                    Clear All Filters
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsLauncherOpen(true)}
                  className="text-xs h-8 font-bold gap-1.5"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Launch Security Scan</span>
                </Button>
              </div>
            </div>
          ) : viewMode === "cards" ? (
            /* Responsive Cards View */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {findings.map((finding) => {
                const sevCfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
                const statusCfg = STATUS_CONFIG[finding.status] || STATUS_CONFIG.open;
                const SevIcon = sevCfg.icon;
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={finding.id}
                    className={`cockpit-card cockpit-card-interactive specular-top p-5 shadow-md flex flex-col justify-between gap-4 border-l-4 ${sevCfg.rowBorderClass} transition-all`}
                  >
                    <div className="space-y-3.5">
                      {/* Top Badges Ribbon: Distinct Severity (left) and Status (right) */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-sans font-bold border ${sevCfg.badgeClass}`}
                        >
                          <SevIcon className="h-3 w-3 shrink-0" />
                          <span>{sevCfg.label}</span>
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold border whitespace-nowrap ${statusCfg.badgeClass}`}
                        >
                          <StatusIcon className="h-3 w-3 shrink-0" />
                          <span>{statusCfg.label}</span>
                        </span>
                      </div>

                      {/* Technical Identifiers Row: CVSS and CVE */}
                      {(finding.cvss_score !== null || isValidCve(finding.cve_id)) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-white/[0.05] text-slate-200 border border-white/[0.1]">
                              CVSS {finding.cvss_score}
                            </span>
                          )}

                          {isValidCve(finding.cve_id) && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-[#F5C518]/10 text-[#FFD84D] border border-[#F5C518]/25">
                              {finding.cve_id}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Finding Title & Description Preview */}
                      <div>
                        <Link
                          href={`/findings/${finding.id}`}
                          className="font-bold text-zinc-100 hover:text-[#FFD84D] hover:underline text-sm leading-snug block break-words"
                        >
                          {finding.title}
                        </Link>
                        {finding.description && (
                          <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed break-words text-ellipsis overflow-hidden">
                            {finding.description}
                          </p>
                        )}
                      </div>

                      {/* Scope & Target Asset Details */}
                      <div className="pt-2 border-t border-white/[0.06] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-[11px] flex items-center gap-1 text-slate-400">
                            <Globe className="h-3 w-3 text-slate-500 shrink-0" />
                            <span>Target Asset:</span>
                          </span>
                          <span className="font-mono text-[11px] truncate max-w-[190px] text-slate-200 font-medium">
                            {finding.asset_name || "Scoped Host"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-400">
                          <span className="text-[11px] flex items-center gap-1 text-slate-400">
                            <Layers className="h-3 w-3 text-slate-500 shrink-0" />
                            <span>Engagement:</span>
                          </span>
                          <span className="text-[11px] truncate max-w-[190px] text-slate-300">
                            {finding.engagement_name || "Web Assessment"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <Link
                        href={`/findings/${finding.id}`}
                        className="text-xs text-[#B88700] dark:text-[#FFD84D] hover:underline font-bold inline-flex items-center gap-1"
                      >
                        <span>View Details</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setSelectedFinding(finding);
                            setIsVerifyOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-200 min-h-[32px] font-medium border border-white/[0.1] transition-colors"
                          title="Record Verification Retest"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Verify</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFinding(finding);
                            setIsFormOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] min-h-[32px] min-w-[32px] flex items-center justify-center border border-white/[0.06]"
                          title="Edit Finding"
                          aria-label={`Edit finding ${finding.title}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* High-Density Readable Table View (Non-sticky Actions to preserve 100% Status visibility) */
            <div className="cockpit-card specular-top rounded-xl overflow-hidden shadow-md">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-slate-300 font-sans text-[11px] font-semibold uppercase tracking-wider">
                      <th className="py-3.5 px-4 w-[115px]">Severity</th>
                      <th className="py-3.5 px-4">Vulnerability Finding</th>
                      <th className="py-3.5 px-4 w-[165px]">Target Asset & Scope</th>
                      <th className="py-3.5 px-4 w-[105px]">CVE / Score</th>
                      <th className="py-3.5 px-4 w-[145px] whitespace-nowrap">Status</th>
                      <th className="py-3.5 px-4 text-right w-[115px] whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {findings.map((finding) => {
                      const sevCfg = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
                      const statusCfg = STATUS_CONFIG[finding.status] || STATUS_CONFIG.open;
                      const SevIcon = sevCfg.icon;
                      const StatusIcon = statusCfg.icon;

                      return (
                        <tr
                          key={finding.id}
                          className={`hover:bg-white/[0.02] transition-colors border-l-4 ${sevCfg.rowBorderClass}`}
                        >
                          {/* Severity & CVSS */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex flex-col gap-1.5 items-start">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-sans font-bold border ${sevCfg.badgeClass}`}
                              >
                                <SevIcon className="h-3 w-3 shrink-0" />
                                <span>{sevCfg.label}</span>
                              </span>
                              {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                                <span className="px-2 py-0.2 rounded text-[10px] font-mono font-semibold bg-white/[0.05] text-slate-300 border border-white/[0.08]">
                                  CVSS {finding.cvss_score}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Vulnerability Title & Description */}
                          <td className="py-3.5 px-4 align-top overflow-hidden">
                            <div className="space-y-0.5">
                              <Link
                                href={`/findings/${finding.id}`}
                                className="font-bold text-zinc-100 hover:text-[#FFD84D] hover:underline text-sm leading-snug block break-words"
                              >
                                {finding.title}
                              </Link>
                              {finding.description && (
                                <p className="text-xs text-slate-400 truncate leading-relaxed">
                                  {finding.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Target Scope & Asset */}
                          <td className="py-3.5 px-4 align-top overflow-hidden">
                            <div className="space-y-0.5">
                              <div className="font-mono text-xs font-medium text-slate-200 flex items-center gap-1.5">
                                <Globe className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[130px]">
                                  {finding.asset_name || "Target Host"}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[130px]">
                                {finding.engagement_name || "Engagement"}
                              </div>
                            </div>
                          </td>

                          {/* CVE / Identifier */}
                          <td className="py-3.5 px-4 align-top">
                            {isValidCve(finding.cve_id) ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-[#F5C518]/10 text-[#FFD84D] border border-[#F5C518]/25">
                                {finding.cve_id}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-500 font-mono">—</span>
                            )}
                          </td>

                          {/* Remediation Status: 100% Unobscured & Fully Legible */}
                          <td className="py-3.5 px-4 align-top whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border whitespace-nowrap ${statusCfg.badgeClass}`}
                            >
                              <StatusIcon className="h-3 w-3 shrink-0" />
                              <span>{statusCfg.label}</span>
                            </span>
                          </td>

                          {/* Action Buttons: Standard non-sticky right aligned */}
                          <td className="py-3.5 px-4 text-right align-top whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedFinding(finding);
                                  setIsVerifyOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs text-slate-200 min-h-[30px] font-medium border border-white/[0.1] transition-colors"
                                title="Record Verification Retest"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                <span>Verify</span>
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedFinding(finding);
                                  setIsFormOpen(true);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/[0.06] min-h-[30px] min-w-[30px] flex items-center justify-center border border-white/[0.06]"
                                title="Edit Finding"
                                aria-label={`Edit finding ${finding.title}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modals & Dialogs */}
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
          onViewFindings={() => {
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

export default function FindingsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Assessment & Findings">
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-[#F5C518]" />
            <span className="text-xs font-mono">Loading security findings...</span>
          </div>
        </AppShell>
      }
    >
      <FindingsContent />
    </Suspense>
  );
}
