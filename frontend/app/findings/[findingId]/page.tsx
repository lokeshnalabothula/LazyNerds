"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
import { Button } from "@/components/ui/button";
import { VerificationModal } from "@/components/findings/verification-modal";
import { FindingFormModal } from "@/components/findings/finding-form-modal";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Shield,
  FileCheck2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Edit2,
  Loader2,
  Calendar,
  User,
  CheckCheck,
  Globe,
  Layers,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  Clock,
  Wrench,
  ShieldAlert,
  FileText,
  Code,
  Sparkles,
} from "lucide-react";

// Severity Badge Definitions
const SEVERITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; icon: any }
> = {
  critical: {
    label: "Critical Severity",
    badgeClass: "bg-rose-500/15 text-rose-300 border-rose-500/35 shadow-[0_0_14px_rgba(244,63,94,0.25)]",
    icon: ShieldAlert,
  },
  high: {
    label: "High Severity",
    badgeClass: "bg-orange-500/15 text-orange-300 border-orange-500/35 shadow-[0_0_14px_rgba(251,146,60,0.25)]",
    icon: AlertTriangle,
  },
  medium: {
    label: "Medium Severity",
    badgeClass: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    icon: AlertCircle,
  },
  low: {
    label: "Low Severity",
    badgeClass: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    icon: AlertCircle,
  },
  info: {
    label: "Informational",
    badgeClass: "bg-slate-500/15 text-slate-300 border-slate-500/35",
    icon: FileText,
  },
};

// Remediation Status Badge Definitions
const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; icon: any }> = {
  open: {
    label: "Open (Unresolved)",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/25",
    icon: AlertCircle,
  },
  in_remediation: {
    label: "In Remediation",
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    icon: Clock,
  },
  verification_pending: {
    label: "Retest Pending",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    icon: Loader2,
  },
  verified_fixed: {
    label: "Verified Fixed",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    icon: CheckCheck,
  },
  accepted_risk: {
    label: "Accepted Risk",
    badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/25",
    icon: Shield,
  },
};

function isValidCve(cveId?: string | null): boolean {
  if (!cveId) return false;
  const trimmed = cveId.trim().toLowerCase();
  if (trimmed === "" || trimmed === "none" || trimmed === "null" || trimmed === "n/a" || trimmed === "—") {
    return false;
  }
  return true;
}

