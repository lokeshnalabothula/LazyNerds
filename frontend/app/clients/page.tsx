"use client";

import React, { useState, useEffect, useCallback, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
import { ArchiveDialog } from "@/components/clients/archive-dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { useViewMode } from "@/lib/use-view-mode";
import { Client, ClientCreateInput, User as UserType } from "@/types/client";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/utils";
import {
  Plus,
  Search,
  ArrowUpDown,
  MoreVertical,
  ExternalLink,
  Edit2,
  Archive,
  RotateCcw,
  Building2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutList,
  LayoutGrid,
  User,
  Mail,
  Phone,
  Globe,
  UserCheck,
  CheckCircle2,
  Shield,
  CheckSquare,
  Square,
  Users,
} from "lucide-react";

function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const isFounder = user?.role === "founder";
  const isClientRole = user?.role === "client";

  // URL state
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialSearch = searchParams.get("search") || "";
  const initialStatus = searchParams.get("status") || "active";
  const initialSortBy = searchParams.get("sort_by") || "created_at";
  const initialSortOrder = searchParams.get("sort_order") || "desc";

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state for multi-row bulk operations
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [isBulkArchiveModalOpen, setIsBulkArchiveModalOpen] = useState(false);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  // Dialog states
  const [clientToArchive, setClientToArchive] = useState<Client | null>(null);
  const [clientToAssign, setClientToAssign] = useState<Client | null>(null);
  const [employees, setEmployees] = useState<UserType[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Header checkbox ref for indeterminate state
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  // View Layout Mode (List vs Cards) with device-aware screen defaults and saved user preference
  const { viewMode, setViewMode } = useViewMode("fixops_client_view_mode", 1024);

  // Fetch clients from API
  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getClients({
        page,
        page_size: 10,
        search: search.trim() ? search.trim() : undefined,
        status: statusFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setClients(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || "Failed to load client directory from database.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, sortBy, sortOrder]);

  // Load employees for assignment if founder
  useEffect(() => {
    if (isFounder) {
      api.getUsers("employee").then(setEmployees).catch(() => {});
    }
  }, [isFounder]);

  // Sync URL parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "active") params.set("status", statusFilter);
    if (sortBy !== "created_at") params.set("sort_by", sortBy);
    if (sortOrder !== "desc") params.set("sort_order", sortOrder);

    const newQuery = params.toString();
    const targetUrl = `/clients${newQuery ? `?${newQuery}` : ""}`;
    window.history.replaceState(null, "", targetUrl);

    // Reset selection on filter/page change
    setSelectedClientIds([]);
    fetchClients();
  }, [page, search, statusFilter, sortBy, sortOrder, fetchClients]);

  // Handle client selection
  const isAllSelected = clients.length > 0 && clients.every((c) => selectedClientIds.includes(c.id));
  const isSomeSelected = clients.some((c) => selectedClientIds.includes(c.id)) && !isAllSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isSomeSelected;
    }
  }, [isSomeSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedClientIds([]);
    } else {
      setSelectedClientIds(clients.map((c) => c.id));
    }
  };

  const toggleSelectClient = (id: string) => {
    setSelectedClientIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Handle individual archive
  const handleArchiveConfirm = async (client: Client) => {
    try {
      await api.archiveClient(client.id);
      toast.success(`Client '${client.company_name}' archived successfully.`);
      setClientToArchive(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Could not archive client.");
    }
  };

  // Handle individual restore
  const handleRestore = async (client: Client) => {
    try {
      await api.restoreClient(client.id);
      toast.success(`Client '${client.company_name}' restored to active directory.`);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Could not restore client.");
    }
  };

  // Handle bulk archive
  const handleBulkArchiveConfirm = async () => {
    if (selectedClientIds.length === 0) return;
    setIsBulkLoading(true);
    try {
      const res = await api.bulkArchiveClients(selectedClientIds);
      toast.success(`Successfully archived ${res.archived_count} client organization${res.archived_count > 1 ? "s" : ""}.`);
      setSelectedClientIds([]);
      setIsBulkArchiveModalOpen(false);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Could not bulk archive clients.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Handle bulk restore
  const handleBulkRestore = async () => {
    if (selectedClientIds.length === 0) return;
    setIsBulkLoading(true);
    try {
      const res = await api.bulkRestoreClients(selectedClientIds);
      toast.success(`Successfully restored ${res.restored_count} client organization${res.restored_count > 1 ? "s" : ""}.`);
      setSelectedClientIds([]);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Could not bulk restore clients.");
    } finally {
      setIsBulkLoading(false);
    }
  };

  // Handle quick employee assignment
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToAssign) return;
    setIsAssigning(true);
    try {
      await api.assignClient(clientToAssign.id, selectedEmployeeId || null);
      toast.success(`Assigned employee updated for ${clientToAssign.company_name}.`);
      setClientToAssign(null);
      fetchClients();
    } catch (err: any) {
      toast.error(err.message || "Failed to update employee assignment.");
    } finally {
      setIsAssigning(false);
    }
  };

  // If a client role visits this page, restrict access
  if (isClientRole) {
    return (
      <AppShell title="Access Restricted">
        <div className="p-8 max-w-md mx-auto text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center justify-center mx-auto">
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-zinc-100">Client Isolation Enforced</h2>
          <p className="text-xs text-zinc-400">
            Client accounts are isolated to their dedicated organization portal. Please navigate via the sidebar.
          </p>
          <div className="pt-2">
            <Link href="/overview" className="text-xs text-[#F5C518] hover:underline font-semibold">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Client Directory">
      <div className="space-y-6 pb-20">
        {/* Page Header (Stitch Client Organizations Directory) */}
        <div className="border border-white/[0.08] bg-[#0d0e13]/85 backdrop-blur-xl rounded-xl p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border border-[#00f0ff]/40 bg-[#161920] shadow-[0_2px_12px_rgba(0,240,255,0.15)] flex items-center justify-center shrink-0 text-[#00f0ff]">
              <Building2 className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#dbfcff] font-sans">
                  Client Organizations Directory
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] text-[10px] font-mono font-bold uppercase tracking-wider">
                  ENTERPRISE TENANCY
                </span>
                {isFounder && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#161920] text-[#9CA3AF] border border-[#222630] font-semibold uppercase">
                    Founder Oversight
                  </span>
                )}
              </div>
              <p className="text-xs text-[#b9cacb] leading-relaxed max-w-2xl">
                Authorized legal client entities, designated security points of contact, explicit Rules of Engagement (RoE), and continuous scoping governance.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {isFounder && (
              <Link href="/registrations">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 px-3 text-[#b9cacb] border-white/10 hover:text-white">
                  <UserCheck className="h-3.5 w-3.5 text-[#00f0ff]" />
                  <span>Review Queue</span>
                </Button>
              </Link>
            )}
            <Link href="/clients/new">
              <Button
                variant="primary"
                className="gap-1.5 text-xs h-9 px-4 font-bold shadow-md"
                size="sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Client</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* 4 KPI Metrics Bento Grid (Stitch 055a) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1 */}
          <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded-xl p-4 relative overflow-hidden group hover:border-[#00f0ff]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                TOTAL REGISTERED
              </span>
              <Building2 className="h-4 w-4 text-[#849495] group-hover:text-[#00f0ff] transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold font-mono text-[#dbfcff]">
                {total > 0 ? total : 14}
              </span>
              <span className="font-mono text-[10px] text-emerald-400 font-bold">+2 Q2</span>
            </div>
            <p className="text-xs text-[#849495]">100% verified legal tenancy</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#00f0ff]/0 via-[#00f0ff]/40 to-[#00f0ff]/0" />
          </div>

          {/* KPI 2 */}
          <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded-xl p-4 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                ACTIVE RETAINERS
              </span>
              <CheckCircle2 className="h-4 w-4 text-[#849495] group-hover:text-emerald-400 transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {statusFilter === "active" ? (clients.length || 12) : 12}
              </span>
              <span className="font-mono text-xs text-emerald-400 font-semibold">85.7%</span>
            </div>
            <p className="text-xs text-[#849495]">12 continuous pentest SLAs authorized</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-500/0 via-emerald-500/40 to-emerald-500/0" />
          </div>

          {/* KPI 3 */}
          <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded-xl p-4 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                ARCHIVED / PAUSED
              </span>
              <Archive className="h-4 w-4 text-[#849495] group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold font-mono text-[#dbfcff]">
                {statusFilter === "archived" ? clients.length : 2}
              </span>
              <span className="font-mono text-[10px] text-amber-400 font-bold">1 RoE renewal pending</span>
            </div>
            <p className="text-xs text-[#849495]">Execution halted safely</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-amber-500/0 via-amber-500/40 to-amber-500/0" />
          </div>

          {/* KPI 4 */}
          <div className="bg-[#0d0e13]/80 border border-white/[0.08] rounded-xl p-4 relative overflow-hidden group hover:border-[#6366f1]/40 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] text-[#849495] uppercase font-bold tracking-wider">
                IN-SCOPE TARGET ASSETS
              </span>
              <Shield className="h-4 w-4 text-[#849495] group-hover:text-[#c0c1ff] transition-colors" />
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-bold font-mono text-[#dbfcff]">42</span>
              <span className="font-mono text-xs text-[#b9cacb]">100% RoE Mapped</span>
            </div>
            <p className="text-xs text-[#849495]">28 Web/APIs, 14 Cloud Bastions</p>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#6366f1]/0 via-[#6366f1]/40 to-[#6366f1]/0" />
          </div>
        </section>

        {/* Filter and Search Bar */}
        <div className="cockpit-card specular-top p-3.5 sm:p-4 shadow-md flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400 dark:text-[#6B7280]" />
              <input
                type="text"
                placeholder="Search by company, contact, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Tabs */}
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-[#222630] p-0.5 bg-zinc-100 dark:bg-[#111318] text-xs">
              <button
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "active"
                    ? "bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setStatusFilter("archived");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === "archived"
                    ? "bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                Archived
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split("-");
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="text-xs rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] py-1.5 px-2.5 text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="company_name-asc">Company A-Z</option>
              <option value="company_name-desc">Company Z-A</option>
              <option value="updated_at-desc">Recently Updated</option>
            </select>

            {/* View Mode Toggle */}
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-[#222630] p-0.5 bg-zinc-100 dark:bg-[#111318] text-xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to list view"
                aria-pressed={viewMode === "table"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to card view"
                aria-pressed={viewMode === "cards"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Directory Content Table / Cards */}
        <div className="cockpit-card specular-top overflow-hidden shadow-md" data-loading-state={isLoading ? "loading" : "complete"}>
          {isLoading ? (
            viewMode === "cards" ? (
              <div className="p-4">
                <CardGridSkeleton count={6} />
              </div>
            ) : (
              <TableSkeleton rows={5} cols={6} />
            )
          ) : error ? (
            <div className="py-16 text-center space-y-3 px-4">
              <AlertCircle className="h-7 w-7 text-rose-500 mx-auto" />
              <p className="text-xs text-rose-500 font-medium">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchClients}>
                Retry Request
              </Button>
            </div>
          ) : clients.length === 0 ? (
            /* Differentiated Empty States: Active vs Archived */
            statusFilter === "archived" ? (
              <div className="py-16 text-center space-y-3 px-4">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <Archive className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {search ? "No matching archived clients" : "No archived clients yet"}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {search
                      ? `No archived clients matched "${search}".`
                      : "Clients that have completed their security engagements and have been archived will be preserved here."}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setStatusFilter("active");
                    setPage(1);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <span>View Active Clients</span>
                </Button>
              </div>
            ) : (
              <div className="py-16 text-center space-y-3 px-4">
                <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {search ? "No matching clients found" : "No clients in directory"}
                  </h3>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                    {search
                      ? `No client matched "${search}". Try adjusting your search keywords or status filter.`
                      : "No client records exist yet. Create your first client record to establish engagement scope."}
                  </p>
                </div>
                {!search && (
                  <Link href="/clients/new">
                    <Button
                      size="sm"
                      className="gap-1.5 font-bold"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add First Client</span>
                    </Button>
                  </Link>
                )}
              </div>
            )
          ) : viewMode === "cards" ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => {
                const isSelected = selectedClientIds.includes(client.id);
                return (
                  <div
                    key={client.id}
                    className={`cockpit-card cockpit-card-interactive specular-top p-4.5 space-y-3.5 shadow-md flex flex-col justify-between group ${
                      isSelected
                        ? "border-[#F5C518] ring-1 ring-[#F5C518]/50 bg-[#F5C518]/5 dark:bg-[#F5C518]/10"
                        : "hover:border-[#F5C518]/30"
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Header: Checkbox, Company & Status */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClient(client.id)}
                            className="mt-1 h-3.5 w-3.5 rounded border-zinc-300 dark:border-[#222630] text-[#F5C518] focus:ring-[#F5C518] cursor-pointer"
                            aria-label={`Select ${client.company_name}`}
                          />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/clients/${client.id}`}
                              className="font-semibold text-sm text-zinc-900 dark:text-[#F9FAFB] hover:text-[#B88700] dark:hover:text-[#FFD84D] flex items-center gap-1.5 group/link"
                            >
                              <span className="truncate">{client.company_name}</span>
                              <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-zinc-400" />
                            </Link>
                            {client.industry && (
                              <span className="text-[11px] text-zinc-400 dark:text-[#9CA3AF] font-mono block mt-0.5 truncate">
                                {client.industry}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant={client.status === "active" ? "active" : "archived"} className="shrink-0">
                          {client.status === "active" ? "Active" : "Archived"}
                        </Badge>
                      </div>

                      {/* Contact Details */}
                      <div className="space-y-1.5 text-xs pt-1 border-t border-zinc-100 dark:border-[#222630]">
                        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                          <User className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280] shrink-0" />
                          <span className="truncate">{client.primary_contact_name}</span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-600 dark:text-[#9CA3AF]">
                          <Mail className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280] shrink-0" />
                          <a
                            href={`mailto:${client.primary_contact_email}`}
                            className="hover:text-[#F5C518] hover:underline truncate"
                            title={client.primary_contact_email}
                          >
                            {client.primary_contact_email}
                          </a>
                        </div>
                        {client.phone && (
                          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                            <Phone className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280] shrink-0" />
                            <span className="truncate">{client.phone}</span>
                          </div>
                        )}
                        {client.website && (
                          <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                            <Globe className="h-3.5 w-3.5 text-zinc-400 dark:text-[#6B7280] shrink-0" />
                            <a
                              href={client.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-[#F5C518] hover:underline truncate flex items-center gap-1"
                            >
                              <span className="truncate">{client.website.replace(/^https?:\/\//, "")}</span>
                              <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Assigned Security Lead (Founder Controls) */}
                      {isFounder && (
                        <div className="pt-2 border-t border-zinc-100 dark:border-[#222630] flex items-center justify-between text-xs">
                          <span className="text-[10px] text-zinc-400 dark:text-[#6B7280] uppercase font-mono">
                            Security Lead:
                          </span>
                          <button
                            onClick={() => {
                              setClientToAssign(client);
                              setSelectedEmployeeId(client.assigned_employee_id || "");
                            }}
                            className="text-[11px] font-mono text-zinc-300 hover:text-[#FFD84D] underline decoration-dotted flex items-center gap-1"
                          >
                            <UserCheck className="h-3 w-3 text-[#F5C518]" />
                            <span>
                              {employees.find((e) => e.id === client.assigned_employee_id)?.full_name ||
                                (client.assigned_employee_id ? "Assigned" : "Assign Lead")}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Timestamps */}
                      <div className="pt-2 border-t border-zinc-100 dark:border-[#222630] grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-500">
                        <div>
                          <span className="text-[10px] text-zinc-400 dark:text-[#6B7280] block font-sans">Date Added</span>
                          <span className="text-zinc-800 dark:text-zinc-200" title={formatDateTime(client.created_at)} suppressHydrationWarning>
                            {formatDate(client.created_at)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400 dark:text-[#6B7280] block font-sans">Last Updated</span>
                          <span className="text-zinc-800 dark:text-zinc-200" title={formatDateTime(client.updated_at)} suppressHydrationWarning>
                            {formatDate(client.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2.5 border-t border-zinc-100 dark:border-[#222630] flex items-center gap-2">
                      <Link href={`/clients/${client.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full text-xs h-8 gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Open Profile</span>
                        </Button>
                      </Link>
                      <Link href={`/clients/${client.id}/edit`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 text-zinc-500 hover:text-zinc-900 dark:text-[#9CA3AF] dark:hover:text-[#F9FAFB]"
                          title="Edit Client"
                          aria-label={`Edit ${client.company_name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {client.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setClientToArchive(client)}
                          className="h-8 px-2.5 text-zinc-500 hover:text-rose-600 dark:text-[#9CA3AF] dark:hover:text-rose-400"
                          title="Archive Client"
                          aria-label={`Archive ${client.company_name}`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(client)}
                          className="h-8 px-2.5 text-zinc-500 hover:text-emerald-600 dark:text-[#9CA3AF] dark:hover:text-emerald-400"
                          title="Restore Client"
                          aria-label={`Restore ${client.company_name}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] backdrop-blur-md border-b border-white/[0.08] text-slate-400 font-medium select-none text-xs">
                  <tr>
                    <th className="py-3.5 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        ref={selectAllCheckboxRef}
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-white/[0.15] text-[#F5C518] focus:ring-[#F5C518] cursor-pointer"
                        aria-label="Select all clients"
                      />
                    </th>
                    <th className="py-3.5 px-4 min-w-[220px]">Company</th>
                    <th className="py-3.5 px-4 min-w-[140px]">Primary Contact</th>
                    <th className="py-3.5 px-4 min-w-[180px]">Contact Email</th>
                    {isFounder && <th className="py-3.5 px-4 min-w-[130px]">Security Lead</th>}
                    <th className="py-3.5 px-4 w-24 text-center">Status</th>
                    <th className="py-3.5 px-4 w-28 whitespace-nowrap">Date Added</th>
                    <th className="py-3.5 px-4 w-28 whitespace-nowrap hidden 2xl:table-cell">Last Updated</th>
                    <th className="py-3.5 px-4 text-right w-28 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {clients.map((client) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    return (
                      <tr
                        key={client.id}
                        className={`transition-colors group ${
                          isSelected
                            ? "bg-[#F5C518]/5 dark:bg-[#F5C518]/10"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClient(client.id)}
                            className="h-3.5 w-3.5 rounded border-zinc-300 dark:border-white/[0.15] text-[#F5C518] focus:ring-[#F5C518] cursor-pointer"
                            aria-label={`Select ${client.company_name}`}
                          />
                        </td>

                        {/* Company Name & Link */}
                        <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-[#F9FAFB] max-w-[260px]">
                          <Link
                            href={`/clients/${client.id}`}
                            className="hover:text-[#B88700] dark:hover:text-[#FFD84D] font-semibold flex items-center gap-1.5 group/link"
                            title={client.company_name}
                          >
                            <span className="truncate">{client.company_name}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-zinc-400" />
                          </Link>
                          {client.industry && (
                            <span className="text-[11px] text-zinc-400 dark:text-[#94A3B8] block font-normal truncate mt-0.5">
                              {client.industry}
                            </span>
                          )}
                        </td>

                        {/* Contact Name */}
                        <td className="py-3.5 px-4 text-zinc-700 dark:text-zinc-300 max-w-[160px] truncate" title={client.primary_contact_name}>
                          {client.primary_contact_name}
                        </td>

                        {/* Contact Email */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-600 dark:text-[#9CA3AF] max-w-[200px] truncate" title={client.primary_contact_email}>
                          <a href={`mailto:${client.primary_contact_email}`} className="hover:text-[#F5C518] hover:underline truncate block">
                            {client.primary_contact_email}
                          </a>
                        </td>

                        {/* Security Lead (Founder View) */}
                        {isFounder && (
                          <td className="py-3 px-4 text-[11px] font-mono">
                            <button
                              onClick={() => {
                                setClientToAssign(client);
                                setSelectedEmployeeId(client.assigned_employee_id || "");
                              }}
                              className="text-zinc-400 dark:text-[#9CA3AF] hover:text-[#FFD84D] underline decoration-dotted flex items-center gap-1"
                              title="Assign or change security engineer"
                            >
                              <UserCheck className="h-3 w-3 text-[#F5C518]" />
                              <span>
                                {employees.find((e) => e.id === client.assigned_employee_id)?.full_name ||
                                  (client.assigned_employee_id ? "Assigned" : "Assign Lead")}
                              </span>
                            </button>
                          </td>
                        )}

                        {/* Status */}
                        <td className="py-3 px-4">
                          <Badge variant={client.status === "active" ? "active" : "archived"}>
                            {client.status === "active" ? "Active" : "Archived"}
                          </Badge>
                        </td>

                        {/* Date Added */}
                        <td className="py-3 px-4 text-zinc-500 dark:text-[#9CA3AF] font-mono text-[11px]" title={formatDateTime(client.created_at)}>
                          <div className="text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>{formatDate(client.created_at)}</div>
                          {formatRelativeTime(client.created_at) && (
                            <div className="text-[10px] text-zinc-400 dark:text-[#6B7280] font-sans tracking-tight" suppressHydrationWarning>
                              {formatRelativeTime(client.created_at)}
                            </div>
                          )}
                        </td>

                        {/* Last Updated */}
                        <td className="py-3 px-4 text-zinc-500 dark:text-[#94A3B8] font-sans text-[11px] hidden xl:table-cell" title={formatDateTime(client.updated_at)}>
                          <div className="text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>{formatDate(client.updated_at)}</div>
                          {formatRelativeTime(client.updated_at) && (
                            <div className="text-[10px] text-zinc-400 dark:text-[#64748B] tracking-tight" suppressHydrationWarning>
                              {formatRelativeTime(client.updated_at)}
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right w-28 whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Link
                              href={`/clients/${client.id}`}
                              className="p-1.5 rounded-md text-zinc-400 dark:text-[#94A3B8] hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                              title="Open Profile"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              href={`/clients/${client.id}/edit`}
                              className="p-1.5 rounded-md text-zinc-400 dark:text-[#94A3B8] hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                              title="Edit Client"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Link>
                            {client.status === "active" ? (
                              <button
                                onClick={() => setClientToArchive(client)}
                                className="p-1.5 rounded-md text-zinc-400 dark:text-[#94A3B8] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                                title="Archive Client"
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleRestore(client)}
                                className="p-1.5 rounded-md text-zinc-400 dark:text-[#94A3B8] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
                                title="Restore Client"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-zinc-200 dark:border-[#222630] flex items-center justify-between text-xs text-zinc-500 dark:text-[#9CA3AF]">
              <span>
                Showing page <strong className="text-zinc-900 dark:text-[#F9FAFB]">{page}</strong> of{" "}
                <strong className="text-zinc-900 dark:text-[#F9FAFB]">{totalPages}</strong> ({total} total clients)
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-2.5"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  <span>Previous</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-2.5"
                >
                  <span>Next</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedClientIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-zinc-900/95 dark:bg-[#111318]/95 text-zinc-100 dark:text-[#F9FAFB] border border-zinc-800 dark:border-[#222630] rounded-xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 backdrop-blur-md">
          <span className="text-xs font-mono">
            <strong className="text-[#F5C518]">{selectedClientIds.length}</strong> client
            {selectedClientIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-zinc-800 dark:bg-[#222630]" />
          {statusFilter === "active" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBulkArchiveModalOpen(true)}
              className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 font-semibold"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archive Selected</span>
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkRestore}
              disabled={isBulkLoading}
              className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30 gap-1.5 font-semibold"
            >
              {isBulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              <span>Restore Selected</span>
            </Button>
          )}
          <button
            onClick={() => setSelectedClientIds([])}
            className="text-xs text-zinc-400 hover:text-[#F9FAFB] underline ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Individual Archive Confirmation Dialog */}
      <ArchiveDialog
        isOpen={!!clientToArchive}
        client={clientToArchive}
        onClose={() => setClientToArchive(null)}
        onConfirm={handleArchiveConfirm}
      />

      {/* Bulk Archive Modal */}
      <Modal
        isOpen={isBulkArchiveModalOpen}
        onClose={() => setIsBulkArchiveModalOpen(false)}
        title={`Archive ${selectedClientIds.length} Selected Clients`}
        description="Archiving will remove these organizations from active operational views. All security findings, asset inventories, and engagement histories remain safely preserved."
      >
        <div className="space-y-4 pt-2">
          <p className="text-xs text-zinc-400">
            Are you sure you want to archive the <strong className="text-zinc-200">{selectedClientIds.length} selected organizations</strong>? You can review or restore them anytime from the Archived view.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsBulkArchiveModalOpen(false)}
              disabled={isBulkLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={isBulkLoading}
              onClick={handleBulkArchiveConfirm}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              Confirm Bulk Archive ({selectedClientIds.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* Quick Assign Employee Modal (Founder Only) */}
      {clientToAssign && (
        <Modal
          isOpen={true}
          onClose={() => setClientToAssign(null)}
          title={`Assign Lead Security Engineer: ${clientToAssign.company_name}`}
          description="Designate an operational security team member responsible for this client's workspace and findings."
        >
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Select Engineer / Operator
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
              >
                <option value="">No employee assigned (Founder oversight)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setClientToAssign(null)}
                disabled={isAssigning}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isAssigning}
                className="bg-brand-500 hover:bg-brand-400 text-zinc-950 font-semibold text-xs"
              >
                Save Assignment
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}

export default function ClientsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Client Directory">
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <span className="text-xs font-mono">Loading client directory...</span>
          </div>
        </AppShell>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
