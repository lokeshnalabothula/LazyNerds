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
  Edit2,
  Loader2,
  Calendar,
  User,
  CheckCheck,
} from "lucide-react";

export default function FindingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const findingId = params?.findingId as string;

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

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

  return (
    <AppShell title="Vulnerability Finding Details">
      <div className="space-y-6 max-w-5xl">
        <Link
          href="/findings"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Findings</span>
        </Link>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500 mr-2" />
            <span className="text-xs font-mono">Loading finding record...</span>
          </div>
        ) : error || !finding ? (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error || "Finding not found."}
          </div>
        ) : (
          <div data-loading-state="complete" className="space-y-6">
            {/* Header Card */}
            <div className="cockpit-card specular-top p-6 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-mono uppercase font-bold border ${
                        finding.severity === "critical"
                          ? "bg-rose-500/10 text-[#F43F5E] border-rose-500/30"
                          : finding.severity === "high"
                          ? "bg-orange-500/10 text-[#FB923C] border-orange-500/30"
                          : finding.severity === "medium"
                          ? "bg-amber-500/10 text-[#FBBF24] border-amber-500/30"
                          : "bg-blue-500/10 text-[#60A5FA] border-blue-500/30"
                      }`}
                    >
                      {finding.severity}
                    </span>

                    {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-[#161920] text-zinc-700 dark:text-[#FFD84D] font-bold border border-zinc-200 dark:border-[#222630]">
                        CVSS {finding.cvss_score}
                      </span>
                    )}

                    {finding.cve_id && (
                      <span className="px-2.5 py-0.5 rounded text-[11px] font-mono bg-[#F5C518]/10 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30 font-semibold">
                        {finding.cve_id}
                      </span>
                    )}

                    <span
                      className={`px-2.5 py-0.5 rounded text-[11px] font-medium capitalize border ${
                        finding.status === "verified_fixed"
                          ? "bg-emerald-500/10 text-[#34D399] border-emerald-500/30"
                          : finding.status === "in_remediation"
                          ? "bg-amber-500/10 text-[#FBBF24] border-amber-500/30"
                          : "bg-zinc-100 dark:bg-[#161920] text-zinc-600 dark:text-[#9CA3AF] border-zinc-200 dark:border-[#222630]"
                      }`}
                    >
                      {finding.status.replace("_", " ")}
                    </span>
                  </div>

                  <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-[#F9FAFB] font-sans">
                    {finding.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-[#9CA3AF]">
                    <div>
                      <span className="text-zinc-400 dark:text-[#6B7280]">Engagement: </span>
                      <span className="font-semibold text-zinc-800 dark:text-[#F9FAFB]">
                        {finding.engagement_name || "Linked Engagement"}
                      </span>
                    </div>
                    {finding.asset_name && (
                      <div>
                        <span className="text-zinc-400 dark:text-[#6B7280]">Target Asset: </span>
                        <span className="font-mono text-zinc-800 dark:text-[#F9FAFB]">
                          {finding.asset_name}
                        </span>
                      </div>
                    )}
                    {finding.assigned_to && (
                      <div>
                        <span className="text-zinc-400 dark:text-[#6B7280]">Assigned To: </span>
                        <span className="text-zinc-800 dark:text-[#F9FAFB]">
                          {finding.assigned_to}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsVerifyOpen(true)}
                    className="text-xs h-9 gap-1.5"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Record Verification</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditOpen(true)}
                    className="text-xs h-9 gap-1.5"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </Button>
                </div>
              </div>
            </div>

            {/* Description, Impact & Remediation Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="cockpit-card specular-top p-5 shadow-md space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                    Vulnerability Description
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.description || "No detailed technical description provided."}
                  </p>
                </div>

                <div className="cockpit-card specular-top p-5 shadow-md space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                    Business & Technical Impact
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.impact || "Threat vectors and business risk impact not documented."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="cockpit-card specular-top p-5 shadow-md space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                    Remediation Recommendation
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.remediation_guidance || "No formal engineering remediation guidance attached."}
                  </p>
                </div>

                {finding.evidence && (
                  <div className="cockpit-card specular-top p-5 shadow-md space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF] font-mono">
                        Replication Evidence / PoC
                      </h3>
                      <button
                        onClick={() => {
                          if (finding.evidence) {
                            navigator.clipboard.writeText(finding.evidence);
                          }
                        }}
                        className="text-[11px] font-mono text-[#F5C518] hover:underline flex items-center gap-1"
                      >
                        Copy Evidence
                      </button>
                    </div>
                    <pre className="p-3.5 rounded-lg bg-zinc-950 font-mono text-[11px] text-[#F9FAFB] border border-[#222630] overflow-x-auto whitespace-pre-wrap">
                      {finding.evidence}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Verification History Timeline (Module E) */}
            <div className="cockpit-card specular-top p-6 shadow-md space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-[#222630] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB] font-sans">
                    Retest & Verification Chain of Custody
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-0.5">
                    Documented retests and verification audits required before closing vulnerabilities.
                  </p>
                </div>
                <button
                  onClick={() => setIsVerifyOpen(true)}
                  className="text-xs text-[#F5C518] hover:underline font-semibold"
                >
                  + Add Verification
                </button>
              </div>

              {finding.verifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 dark:text-[#6B7280] border border-dashed border-zinc-200 dark:border-[#222630] rounded-lg">
                  No verification retests have been executed yet. Vulnerability remains open or in remediation.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-[#222630]">
                  {finding.verifications.map((v) => (
                    <div key={v.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {v.result === "passed" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-[#34D399]">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Passed (Fixed)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-[#F43F5E]">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Failed (Unresolved)</span>
                            </span>
                          )}
                          <span className="text-zinc-400 dark:text-[#6B7280] font-mono text-[10px]">
                            via {v.verification_method.replace("_", " ")}
                          </span>
                        </div>
                        {v.notes && (
                          <p className="text-zinc-600 dark:text-zinc-300 text-xs">
                            {v.notes}
                          </p>
                        )}
                        <div className="text-[10px] text-zinc-400 dark:text-[#6B7280]">
                          Audited by {v.verified_by}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono shrink-0" suppressHydrationWarning>
                        {formatDateTime(v.verified_at)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

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