export default function FindingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const findingId = params?.findingId as string;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [hasCopiedEvidence, setHasCopiedEvidence] = useState(false);

  const fetchFinding = async () => {
    if (!findingId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getFindingById(findingId);
      setFinding(data);
    } catch (err: any) {
      setError(err.message || "Failed to load finding details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinding();
  }, [findingId]);

  const copyEvidenceToClipboard = () => {
    if (!finding?.evidence) return;
    navigator.clipboard.writeText(finding.evidence);
    setHasCopiedEvidence(true);
    setTimeout(() => setHasCopiedEvidence(false), 2200);
  };

  return (
    <AppShell title="Vulnerability Finding Details">
      <div className="space-y-6 max-w-6xl mx-auto pb-16">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/findings"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-100 transition-colors py-1 px-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.06]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Findings</span>
          </Link>

          {finding && (
            <span className="text-[11px] font-mono text-slate-500">
              ID: {finding.id.slice(0, 8)}...
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#F5C518]" />
            <span className="text-xs font-mono">Loading vulnerability record...</span>
          </div>
        ) : error || !finding ? (
          <div className="p-6 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-rose-200">Failed to load vulnerability finding</h3>
              <p className="mt-1 text-slate-400">{error || "The requested finding could not be found."}</p>
            </div>
          </div>
        ) : (
          <div data-loading-state="complete" className="space-y-6 min-w-0 max-w-full">
            {/* Header Hero Card */}
            <div className="cockpit-card specular-top p-4 sm:p-7 shadow-xl space-y-5 relative overflow-hidden min-w-0 max-w-full">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                <div className="space-y-3 min-w-0 flex-1">
                  {/* Badges Ribbon */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Severity Badge */}
                    {(() => {
                      const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
                      const SevIcon = sev.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${sev.badgeClass}`}
                        >
                          <SevIcon className="h-3.5 w-3.5" />
                          <span>{sev.label}</span>
                        </span>
                      );
                    })()}

                    {/* CVSS Score */}
                    {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-white/[0.05] text-[#FFD84D] border border-white/[0.12]">
                        <span>CVSS {finding.cvss_score}</span>
                      </span>
                    )}

                    {/* CVE Identifier */}
                    {isValidCve(finding.cve_id) && (
                      <a
                        href={`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(finding.cve_id!)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-mono font-semibold bg-[#F5C518]/15 text-[#FFD84D] border border-[#F5C518]/30 hover:bg-[#F5C518]/25 transition-colors"
                        title="View NIST NVD Advisory"
                      >
                        <span>{finding.cve_id}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {/* Remediation Status */}
                    {(() => {
                      const st = STATUS_CONFIG[finding.status] || STATUS_CONFIG.open;
                      const StIcon = st.icon;
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border ${st.badgeClass}`}
                        >
                          <StIcon className="h-3.5 w-3.5" />
                          <span>{st.label}</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Finding Title */}
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight text-white leading-tight font-sans">
                    {finding.title}
                  </h1>

                  {/* Metadata Ribbon */}
                  <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Globe className="h-3.5 w-3.5 text-[#F5C518]" />
                      <span className="text-slate-400">Target Asset:</span>
                      <span className="font-mono font-medium text-slate-100">
                        {finding.asset_name || "Scoped Host"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-[#F5C518]" />
                      <span className="text-slate-400">Engagement:</span>
                      <Link
                        href={`/engagements/${finding.engagement_id}`}
                        className="font-medium text-slate-100 hover:text-[#FFD84D] hover:underline"
                      >
                        {finding.engagement_name || "Linked Engagement"}
                      </Link>
                    </div>

                    {finding.assigned_to && (
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="text-slate-400">Assigned To:</span>
                        <span className="font-medium text-slate-100">{finding.assigned_to}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-400">Logged:</span>
                      <span className="text-slate-200" suppressHydrationWarning>
                        {formatDateTime(finding.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Header Action Hierarchy: Single prominent primary action */}
                <div className="flex items-center gap-2.5 shrink-0 pt-2 lg:pt-0">
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => setIsVerifyOpen(true)}
                    className="text-xs h-10 px-4 gap-2 font-bold shadow-lg"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Record Verification</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => setIsEditOpen(true)}
                    className="text-xs h-10 px-3.5 gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit Finding</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Core Findings Dossier Layout */}
            <div className="space-y-6">
              {/* Section 1: Technical Vulnerability Description & Risk Impact */}
              <div className="cockpit-card specular-top p-6 shadow-md space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider font-sans">
                    <FileText className="h-4 w-4 text-[#F5C518]" />
                    <span>Technical Vulnerability Description</span>
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {finding.description || "No formal technical description recorded."}
                  </p>
                </div>

                {/* Threat Vector & Business Impact Callout */}
                <div className="p-4 rounded-xl border border-amber-500/25 bg-amber-950/15 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    <span>Threat Vector & Security Impact</span>
                  </div>
                  <p className="text-xs text-amber-100/90 leading-relaxed whitespace-pre-wrap">
                    {finding.impact ||
                      "Unmitigated vulnerabilities can allow unauthorized actors to compromise data integrity, extract sensitive credentials, or disrupt application availability."}
                  </p>
                </div>
              </div>

              {/* Section 2: Replication Evidence / Proof-of-Concept Terminal */}
              <div className="cockpit-card specular-top p-4 sm:p-6 shadow-md space-y-3 min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-[#161920] border border-white/[0.08] flex items-center justify-center text-[#F5C518] shrink-0">
                      <Terminal className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-sans truncate">
                        Replication Evidence & HTTP Proof-of-Concept
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate">
                        Exact request payloads, server responses, and extraction evidence.
                      </p>
                    </div>
                  </div>

                  {finding.evidence && (
                    <button
                      type="button"
                      onClick={copyEvidenceToClipboard}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-slate-200 border border-white/[0.10] transition-colors shrink-0"
                    >
                      {hasCopiedEvidence ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-[#F5C518]" />
                          <span>Copy Evidence</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {finding.evidence ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#07090E] p-3 sm:p-4 font-mono text-xs text-emerald-400/95 leading-relaxed overflow-x-auto shadow-inner min-w-0 max-w-full">
                    <pre className="whitespace-pre min-w-0">{finding.evidence}</pre>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-slate-500 rounded-lg border border-dashed border-white/[0.08] bg-white/[0.01]">
                    No raw HTTP traffic or payload proof-of-concept recorded for this finding.
                  </div>
                )}
              </div>

              {/* Section 3: Engineering Remediation Guidance & Fix Instructions */}
              <div className="cockpit-card specular-top p-4 sm:p-6 shadow-md border-emerald-500/20 bg-emerald-950/5 space-y-4 min-w-0 max-w-full overflow-hidden">
                <div className="flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300 font-sans">
                      Actionable Engineering Remediation
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Step-by-step resolution guidance, hardening rules, and patch requirements.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-emerald-500/20 bg-black/40 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words min-w-0">
                  {finding.remediation_guidance ||
                    "Investigate affected endpoints, apply current vendor security patches, enforce strict input validation, and update dependencies to patched revisions."}
                </div>

                {finding.remediation_notes && (
                  <div className="p-3.5 rounded-lg border border-white/[0.08] bg-white/[0.02] text-xs text-slate-300 break-words min-w-0">
                    <strong className="text-[#FFD84D]">Engineering Notes: </strong>
                    <span>{finding.remediation_notes}</span>
                  </div>
                )}

                {finding.references_url && (
                  <div className="pt-2 border-t border-white/[0.06] flex items-center gap-2 text-xs min-w-0">
                    <span className="text-slate-400 font-medium shrink-0">External Advisory:</span>
                    <a
                      href={finding.references_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#FFD84D] hover:underline inline-flex items-center gap-1 font-mono truncate min-w-0"
                    >
                      <span className="truncate">{finding.references_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                )}
              </div>

              {/* Section 4: Retest & Verification Timeline */}
              <div className="cockpit-card specular-top p-4 sm:p-6 shadow-md space-y-4 min-w-0 max-w-full overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/[0.08] pb-4 gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 min-w-0">
                      <CheckCheck className="h-4 w-4 text-[#F5C518] shrink-0" />
                      <span className="truncate">Retest & Verification Timeline</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Mandatory verification audits and retests required before closing security findings.
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsVerifyOpen(true)}
                    className="text-xs h-8 gap-1.5 font-bold shrink-0 self-start sm:self-auto"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>+ Add Verification</span>
                  </Button>
                </div>

                {finding.verifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-white/[0.08] rounded-xl bg-white/[0.01] space-y-2">
                    <p>No verification retests have been recorded yet.</p>
                    <p className="text-[11px] text-slate-400">
                      Once engineering deploys a fix, execute an automated rescan or record manual verification to verify resolution.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 min-w-0">
                    {finding.verifications.map((v) => (
                      <div
                        key={v.id}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all min-w-0 ${
                          v.result === "passed"
                            ? "bg-emerald-950/10 border-emerald-500/25"
                            : "bg-rose-950/10 border-rose-500/25"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 sm:gap-4 min-w-0">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {v.result === "passed" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                                  <span>Passed (Fixed)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                  <XCircle className="h-3.5 w-3.5 text-rose-400" />
                                  <span>Failed (Unresolved)</span>
                                </span>
                              )}

                              <span className="text-slate-400 font-mono text-[11px] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]">
                                Method: {v.verification_method.replace("_", " ")}
                              </span>
                            </div>

                            {v.notes && (
                              <p className="text-xs text-slate-200 mt-1 leading-relaxed break-words">
                                {v.notes}
                              </p>
                            )}

                            <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                              <User className="h-3 w-3 text-slate-500" />
                              <span>Audited by <strong>{v.verified_by}</strong></span>
                            </div>
                          </div>

                          <div
                            className="text-[11px] text-slate-400 font-mono shrink-0"
                            suppressHydrationWarning
                          >
                            {formatDateTime(v.verified_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        <VerificationModal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          onVerified={fetchFinding}
          finding={finding}
        />

        <FindingFormModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSaved={fetchFinding}
          findingToEdit={finding}
        />
      </div>
    </AppShell>
  );
}
