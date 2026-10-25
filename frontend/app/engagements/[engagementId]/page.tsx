"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Engagement,
  ENGAGEMENT_STATUS_CONFIG,
  AUTHORIZATION_STATUS_CONFIG,
  EngagementStatus,
  AuthorizationStatus,
} from "@/types/engagement";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  Edit2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Layers,
  FileText,
  Archive,
  RotateCcw,
  Terminal,
} from "lucide-react";
import { ScanLauncherModal } from "@/components/findings/scan-launcher-modal";
import { ScanTelemetryModal } from "@/components/findings/scan-telemetry-modal";
import { Assessment } from "@/types/finding";

interface EngagementPageProps {
  params: Promise<{ engagementId: string }>;
}

export default function EngagementDetailPage({ params }: EngagementPageProps) {
  const resolvedParams = use(params);
  const engagementId = resolvedParams.engagementId;
  const router = useRouter();
  const { toast } = useToast();

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [isLauncherOpen, setIsLauncherOpen] = useState(false);
  const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
  const [telemetryAssessmentId, setTelemetryAssessmentId] = useState<string | null>(null);

  const fetchEngagement = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getEngagementById(engagementId);
      setEngagement(data);
    } catch (err: any) {
      if (err.status === 404) {
        setError("This engagement could not be found.");
      } else {
        setError(err.message || "Failed to load engagement record from server.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEngagement();
  }, [engagementId]);

  const handleArchive = async () => {
    if (!engagement) return;
    setActionLoading(true);
    try {
      const updated = await api.archiveEngagement(engagement.id);
      setEngagement(updated);
      setIsCancelConfirmOpen(false);
      toast.success(`Engagement '${engagement.name}' has been archived.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel engagement.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!engagement) return;
    setActionLoading(true);
    try {
      const updated = await api.restoreEngagement(engagement.id);
      setEngagement(updated);
      toast.success(`Engagement '${engagement.name}' reopened as active.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reopen engagement.");
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Engagement Profile">
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <span className="text-xs font-mono">Fetching engagement workspace from database...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !engagement) {
    return (
      <AppShell title="Engagement Not Found">
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {error || "Engagement Not Found"}
            </h2>
            <p className="text-xs text-zinc-500">
              The requested security engagement record may have been permanently removed or the identifier is invalid.
            </p>
          </div>
          <Link href="/engagements">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Return to Engagements Directory
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const statusCfg =
    ENGAGEMENT_STATUS_CONFIG[engagement.status as EngagementStatus] ||
    ENGAGEMENT_STATUS_CONFIG.draft;
  const authCfg =
    AUTHORIZATION_STATUS_CONFIG[engagement.authorization_status as AuthorizationStatus] ||
    AUTHORIZATION_STATUS_CONFIG.not_confirmed;

  return (
    <AppShell title={`${engagement.name} — Workspace`}>
      <div className="space-y-6 max-w-5xl">
        {/* Navigation Breadcrumb and Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/engagements"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Engagements Directory</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsLauncherOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Terminal className="h-3.5 w-3.5" />
              <span>Launch Scan</span>
            </Button>
            <Link href={`/engagements/${engagement.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Engagement</span>
              </Button>
            </Link>
            {engagement.status === "cancelled" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                disabled={actionLoading}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reopen to Draft</span>
              </Button>
            ) : engagement.status !== "completed" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCancelConfirmOpen(true)}
                disabled={actionLoading}
                className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Cancel / Archive</span>
              </Button>
            ) : null}
          </div>
        </div>
        {/* Header Hero Card */}
        <div className="cockpit-card specular-top p-6 shadow-md space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                  {statusCfg.label}
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded border ${authCfg.badgeClass}`}
                >
                  <Shield className="h-3.5 w-3.5 shrink-0" />
                  {authCfg.label}
                </span>

                <Badge variant="neutral" size="sm">
                  {engagement.assessment_type}
                </Badge>
              </div>

              <h1 className="text-xl font-bold text-zinc-900 dark:text-[#F9FAFB]">
                {engagement.name}
              </h1>

              <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-[#9CA3AF]">
                <Building2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                <span>Client Organization:</span>
                <Link
                  href={`/clients/${engagement.client_id}`}
                  className="font-semibold text-[#B88700] dark:text-[#FFD84D] hover:underline inline-flex items-center gap-1"
                >
                  {engagement.client_company_name || "Client Record"}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-100 dark:border-[#222630] text-xs shrink-0 min-w-[240px]">
              <div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Scheduled Start</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {engagement.start_date ? formatDate(engagement.start_date) : "Unset"}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Target Due Date</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {engagement.due_date ? formatDate(engagement.due_date) : "Unset"}
                </span>
              </div>
              <div className="col-span-2 pt-2 border-t border-zinc-200/60 dark:border-[#222630]">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Assigned Assessor</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200 truncate block">
                  {engagement.assigned_to || "Unassigned"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Columns */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info (Left 2 Columns) */}
          <div className="md:col-span-2 space-y-6">
            {/* Scope Summary */}
            <div className="cockpit-card specular-top p-5 shadow-md space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-[#F5C518]" />
                Authorized Target Scope
              </h3>
              {engagement.scope_summary ? (
                <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#08090b] border border-zinc-100 dark:border-[#222630] font-mono text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {engagement.scope_summary}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                  No specific target scope recorded. Edit this engagement to add in-scope endpoints, URLs, or CIDR blocks.
                </p>
              )}
            </div>

            {/* Description / Rules of Engagement */}
            <div className="cockpit-card specular-top p-5 shadow-md space-y-3">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#F5C518]" />
                Narrative & Context Notes
              </h3>
              {engagement.description ? (
                <div className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {engagement.description}
                </div>
              ) : (
                <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">
                  No description provided for this engagement.
                </p>
              )}
            </div>

            {/* Associated Security Operations */}
            <div className="cockpit-card specular-top p-5 shadow-md space-y-4">
              <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#F5C518]" />
                Associated Security Operations
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Link
                  href={`/assets?clientId=${engagement.client_id}`}
                  className="p-3.5 rounded-lg border border-zinc-200 dark:border-[#222630] hover:border-[#F5C518]/50 hover:bg-zinc-50 dark:hover:bg-[#161920] transition-colors group block"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] mb-1">
                    <span>Target Assets</span>
                    <ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-[#F5C518]" />
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                    Scoped hosts, web targets, and CIDR ranges.
                  </p>
                </Link>

                <Link
                  href={`/findings?engagementId=${engagement.id}`}
                  className="p-3.5 rounded-lg border border-zinc-200 dark:border-[#222630] hover:border-[#F5C518]/50 hover:bg-zinc-50 dark:hover:bg-[#161920] transition-colors group block"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] mb-1">
                    <span>Vulnerability Findings</span>
                    <ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-[#F5C518]" />
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                    Security findings and verified fixes for this engagement.
                  </p>
                </Link>

                <Link
                  href={`/reports?engagementId=${engagement.id}`}
                  className="p-3.5 rounded-lg border border-zinc-200 dark:border-[#222630] hover:border-[#F5C518]/50 hover:bg-zinc-50 dark:hover:bg-[#161920] transition-colors group block"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] mb-1">
                    <span>Executive Reports</span>
                    <ExternalLink className="h-3 w-3 text-zinc-400 group-hover:text-[#F5C518]" />
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                    Generated compliance, summary, and technical reports.
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => setIsLauncherOpen(true)}
                  className="p-3.5 rounded-lg border border-zinc-200 dark:border-[#222630] hover:border-[#F5C518]/50 hover:bg-zinc-50 dark:hover:bg-[#161920] transition-colors group block text-left w-full cursor-pointer"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] mb-1">
                    <span>Autonomous Scans</span>
                    <Terminal className="h-3 w-3 text-zinc-400 group-hover:text-[#F5C518]" />
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                    Launch Shannon AI pentest or blackbox vulnerability scan.
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar Metadata (Right Column) */}
          <div className="space-y-6">
            {/* Associated Client Profile Card */}
            <div className="cockpit-card specular-top p-5 shadow-md space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                Client Workspace
              </h4>
              <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-100 dark:border-[#222630] space-y-2 text-xs">
                <div className="font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                  {engagement.client_company_name || "Client Organization"}
                </div>
                <div className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500 break-all">
                  UUID: {engagement.client_id}
                </div>
                <div className="pt-2 border-t border-zinc-200/60 dark:border-[#222630]">
                  <Link
                    href={`/clients/${engagement.client_id}`}
                    className="text-xs font-semibold text-[#B88700] dark:text-[#FFD84D] hover:underline inline-flex items-center gap-1"
                  >
                    <span>Open full client profile</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Audit & Compliance Timestamps */}
            <div className="rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] p-5 shadow-xs space-y-3">
              <h4 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                Immutable Audit Trail
              </h4>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Created</span>
                  <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300" suppressHydrationWarning>
                    {formatDateTime(engagement.created_at)}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-100 dark:border-[#222630]">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Last Modified</span>
                  <span className="font-mono text-[11px] text-zinc-700 dark:text-zinc-300" suppressHydrationWarning>
                    {formatDateTime(engagement.updated_at)}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-100 dark:border-[#222630]">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 block font-medium">Engagement UUID</span>
                  <span className="font-mono text-[10px] text-zinc-500 break-all">
                    {engagement.id}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ScanLauncherModal
        isOpen={isLauncherOpen}
        onClose={() => setIsLauncherOpen(false)}
        defaultEngagementId={engagement.id}
        onScanLaunched={(assessment) => {
          setTelemetryAssessmentId(assessment.id);
          setIsTelemetryOpen(true);
        }}
      />

      <ScanTelemetryModal
        isOpen={isTelemetryOpen}
        onClose={() => {
          setIsTelemetryOpen(false);
          fetchEngagement();
        }}
        assessmentId={telemetryAssessmentId}
        onViewFindings={(id) => {
          setIsTelemetryOpen(false);
          router.push(`/findings?engagementId=${engagement.id}`);
        }}
      />

      <ConfirmDialog
        isOpen={isCancelConfirmOpen}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={handleArchive}
        title="Cancel & Archive Engagement"
        description={`Are you sure you want to cancel and archive '${engagement.name}'? All testing activities will be paused. This record can be reopened at any time.`}
        confirmLabel="Cancel Engagement"
        variant="destructive"
        loading={actionLoading}
      />
    </AppShell>
  );
}
