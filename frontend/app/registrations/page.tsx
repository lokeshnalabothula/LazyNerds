"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TimeDisplay } from "@/components/ui/time-display";
import { FixOpsAppLoader } from "@/components/ui/loading";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { RegistrationOut, RegistrationStatus } from "@/types/registration";
import { User } from "@/types/client";
import {
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Building2,
  Mail,
  Phone,
  Globe,
  Shield,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
} from "lucide-react";

function RegistrationsContent() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationOut[]>([]);
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Review Modals state
  const [selectedReg, setSelectedReg] = useState<RegistrationOut | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "request_info" | null>(null);
  const [reviewReason, setReviewReason] = useState<string>("");
  const [assignedEmployeeId, setAssignedEmployeeId] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchRegistrations = useCallback(async () => {
    try {
      const data = await api.getRegistrations(statusFilter === "all" ? undefined : statusFilter);
      setRegistrations(data.items);
    } catch (err: any) {
      setError(err.message || "Failed to load client registration requests.");
    }
  }, [statusFilter]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchRegistrations();
      if (user?.role === "founder") {
        try {
          const staff = await api.getUsers("employee");
          setEmployees(staff);
        } catch {
          // Non-critical if employees fail to load
        }
      }
    } finally {
      setLoading(false);
    }
  }, [fetchRegistrations, user?.role]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchRegistrations();
    } finally {
      setRefreshing(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReg || !reviewAction) return;

    setActionLoading(true);
    setActionFeedback(null);
    try {
      const updated = await api.reviewRegistration(selectedReg.id, {
        action: reviewAction,
        reason: reviewReason.trim() || undefined,
        assign_employee_id: reviewAction === "approve" && assignedEmployeeId ? assignedEmployeeId : undefined,
      });

      setActionFeedback({
        type: "success",
        text:
          reviewAction === "approve"
            ? `Successfully approved ${updated.company_name}! The client and user account are now active.`
            : reviewAction === "reject"
            ? `Registration for ${updated.company_name} rejected.`
            : `Information request noted for ${updated.company_name}.`,
      });

      // Close modal after brief delay & refresh
      setTimeout(() => {
        setSelectedReg(null);
        setReviewAction(null);
        setReviewReason("");
        setAssignedEmployeeId("");
        setActionFeedback(null);
        fetchRegistrations();
      }, 1200);
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        text: err.message || "Failed to process registration review.",
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Restrict to Founder
  if (user && user.role !== "founder") {
    return (
      <AppShell title="Access Restricted">
        <div className="p-8 max-w-lg mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-zinc-100">Restricted to Founders</h2>
          <p className="text-xs text-zinc-400">
            Only the organization founder can review, approve, or reject new client self-registrations and manage employee assignments.
          </p>
          <div className="pt-2">
            <Link href="/overview" className="text-xs text-[#F5C518] hover:underline font-semibold">
              Return to Operations Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Filter items by client-side search query
  const filteredItems = registrations.filter((reg) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      reg.company_name.toLowerCase().includes(q) ||
      reg.email.toLowerCase().includes(q) ||
      reg.full_name.toLowerCase().includes(q) ||
      (reg.primary_domains && reg.primary_domains.toLowerCase().includes(q))
    );
  });

  const pendingCount = registrations.filter((r) => r.status === "pending").length;

  return (
    <AppShell title="Client Registrations">
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200 dark:border-[#222630] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-[#F9FAFB] font-mono tracking-tight">
                CLIENT REGISTRATION QUEUE
              </h1>
              {pendingCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#F5C518]/20 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30">
                  {pendingCount} PENDING
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
              Review, verify scope, approve tenant workspaces, and assign operational security engineers.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-xs h-9 border-zinc-200 dark:border-[#222630] dark:bg-[#161920]"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </Button>
            <Link href="/clients">
              <Button variant="outline" size="sm" className="text-xs h-9 border-zinc-200 dark:border-[#222630] dark:bg-[#161920]">
                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                <span>Client Directory</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-[#111318] border border-zinc-200 dark:border-[#222630] text-xs overflow-x-auto">
            {[
              { id: "pending", label: "Pending Review" },
              { id: "all", label: "All Submissions" },
              { id: "approved", label: "Approved" },
              { id: "needs_information", label: "Needs Info" },
              { id: "rejected", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.id
                    ? "bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] shadow-xs font-semibold border border-zinc-200/80 dark:border-[#222630]"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search registrations…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-white dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#9CA3AF]/60 focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518]"
            />
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
            <span>{error}</span>
            <button onClick={loadData} className="underline text-xs">
              Retry
            </button>
          </div>
        )}

        {/* Content List */}
        {loading ? (
          <FixOpsAppLoader
            label="LOADING REGISTRATIONS"
            subtext="Retrieving isolated onboarding requests…"
          />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto">
              <UserCheck className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No registrations found
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
              {statusFilter === "pending"
                ? "There are no pending client registration requests in the queue."
                : `No registrations found matching the '${statusFilter}' status filter.`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((reg) => (
              <div
                key={reg.id}
                className="cockpit-card cockpit-card-interactive specular-top p-5 shadow-md space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-[#F9FAFB] font-mono">
                        {reg.company_name}
                      </h3>
                      {reg.status === "pending" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20 font-mono">
                          Pending Review
                        </span>
                      )}
                      {reg.status === "approved" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                          Approved
                        </span>
                      )}
                      {reg.status === "needs_information" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                          Needs Information
                        </span>
                      )}
                      {reg.status === "rejected" && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-[#9CA3AF] flex-wrap">
                      <span>Submitted <TimeDisplay value={reg.created_at} mode="relative" /></span>
                      <span>•</span>
                      <span>{reg.industry || "General Industry"}</span>
                      {reg.country && (
                        <>
                          <span>•</span>
                          <span>{reg.country}</span>
                        </>
                      )}
                      {reg.website && (
                        <>
                          <span>•</span>
                          <a
                            href={reg.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#B88700] dark:text-[#FFD84D] hover:underline inline-flex items-center gap-1 font-mono"
                          >
                            <span>Website</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {reg.status !== "approved" && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedReg(reg);
                          setReviewAction("approve");
                        }}
                        className="h-8 text-xs font-bold"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        <span>Approve</span>
                      </Button>
                    )}
                    {reg.status !== "needs_information" && reg.status !== "approved" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedReg(reg);
                          setReviewAction("request_info");
                        }}
                        className="h-8 text-xs text-amber-400 hover:text-amber-300 border-zinc-200 dark:border-[#222630] dark:bg-[#161920]"
                      >
                        <HelpCircle className="h-3.5 w-3.5 mr-1.5" />
                        <span>Request Info</span>
                      </Button>
                    )}
                    {reg.status !== "rejected" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedReg(reg);
                          setReviewAction("reject");
                        }}
                        className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        <span>Reject</span>
                      </Button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] text-xs">
                  {/* Contact Info */}
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 dark:text-[#9CA3AF]">
                      Primary Contact
                    </span>
                    <p className="font-semibold text-zinc-900 dark:text-[#F9FAFB]">{reg.full_name}</p>
                    <p className="text-zinc-500 dark:text-[#9CA3AF] font-mono text-[11px]">{reg.email}</p>
                    {reg.job_title && <p className="text-zinc-500 dark:text-[#9CA3AF]">{reg.job_title}</p>}
                    {reg.phone && <p className="text-zinc-500 dark:text-[#9CA3AF] font-mono text-[11px]">{reg.phone}</p>}
                  </div>

                  {/* Scope & Domains */}
                  <div className="space-y-1 md:col-span-2">
                    <span className="text-[10px] uppercase font-mono font-semibold text-zinc-400 dark:text-[#9CA3AF]">
                      Scope & Requested Services
                    </span>
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                      {reg.requested_services || "FixOps Automated Vulnerability Management"}
                    </p>
                    {reg.primary_domains && (
                      <p className="text-zinc-500 dark:text-[#9CA3AF] font-mono text-[11px]">
                        Target Domains: {reg.primary_domains}
                      </p>
                    )}
                    {reg.scope_description && (
                      <p className="text-zinc-500 dark:text-[#9CA3AF] italic">
                        &quot;{reg.scope_description}&quot;
                      </p>
                    )}
                  </div>
                </div>

                {/* Review Notes or Rejection History */}
                {(reg.review_notes || reg.rejection_reason) && (
                  <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-[#161920]/60 border border-zinc-200 dark:border-[#222630] text-[11px] text-zinc-600 dark:text-[#9CA3AF]">
                    {reg.review_notes && (
                      <p>
                        <strong className="text-zinc-700 dark:text-zinc-300">Review Notes:</strong>{" "}
                        {reg.review_notes}
                      </p>
                    )}
                    {reg.rejection_reason && (
                      <p className="text-rose-400">
                        <strong>Rejection Reason:</strong> {reg.rejection_reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Review Action Modal */}
        {selectedReg && reviewAction && (
          <Modal
            isOpen={true}
            onClose={() => {
              setSelectedReg(null);
              setReviewAction(null);
              setReviewReason("");
              setActionFeedback(null);
            }}
            title={
              reviewAction === "approve"
                ? `Approve Registration: ${selectedReg.company_name}`
                : reviewAction === "reject"
                ? `Reject Registration: ${selectedReg.company_name}`
                : `Request Info: ${selectedReg.company_name}`
            }
          >
            <form onSubmit={handleReviewSubmit} className="space-y-4 pt-2">
              {actionFeedback && (
                <div
                  className={`p-3 rounded text-xs flex items-start gap-2 ${
                    actionFeedback.type === "success"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                  }`}
                >
                  {actionFeedback.type === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{actionFeedback.text}</span>
                </div>
              )}

              {reviewAction === "approve" && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Approving will automatically activate a tenant profile in the Client Directory and enable login credentials for{" "}
                    <span className="font-semibold text-zinc-200">{selectedReg.email}</span>.
                  </p>

                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Assign Lead Security Engineer (Optional)
                    </label>
                    <select
                      value={assignedEmployeeId}
                      onChange={(e) => setAssignedEmployeeId(e.target.value)}
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="">No employee assigned (Founder oversight)</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      The assigned employee will have operational visibility over this client&apos;s assets and findings.
                    </p>
                  </div>
                </div>
              )}

              {reviewAction === "reject" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Rejection Reason
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Explain why this onboarding request does not meet current criteria..."
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}

              {reviewAction === "request_info" && (
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                    Information Required from Applicant
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Detail the target domains, legal authorization, or verification steps needed..."
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-[#F5C518] focus:ring-1 focus:ring-[#F5C518]"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedReg(null);
                    setReviewAction(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant={reviewAction === "reject" ? "destructive" : "primary"}
                  size="sm"
                  isLoading={actionLoading}
                  className="text-xs font-bold"
                >
                  Confirm {reviewAction === "approve" ? "Approval" : reviewAction === "reject" ? "Rejection" : "Request"}
                </Button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    </AppShell>
  );
}

export default function RegistrationsPage() {
  return (
    <Suspense
      fallback={
        <FixOpsAppLoader
          label="INITIALIZING REGISTRATIONS WORKSPACE"
          subtext="Loading secure founder queue…"
        />
      }
    >
      <RegistrationsContent />
    </Suspense>
  );
}
