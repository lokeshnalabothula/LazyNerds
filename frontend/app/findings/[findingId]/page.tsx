"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
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
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
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
          <div className="space-y-6">
            {/* Header Card */}
            <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase font-bold ${
                        finding.severity === "critical"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : finding.severity === "high"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                          : finding.severity === "medium"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {finding.severity}
                    </span>

                    {finding.cvss_score !== null && finding.cvss_score !== undefined && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                        CVSS {finding.cvss_score}
                      </span>
                    )}

                    {finding.cve_id && (
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 font-semibold">
                        {finding.cve_id}
                      </span>
                    )}

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        finding.status === "verified_fixed"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : finding.status === "in_remediation"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}
                    >
                      {finding.status.replace("_", " ")}
                    </span>
                  </div>

                  <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 font-mono">
                    {finding.title}
                  </h1>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                    <div>
                      <span>Engagement: </span>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {finding.engagement_name || "Linked Engagement"}
                      </span>
                    </div>
                    {finding.asset_name && (
                      <div>
                        <span>Target Asset: </span>
                        <span className="font-mono text-zinc-800 dark:text-zinc-200">
                          {finding.asset_name}
                        </span>
                      </div>
                    )}
                    {finding.assigned_to && (
                      <div>
                        <span>Assigned To: </span>
                        <span className="text-zinc-800 dark:text-zinc-200">
                          {finding.assigned_to}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsVerifyOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors shadow-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Record Verification</span>
                  </button>
                  <button
                    onClick={() => setIsEditOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Description, Impact & Remediation Guidance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Vulnerability Description
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.description || "No detailed technical description provided."}
                  </p>
                </div>

                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Business & Technical Impact
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.impact || "Threat vectors and business risk impact not documented."}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Remediation Recommendation
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {finding.remediation_guidance || "No formal engineering remediation guidance attached."}
                  </p>
                </div>

                {finding.evidence && (
                  <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Replication Evidence / PoC
                    </h3>
                    <pre className="p-3 rounded bg-zinc-100 dark:bg-zinc-950 font-mono text-[11px] text-zinc-800 dark:text-zinc-200 overflow-x-auto whitespace-pre-wrap">
                      {finding.evidence}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Verification History Timeline (Module E) */}
            <div className="p-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
                    Retest & Verification Timeline
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    Documented retests and verification audits required before closing vulnerabilities.
                  </p>
                </div>
                <button
                  onClick={() => setIsVerifyOpen(true)}
                  className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
                >
                  + Add Verification
                </button>
              </div>

              {finding.verifications.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded">
                  No verification retests have been executed yet. Vulnerability remains open or in remediation.
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {finding.verifications.map((v) => (
                    <div key={v.id} className="py-3 flex items-start justify-between gap-4 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {v.result === "passed" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Passed</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Failed</span>
                            </span>
                          )}
                          <span className="text-zinc-400 font-mono text-[10px]">
                            via {v.verification_method.replace("_", " ")}
                          </span>
                        </div>
                        {v.notes && (
                          <p className="text-zinc-600 dark:text-zinc-300 text-xs">
                            {v.notes}
                          </p>
                        )}
                        <div className="text-[10px] text-zinc-400">
                          Audited by {v.verified_by}
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono shrink-0">
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
