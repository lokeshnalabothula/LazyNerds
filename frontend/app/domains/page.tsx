"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useViewMode } from "@/lib/use-view-mode";
import { api } from "@/lib/api";
import { Domain, DomainVerificationStatus, DomainCreateResponse, DomainVerificationResult } from "@/types/domain";
import { DomainRegisterModal } from "@/components/domains/domain-register-modal";
import { DomainDnsInstructionsModal } from "@/components/domains/domain-dns-instructions-modal";
import { formatDate, formatRelativeTime } from "@/lib/utils";
import {
  Globe,
  Plus,
  Search,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  Trash2,
  FileCode2,
  CheckCircle2,
  Copy,
  Check,
  LayoutList,
  LayoutGrid,
  ExternalLink,
  Info,
} from "lucide-react";

export default function DomainsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { viewMode, setViewMode } = useViewMode("fixops-domains-view-mode", 1024);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | DomainVerificationStatus>("all");

  // Per-row action loading states
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modals
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [instructionsModalDomain, setInstructionsModalDomain] = useState<Domain | null>(null);
  const [instructionsActiveToken, setInstructionsActiveToken] = useState<string | null>(null);

  // Deletion confirm
  const [domainToDelete, setDomainToDelete] = useState<Domain | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch domains
  const loadDomains = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDomains({ page: 1, page_size: 100 });
      setDomains(res.items || []);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "Failed to load registered domains.";
      setError(msg);
      toast.error(msg, "Error Loading Domains");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadDomains();
  }, [loadDomains]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = domains.length;
    const verified = domains.filter((d) => d.verification_status === "verified").length;
    const pending = domains.filter((d) => d.verification_status === "pending").length;
    const failedOrExpired = domains.filter(
      (d) => d.verification_status === "failed" || d.verification_status === "expired"
    ).length;
    return { total, verified, pending, failedOrExpired };
  }, [domains]);

  // Filtered domains
  const filteredDomains = useMemo(() => {
    return domains.filter((d) => {
      const matchesSearch =
        d.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.normalized_domain.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || d.verification_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [domains, searchQuery, statusFilter]);

  // Copy helper
  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(text, "Copied to Clipboard");
    } catch {
      toast.error("Could not copy to clipboard.", "Copy Failed");
    }
  };

  // Direct Verify action
  const handleDirectVerify = async (domain: Domain) => {
    try {
      setVerifyingId(domain.id);
      const res: DomainVerificationResult = await api.verifyDomain(domain.id);

      // Update in state
      setDomains((prev) =>
        prev.map((item) => (item.id === domain.id ? res.domain : item))
      );

      if (res.verified && res.domain.verification_status === "verified") {
        toast.success(
          `Ownership of ${domain.normalized_domain} confirmed via DNS TXT.`,
          "Domain Verified Successfully"
        );
      } else {
        toast.error(
          res.message || res.domain.failure_reason || "TXT record not found or token mismatched.",
          "Verification Failed"
        );
      }
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "Failed to verify domain.";
      toast.error(msg, "Verification Request Error");
      // Refresh to update attempt count
      loadDomains();
    } finally {
      setVerifyingId(null);
    }
  };

  // Delete Domain action
  const confirmDeleteDomain = async () => {
    if (!domainToDelete) return;
    try {
      setIsDeleting(true);
      await api.deleteDomain(domainToDelete.id);
      setDomains((prev) => prev.filter((d) => d.id !== domainToDelete.id));
      toast.success(
        `${domainToDelete.normalized_domain} has been removed.`,
        "Domain Removed"
      );
      setDomainToDelete(null);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "Failed to delete domain.";
      toast.error(msg, "Delete Failed");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: DomainVerificationStatus) => {
    switch (status) {
      case "verified":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Pending DNS
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3.5 h-3.5" />
            Verification Failed
          </span>
        );
      case "expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-500/15 text-zinc-400 border border-zinc-500/30">
            <Clock className="w-3.5 h-3.5" />
            Challenge Expired
          </span>
        );
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-white/[0.08]">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 flex items-center justify-center shadow-xs">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Domain Ownership Verification
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-2xl">
              Prove administrative authority over your domains using cryptographic DNS TXT verification challenges (Method A).
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDomains}
              disabled={loading}
              className="border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.05]"
              title="Refresh domain list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>

            <div className="hidden sm:flex items-center p-0.5 rounded-lg border border-white/10 bg-white/[0.02]">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "table" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Table view"
              >
                <LayoutList className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "cards" ? "bg-white/15 text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
                title="Cards view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>

            <Button
              type="button"
              onClick={() => setIsRegisterModalOpen(true)}
              className="bg-white text-slate-900 hover:bg-slate-200 font-semibold text-xs sm:text-sm h-9 px-3.5 sm:px-4 shadow-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Register Domain
            </Button>
          </div>
        </div>

        {/* Telemetry Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl border border-white/[0.08] bg-[#0c0e14]/80 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium">
              <span>Total Domains</span>
              <Globe className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-white">{stats.total}</div>
            <p className="text-[11px] text-zinc-500">Registered scopes</p>
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium">
              <span>Verified Domains</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-300">{stats.verified}</div>
            <p className="text-[11px] text-emerald-500/80">Active cryptographic proof</p>
          </div>

          <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-950/10 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-amber-400 font-medium">
              <span>Pending DNS</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-amber-300">{stats.pending}</div>
            <p className="text-[11px] text-amber-500/80">Awaiting TXT record</p>
          </div>

          <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-950/10 backdrop-blur-sm space-y-1">
            <div className="flex items-center justify-between text-xs text-rose-400 font-medium">
              <span>Failed / Expired</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-rose-300">{stats.failedOrExpired}</div>
            <p className="text-[11px] text-rose-500/80">Action required</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              type="text"
              placeholder="Search domains by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-white/[0.03] border-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm h-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-400 hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-xl border border-white/[0.08] bg-white/[0.02]">
            {(
              [
                { label: "All", value: "all" },
                { label: "Verified", value: "verified" },
                { label: "Pending", value: "pending" },
                { label: "Failed", value: "failed" },
                { label: "Expired", value: "expired" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === tab.value
                    ? "bg-white/15 text-white font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        {loading ? (
          viewMode === "table" ? (
            <TableSkeleton rows={5} cols={6} />
          ) : (
            <CardGridSkeleton count={6} />
          )
        ) : error ? (
          <div className="p-8 text-center rounded-2xl border border-rose-500/20 bg-rose-950/15 space-y-3">
            <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
            <p className="text-sm text-rose-300 font-medium">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadDomains}
              className="border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
            >
              Retry
            </Button>
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-white/[0.08] bg-[#0c0e14]/50 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/10 text-zinc-400 flex items-center justify-center mx-auto">
              <Globe className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-white">
                {searchQuery || statusFilter !== "all"
                  ? "No matching domains found"
                  : "No domains registered yet"}
              </h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {searchQuery || statusFilter !== "all"
                  ? "Try adjusting your search criteria or filter options."
                  : "Register your domain to generate a DNS TXT challenge and establish verified ownership."}
              </p>
            </div>
            {searchQuery || statusFilter !== "all" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
                className="border-white/15 text-zinc-300"
              >
                Reset Filters
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setIsRegisterModalOpen(true)}
                className="bg-white text-slate-900 hover:bg-slate-200 font-semibold text-xs h-9 px-4"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Register Your First Domain
              </Button>
            )}
          </div>
        ) : viewMode === "table" ? (
          /* Table View (Desktop & Tablet) */
          <div className="rounded-xl border border-white/[0.08] bg-[#090b10] overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.02] text-zinc-400 uppercase font-mono tracking-wider text-[10px]">
                  <tr>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Domain
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Status
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      DNS TXT Host
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Attempts
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">
                      Last Check / Verified
                    </th>
                    <th scope="col" className="px-4 py-3.5 font-semibold text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredDomains.map((domain) => {
                    const isVerifying = verifyingId === domain.id;
                    return (
                      <tr
                        key={domain.id}
                        className="hover:bg-white/[0.02] transition-colors group"
                      >
                        {/* Domain Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                              <Globe className="h-3.5 w-3.5" />
                            </div>
                            <div>
                              <div className="font-semibold text-white font-mono flex items-center gap-1.5">
                                <span>{domain.normalized_domain}</span>
                                {domain.verification_status === "verified" && (
                                  <a
                                    href={`https://${domain.normalized_domain}`}
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    className="text-zinc-500 hover:text-white transition-colors"
                                    title="Open website"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                              {domain.failure_reason && domain.verification_status === "failed" && (
                                <p className="text-[10px] text-rose-400 mt-0.5 line-clamp-1 max-w-xs">
                                  {domain.failure_reason}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Status Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {getStatusBadge(domain.verification_status)}
                        </td>

                        {/* DNS TXT Host Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <code className="px-2 py-0.5 rounded bg-black/60 border border-white/10 font-mono text-cyan-300 text-[11px]">
                              _lazynerds-verification
                            </code>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopy(
                                  `_lazynerds-verification.${domain.normalized_domain}`,
                                  `fqdn-${domain.id}`
                                )
                              }
                              className="text-zinc-500 hover:text-white transition-colors p-1"
                              title="Copy full FQDN"
                            >
                              {copiedId === `fqdn-${domain.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        </td>

                        {/* Attempts Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap font-mono text-zinc-400 text-[11px]">
                          <span>{domain.verification_attempt_count} / 50</span>
                        </td>

                        {/* Date Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400 text-[11px]">
                          {domain.verified_at ? (
                            <span className="text-emerald-400 font-medium">
                              {formatRelativeTime(domain.verified_at)}
                            </span>
                          ) : domain.last_verification_attempt_at ? (
                            <span>{formatRelativeTime(domain.last_verification_attempt_at)}</span>
                          ) : (
                            <span className="text-zinc-500 italic">Never checked</span>
                          )}
                        </td>

                        {/* Actions Column */}
                        <td className="px-4 py-3.5 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {domain.verification_status !== "verified" && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => handleDirectVerify(domain)}
                                disabled={isVerifying}
                                className="h-7 px-2.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-medium text-xs"
                                title="Query DNS TXT records now"
                              >
                                {isVerifying ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <ShieldCheck className="w-3 h-3 mr-1" />
                                )}
                                Verify
                              </Button>
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setInstructionsModalDomain(domain);
                                setInstructionsActiveToken(null);
                              }}
                              className="h-7 px-2.5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/[0.05] text-xs"
                              title="View DNS TXT configuration details"
                            >
                              <FileCode2 className="w-3 h-3 mr-1" />
                              Instructions
                            </Button>

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setDomainToDelete(domain)}
                              className="h-7 w-7 p-0 border-white/10 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10"
                              title="Delete domain registration"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards View (Mobile & Tablet) */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDomains.map((domain) => {
              const isVerifying = verifyingId === domain.id;
              return (
                <div
                  key={domain.id}
                  className="rounded-xl border border-white/[0.08] bg-[#0c0e14] p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                        <Globe className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-mono font-semibold text-white truncate text-sm">
                          {domain.normalized_domain}
                        </h4>
                        <p className="text-[10px] text-zinc-400">
                          Registered {formatDate(domain.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(domain.verification_status)}
                  </div>

                  {domain.failure_reason && domain.verification_status === "failed" && (
                    <div className="p-2.5 rounded-lg border border-rose-500/20 bg-rose-950/20 text-xs text-rose-300">
                      <span className="font-semibold block text-[11px] mb-0.5">Failure Reason:</span>
                      <p className="text-[11px] text-rose-200/80 leading-relaxed">
                        {domain.failure_reason}
                      </p>
                    </div>
                  )}

                  {/* DNS Record Host Snippet */}
                  <div className="p-2.5 rounded-lg border border-white/[0.06] bg-black/40 text-xs space-y-1">
                    <span className="text-[10px] text-zinc-400 uppercase font-mono">
                      Required DNS Host:
                    </span>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-cyan-300 font-mono text-xs break-all">
                        _lazynerds-verification.{domain.normalized_domain}
                      </code>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `_lazynerds-verification.${domain.normalized_domain}`,
                            `card-${domain.id}`
                          )
                        }
                        className="text-zinc-400 hover:text-white p-1 shrink-0"
                        title="Copy full FQDN"
                      >
                        {copiedId === `card-${domain.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Telemetry info row */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/[0.04]">
                    <span>Attempts: {domain.verification_attempt_count}/50</span>
                    <span>
                      {domain.verified_at
                        ? `Verified ${formatRelativeTime(domain.verified_at)}`
                        : domain.last_verification_attempt_at
                        ? `Checked ${formatRelativeTime(domain.last_verification_attempt_at)}`
                        : "Never checked"}
                    </span>
                  </div>

                  {/* Card actions */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setDomainToDelete(domain)}
                      className="h-8 px-2.5 border-white/10 text-zinc-400 hover:text-rose-400 hover:border-rose-500/30 text-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Remove
                    </Button>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setInstructionsModalDomain(domain);
                          setInstructionsActiveToken(null);
                        }}
                        className="h-8 px-2.5 border-white/10 text-zinc-300 hover:text-white text-xs"
                      >
                        <FileCode2 className="w-3.5 h-3.5 mr-1" />
                        Instructions
                      </Button>

                      {domain.verification_status !== "verified" && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleDirectVerify(domain)}
                          disabled={isVerifying}
                          className="h-8 px-3 bg-white text-slate-900 hover:bg-slate-200 font-semibold text-xs"
                        >
                          {isVerifying ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                          ) : (
                            <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                          )}
                          Verify
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Register Domain Modal */}
      <DomainRegisterModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        onDomainRegistered={(createdRes: DomainCreateResponse) => {
          loadDomains();
        }}
      />

      {/* DNS Instructions Modal */}
      <DomainDnsInstructionsModal
        isOpen={!!instructionsModalDomain}
        onClose={() => setInstructionsModalDomain(null)}
        domain={instructionsModalDomain}
        activeToken={instructionsActiveToken}
        onVerified={(result) => {
          setDomains((prev) =>
            prev.map((d) => (d.id === result.domain.id ? result.domain : d))
          );
        }}
        onRegenerated={(res) => {
          setInstructionsActiveToken(res.token);
          setDomains((prev) =>
            prev.map((d) => (d.id === res.domain.id ? res.domain : d))
          );
        }}
      />

      {/* Delete Domain Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!domainToDelete}
        onClose={() => setDomainToDelete(null)}
        onConfirm={confirmDeleteDomain}
        title="Remove Registered Domain"
        description={`Are you sure you want to remove ${domainToDelete?.normalized_domain}? This will delete the domain ownership challenge and any verification records associated with it.`}
        confirmLabel="Remove Domain"
        variant="destructive"
        loading={isDeleting}
      />
    </AppShell>
  );
}
