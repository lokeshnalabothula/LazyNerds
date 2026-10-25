"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArchiveDialog } from "@/components/clients/archive-dialog";
import { ClientEngagementsTab } from "@/components/clients/client-engagements-tab";
import { ClientAssetsTab } from "@/components/clients/client-assets-tab";
import { ClientFindingsTab } from "@/components/clients/client-findings-tab";
import { ClientReportsTab } from "@/components/clients/client-reports-tab";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { Client } from "@/types/client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/utils";
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  Globe,
  Calendar,
  Clock,
  Edit2,
  Archive,
  RotateCcw,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  FileText,
  Layers,
  Shield,
  Bug,
} from "lucide-react";

interface ClientPageProps {
  params: Promise<{ clientId: string }>;
}

export default function ClientProfilePage({ params }: ClientPageProps) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.clientId;
  const router = useRouter();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "contacts" | "engagements" | "assets" | "findings" | "reports"
  >("overview");

  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);

  const fetchClient = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getClientById(clientId);
      setClient(data);
    } catch (err: any) {
      if (err.status === 404) {
        setError("This client could not be found.");
      } else {
        setError(err.message || "Failed to load client workspace.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClient();
  }, [clientId]);

  const handleArchiveConfirm = async (c: Client) => {
    try {
      const updated = await api.archiveClient(c.id);
      setClient(updated);
      setIsArchiveDialogOpen(false);
      toast.success(`Client organization '${c.company_name}' archived.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to archive client.");
    }
  };

  const handleRestore = async () => {
    if (!client) return;
    try {
      const updated = await api.restoreClient(client.id);
      setClient(updated);
      toast.success(`Client organization '${client.company_name}' restored to active status.`);
    } catch (err: any) {
      toast.error(err.message || "Could not restore client.");
    }
  };

  if (isLoading) {
    return (
      <AppShell title="Client Profile">
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <span className="text-xs font-mono">Loading client workspace…</span>
        </div>
      </AppShell>
    );
  }

  if (error || !client) {
    return (
      <AppShell title="Client Not Found">
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {error === "This client could not be found."
                ? "Client Record Not Found"
                : "Unable to Load Client"}
            </h2>
            <p className="text-xs text-zinc-500 leading-relaxed">
              {error || "The requested client ID does not exist in the database or may have been permanently purged."}
            </p>
          </div>
          <div className="pt-2">
            <Link href="/clients">
              <Button size="sm" variant="outline" className="gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Return to Directory</span>
              </Button>
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`${client.company_name} — Workspace`}>
      <div data-loading-state="complete" className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Client Directory</span>
          </Link>
        </div>

        {/* Profile Header */}
        <div className="cockpit-card specular-top p-6 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-sans">
                {client.company_name}
              </h1>
              <Badge variant={client.status === "active" ? "active" : "archived"}>
                {client.status === "active" ? "Active Client" : "Archived Client"}
              </Badge>
              {client.industry && (
                <span className="text-xs text-zinc-500 dark:text-[#9CA3AF] px-2 py-0.5 rounded border border-zinc-200 dark:border-[#222630] font-mono">
                  {client.industry}
                </span>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-[#9CA3AF] flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-400 dark:text-[#6B7280]">Primary Contact:</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {client.primary_contact_name}
                </span>
              </div>
              <span>•</span>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <Mail className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280]" />
                <a
                  href={`mailto:${client.primary_contact_email}`}
                  className="hover:text-[#F5C518] underline-offset-2 hover:underline"
                >
                  {client.primary_contact_email}
                </a>
              </div>
              {client.website && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <Globe className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280]" />
                    <a
                      href={client.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#F5C518] underline-offset-2 hover:underline flex items-center gap-0.5"
                    >
                      <span>Website</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {client.status === "active" && (
              <Link href={`/engagements/new?client_id=${client.id}`}>
                <Button variant="primary" size="sm" className="gap-1.5 text-xs">
                  <Shield className="h-3.5 w-3.5" />
                  <span>New Engagement</span>
                </Button>
              </Link>
            )}

            <Link href={`/clients/${client.id}/edit`}>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Edit2 className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </Button>
            </Link>

            {client.status === "active" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveDialogOpen(true)}
                className="gap-1.5 text-xs text-zinc-600 dark:text-[#9CA3AF] hover:text-rose-600 dark:hover:text-rose-400"
              >
                <Archive className="h-3.5 w-3.5" />
                <span>Archive</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestore}
                className="gap-1.5 text-xs text-emerald-600 dark:text-emerald-400"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restore</span>
              </Button>
            )}
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="border-b border-zinc-200 dark:border-[#222630] flex items-center gap-4 sm:gap-6 text-xs font-medium select-none overflow-x-auto pb-px">
          <button
            onClick={() => setActiveTab("overview")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "overview"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab("contacts")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "contacts"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <Mail className="h-3.5 w-3.5" />
            <span>Company & Contacts</span>
          </button>

          <button
            onClick={() => setActiveTab("engagements")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "engagements"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Engagements</span>
          </button>

          <button
            onClick={() => setActiveTab("assets")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "assets"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Assets & Scope</span>
          </button>

          <button
            onClick={() => setActiveTab("findings")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "findings"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <Bug className="h-3.5 w-3.5" />
            <span>Findings</span>
          </button>

          <button
            onClick={() => setActiveTab("reports")}
            className={`pb-3 border-b-2 transition-colors flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] ${
              activeTab === "reports"
                ? "border-[#F5C518] text-zinc-900 dark:text-[#F9FAFB] font-semibold"
                : "border-transparent text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Reports & Evidence</span>
          </button>
        </div>

        {/* Tab Content Panes */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 cols: Organization Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <div className="cockpit-card specular-top p-5 shadow-md space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-[#9CA3AF] font-mono">
                  Organization Summary
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Official Entity Name</span>
                    <span className="font-medium text-zinc-800 dark:text-[#F9FAFB] text-sm">
                      {client.company_name}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Industry Sector</span>
                    <span className="font-medium text-zinc-800 dark:text-[#F9FAFB]">
                      {client.industry || "Not specified"}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Primary Contact Person</span>
                    <span className="font-medium text-zinc-800 dark:text-[#F9FAFB]">
                      {client.primary_contact_name}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Contact Email Address</span>
                    <span className="font-mono text-zinc-800 dark:text-[#F9FAFB]">
                      {client.primary_contact_email}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Telephone</span>
                    <span className="font-medium text-zinc-800 dark:text-[#F9FAFB]">
                      {client.phone || "Not specified"}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 dark:text-[#6B7280] block text-[11px]">Official Web Address</span>
                    {client.website ? (
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#F5C518] hover:underline flex items-center gap-1 font-mono"
                      >
                        <span>{client.website}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-zinc-400 dark:text-[#6B7280] font-mono">Not specified</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Internal Notes Card */}
              <div className="cockpit-card specular-top p-5 shadow-md space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-[#9CA3AF] font-mono">
                  Internal Engagement Notes
                </h3>
                {client.notes ? (
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans bg-zinc-50 dark:bg-[#161920]/60 p-4 rounded-lg border border-zinc-100 dark:border-[#222630]">
                    {client.notes}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-400 dark:text-[#6B7280] italic">
                    No internal engagement notes recorded for this organization.
                  </p>
                )}
              </div>
            </div>

            {/* Right 1 col: System Metadata & Future Readiness */}
            <div className="space-y-6">
              <div className="cockpit-card specular-top p-5 shadow-md space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-[#9CA3AF] font-mono">
                  Audit & Record Metadata
                </h3>

                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-zinc-400 block text-[11px]">System Record UUID</span>
                    <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400 break-all select-all">
                      {client.id}
                    </span>
                  </div>

                  <div>
                    <span className="text-zinc-400 block text-[11px]">Registration Date</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>
                        {formatDateTime(client.created_at)}
                      </span>
                      {formatRelativeTime(client.created_at) && (
                        <span className="text-[10px] text-zinc-400 font-sans" suppressHydrationWarning>
                          ({formatRelativeTime(client.created_at)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block text-[11px]">Last Database Update</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>
                        {formatDateTime(client.updated_at)}
                      </span>
                      {formatRelativeTime(client.updated_at) && (
                        <span className="text-[10px] text-zinc-400 font-sans" suppressHydrationWarning>
                          ({formatRelativeTime(client.updated_at)})
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 block text-[11px]">Client Status</span>
                    <Badge variant={client.status === "active" ? "active" : "archived"}>
                      {client.status === "active" ? "Active" : "Archived"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Engagement Status Notice */}
              <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-zinc-900 dark:text-zinc-100">
                  <ShieldCheck className="h-4 w-4 text-brand-500" />
                  <span>Platform Readiness</span>
                </div>
                <p className="text-zinc-500 leading-relaxed text-[11px]">
                  This client record serves as the foundational anchor for future cybersecurity engagements, asset scoping, vulnerability tracking, and compliance evidence.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "contacts" && (
          <div className="space-y-4 max-w-3xl">
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    Primary Security Contact
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Designated authorized personnel for engagement approvals and vulnerability notifications.
                  </p>
                </div>
                <Badge variant="neutral" size="sm">
                  Primary
                </Badge>
              </div>

              <div className="p-4 rounded border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-2 text-xs">
                <div className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                  {client.primary_contact_name}
                </div>
                <div className="flex items-center gap-4 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-zinc-400" />
                    {client.primary_contact_email}
                  </span>
                  {client.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-zinc-400" />
                      {client.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 rounded bg-zinc-100/60 dark:bg-zinc-800/40 text-[11px] text-zinc-500 font-mono leading-relaxed">
                NOTE: Single primary contact support is active for this release. Multiple organizational contacts and fine-grained roles will be enabled in upcoming updates.
              </div>
            </div>
          </div>
        )}

        {activeTab === "engagements" && (
          <ClientEngagementsTab client={client} />
        )}

        {activeTab === "assets" && (
          <ClientAssetsTab client={client} />
        )}

        {activeTab === "findings" && (
          <ClientFindingsTab client={client} />
        )}

        {activeTab === "reports" && (
          <ClientReportsTab client={client} />
        )}
      </div>

      {/* Archive Dialog */}
      <ArchiveDialog
        isOpen={isArchiveDialogOpen}
        client={client}
        onClose={() => setIsArchiveDialogOpen(false)}
        onConfirm={handleArchiveConfirm}
      />
    </AppShell>
  );
}
