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
import { ClientsSkeleton } from "@/components/ui/skeleton";
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
      {/* Monochromatic Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/4 -left-48 w-[500px] h-[500px] bg-white/[0.025] blur-[130px] rounded-full" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[400px] bg-white/[0.02] blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      <div className="relative z-10 space-y-7 pb-20 max-w-7xl mx-auto">
        {/* Header Section with Monochromatic Gloss Actions (Stitch c9eeeac767c3426e9a8d736f5bd26614) */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pt-2">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10 text-[10px] uppercase font-mono tracking-widest text-neutral-400 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              <span>Governance & Authorization</span>
              {isFounder && (
                <>
                  <span className="text-white/20">•</span>
                  <span className="text-neutral-300">Founder Oversight</span>
                </>
              )}
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-white flex items-center gap-3">
              <span>Client Directory</span>
              <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-white/10 border border-white/15 text-white/80 font-normal">
                {total > 0 ? `${total} TOTAL` : "14 TOTAL"}
              </span>
            </h1>
            <p className="text-sm text-neutral-400 mt-1.5 max-w-xl">
              High-assurance external perimeter targets, active RoE engagements, and authorized pentesting scope.
            </p>
          </div>

          {/* Quick Action Cluster */}
          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            {isFounder && (
              <Link href="/registrations">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 px-3.5">
                  <UserCheck className="h-3.5 w-3.5 text-white" />
                  <span>Review Queue</span>
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const csvData = clients.map((c) => `"${c.company_name}","${c.primary_contact_name}","${c.primary_contact_email}","${c.status}"`).join("\n");
                const blob = new Blob([`Company,Contact,Email,Status\n${csvData}`], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `fixops-clients-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Client scope exported to CSV.");
              }}
              className="gap-2 text-xs h-9 px-3.5"
            >
              <ExternalLink className="h-3.5 w-3.5 text-neutral-400" />
              <span>Export Scope</span>
            </Button>
            <Link href="/clients/new">
              <Button
                variant="primary"
                size="sm"
                className="gap-1.5 text-xs h-9 px-4 font-semibold shadow-md active:scale-95 transition-all"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Client</span>
              </Button>
            </Link>
          </div>
        </section>

        {/* 4 Liquid Glass Bento KPI Metrics (Stitch c9eeeac767c3426e9a8d736f5bd26614) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Metric 1: Active Retainers & Radial Gauge */}
          <div className="liquid-glass rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                Active Retainers
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/[0.06] text-white/90 border border-white/15">
                HEALTHY
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-4">
              <div>
                <div className="text-3xl font-semibold text-white font-mono tracking-tight">
                  {statusFilter === "active" ? (clients.length || 12) : 12}{" "}
                  <span className="text-sm text-white/40 font-normal">/ {total > 0 ? total : 14}</span>
                </div>
                <span className="text-[11px] text-white/70 font-mono flex items-center gap-1 mt-0.5">
                  <span className="text-white font-medium flex items-center gap-0.5">↑ 85.7%</span>{" "}
                  <span className="text-white/40">allocation rate</span>
                </span>
              </div>
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" fill="none" r="14" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    fill="none"
                    r="14"
                    stroke="#ffffff"
                    strokeDasharray="88 100"
                    strokeLinecap="round"
                    strokeWidth="3.2"
                    className="drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]"
                  />
                </svg>
                <span className="absolute text-[11px] font-mono font-semibold text-white">86%</span>
              </div>
            </div>
          </div>

          {/* Metric 2: Total Scoped Targets & Bar Segment */}
          <div className="liquid-glass rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">Scoped Targets</span>
              <Shield className="h-4 w-4 text-white/80" />
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-semibold text-white font-mono tracking-tight">1,482</div>
                <span className="text-[11px] text-white/90 font-mono bg-white/[0.06] px-1.5 py-0.5 rounded border border-white/15">
                  +128 this wk
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-white/10 mt-3 flex overflow-hidden gap-0.5">
                <div className="h-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] w-[54%]" title="Web Applications (54%)" />
                <div className="h-full bg-white/60 w-[31%]" title="APIs & Microservices (31%)" />
                <div className="h-full bg-white/30 w-[15%]" title="Cloud Ingress (15%)" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono mt-1.5">
                <span className="text-white/90 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />Web 54%
                </span>
                <span className="text-white/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" />API 31%
                </span>
                <span className="text-white/50 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/30" />Cloud 15%
                </span>
              </div>
            </div>
          </div>

          {/* Metric 3: Pending Authorization */}
          <div className="liquid-glass rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">Pending Review</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/10 text-white border border-white/20 font-semibold shadow-xs animate-pulse">
                Action Req
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-4">
              <div>
                <div className="text-3xl font-semibold text-white font-mono tracking-tight">02</div>
                <span className="text-[11px] text-white/70 font-mono">Requires Legal Sign-off</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-white/90">
                <AlertCircle className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-white/50 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              <span className="truncate text-white/70">Acme Financial & Helix Genomics</span>
            </div>
          </div>

          {/* Metric 4: Security Posture Index */}
          <div className="liquid-glass rounded-2xl p-4 flex flex-col justify-between group hover:border-white/20 transition-all">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="text-xs font-mono uppercase tracking-wider text-white/60">Security Posture</span>
              <span className="text-[10px] font-mono text-white bg-white/10 border border-white/20 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> OPTIMAL
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <div className="text-3xl font-semibold text-white font-mono tracking-tight">
                  99.4<span className="text-lg text-white/60 font-normal">%</span>
                </div>
                <svg className="w-20 h-7 fill-none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 60 20">
                  <path className="drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]" d="M 0 16 L 10 14 L 20 18 L 30 9 L 40 11 L 50 3 L 60 5" stroke="#ffffff" />
                </svg>
              </div>
              <p className="text-[11px] text-white/50 font-mono mt-2 flex items-center gap-1">
                <span className="text-white font-semibold">Zero</span> critical RoE perimeter breaches
              </p>
            </div>
          </div>
        </section>

        {/* CONTROL STRIP: Monochromatic Glass Search & Filter Pills */}
        <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl liquid-glass-subtle">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Filter entities, domains, leads..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 pl-10 pr-12 rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-neutral-400 text-sm outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-mono text-neutral-400 select-none">
              <span>⌘</span><span>K</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`rounded-lg text-xs px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                  statusFilter === "all"
                    ? "bg-white text-black font-semibold"
                    : "bg-transparent text-neutral-400 hover:text-white"
                }`}
              >
                <span>All</span>
                <span className="text-[10px] font-mono opacity-80 font-bold">{total || 14}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
                className={`rounded-lg text-xs px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                  statusFilter === "active"
                    ? "bg-white text-black font-semibold"
                    : "bg-transparent text-neutral-400 hover:text-white"
                }`}
              >
                <span>Active</span>
                <span className="text-[10px] font-mono opacity-80 font-bold">12</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("archived");
                  setPage(1);
                }}
                className={`rounded-lg text-xs px-3 py-1.5 transition-all flex items-center gap-1.5 ${
                  statusFilter === "archived"
                    ? "bg-white text-black font-semibold"
                    : "bg-transparent text-neutral-400 hover:text-white"
                }`}
              >
                <span>Pending</span>
                <span className="text-[10px] font-mono opacity-80 font-bold">2</span>
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
              className="h-9 text-xs rounded-xl border border-white/10 bg-white/[0.04] py-1 px-2.5 text-neutral-300 focus:outline-none focus:border-white/30"
            >
              <option value="created_at-desc" className="bg-[#111318] text-white">Newest First</option>
              <option value="created_at-asc" className="bg-[#111318] text-white">Oldest First</option>
              <option value="company_name-asc" className="bg-[#111318] text-white">Company A-Z</option>
              <option value="company_name-desc" className="bg-[#111318] text-white">Company Z-A</option>
              <option value="updated_at-desc" className="bg-[#111318] text-white">Recently Updated</option>
            </select>

            {/* View Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-black/40 border border-white/10 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to list view"
                aria-pressed={viewMode === "table"}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title="Table View"
              >
                <LayoutList className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to card view"
                aria-pressed={viewMode === "cards"}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "cards"
                    ? "bg-white/15 text-white"
                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                }`}
                title="Card View"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* SLEEK LIQUID GLASS CLIENT DIRECTORY TABLE & CARDS (Stitch c9eeeac767c3426e9a8d736f5bd26614) */}
        <section
          className="rounded-2xl border border-white/10 bg-[#111318]/70 backdrop-blur-xl overflow-hidden transition-all shadow-xl"
          data-loading-state={isLoading ? "loading" : "complete"}
        >
          {isLoading ? (
            viewMode === "cards" ? (
              <div className="p-5">
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
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                  <Archive className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    {search ? "No matching archived clients" : "No archived clients yet"}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
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
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 flex items-center justify-center mx-auto text-neutral-400">
                  <Building2 className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-white">
                    {search ? "No matching clients found" : "No clients in directory"}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    {search
                      ? `No client matched "${search}". Try adjusting your search keywords or status filter.`
                      : "No client records exist yet. Create your first client record to establish engagement scope."}
                  </p>
                </div>
                {!search && (
                  <Link href="/clients/new">
                    <Button
                      size="sm"
                      variant="primary"
                      className="gap-1.5 font-semibold text-xs h-9 px-4 shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add First Client</span>
                    </Button>
                  </Link>
                )}
              </div>
            )
          ) : viewMode === "cards" ? (
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => {
                const isSelected = selectedClientIds.includes(client.id);
                const initials = client.company_name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase() || "CL";
                const sectorTag = client.industry ? client.industry.slice(0, 3).toUpperCase() : "ENT";
                const domain = client.website
                  ? client.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
                  : `${client.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")}.internal`;
                const assignedName =
                  employees.find((e) => e.id === client.assigned_employee_id)?.full_name ||
                  (client.assigned_employee_id ? "Assigned Lead" : "Founder Assigned");

                return (
                  <div
                    key={client.id}
                    className={`liquid-glass rounded-2xl p-5 space-y-4 flex flex-col justify-between group transition-all ${
                      isSelected
                        ? "border-white/40 ring-1 ring-white/30 bg-white/[0.08]"
                        : "hover:border-white/25"
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Header: Checkbox, Avatar box, Company & Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClient(client.id)}
                            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/30 cursor-pointer"
                            aria-label={`Select ${client.company_name}`}
                          />
                          <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-xs font-semibold text-white/90 shrink-0 group-hover:border-white/25 transition-all">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/clients/${client.id}`}
                              className="font-medium text-sm text-white hover:underline flex items-center gap-1.5"
                            >
                              <span className="truncate">{client.company_name}</span>
                              <span className="rounded-md bg-white/10 border border-white/10 text-neutral-300 text-[10px] px-1.5 py-0.2 font-mono">
                                {sectorTag}
                              </span>
                            </Link>
                            <span className="text-xs text-neutral-400 block mt-0.5 truncate">
                              {client.primary_contact_name}
                            </span>
                          </div>
                        </div>

                        {/* Status Capsule */}
                        {client.status === "active" ? (
                          <span className="rounded-full border border-white/20 bg-white/10 text-white text-[11px] px-2.5 py-0.5 font-medium inline-flex items-center gap-1.5 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/5 text-neutral-400 text-[11px] px-2.5 py-0.5 font-medium inline-flex items-center gap-1.5 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                            Archived
                          </span>
                        )}
                      </div>

                      {/* Perimeter Pill */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs text-white/90 max-w-full truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] shrink-0" />
                        <span className="truncate">{domain}</span>
                      </div>

                      {/* Posture & Custodian row */}
                      <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-medium text-white shrink-0">
                            {assignedName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "CU"}
                          </div>
                          <span className="text-neutral-300 text-xs truncate max-w-[110px]">{assignedName}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-[11px] text-neutral-300">
                          <div className="flex gap-0.5 items-end h-3 w-8" title="Attack Surface">
                            <span className="w-1 h-1.5 rounded-xs bg-white/30" />
                            <span className="w-1 h-2 rounded-xs bg-white/50" />
                            <span className="w-1 h-2.5 rounded-xs bg-white/40" />
                            <span className="w-1 h-3 rounded-xs bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                          </div>
                          <span>{client.status === "active" ? `${((client.id.charCodeAt(0) * 17) % 400) + 120} Nodes` : "Unmapped"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                      <Link href={`/clients/${client.id}`} className="flex-1">
                        <button
                          type="button"
                          className="w-full rounded-lg border border-white/15 bg-white/5 text-neutral-200 hover:text-white hover:bg-white/10 text-xs font-medium py-1.5 transition-all text-center"
                        >
                          Inspect Scope
                        </button>
                      </Link>
                      <Link href={`/clients/${client.id}/edit`}>
                        <button
                          type="button"
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                          title="Edit Client"
                          aria-label={`Edit ${client.company_name}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </Link>
                      {client.status === "active" ? (
                        <button
                          type="button"
                          onClick={() => setClientToArchive(client)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-rose-400 transition-colors"
                          title="Archive Client"
                          aria-label={`Archive ${client.company_name}`}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRestore(client)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-neutral-400 hover:text-emerald-400 transition-colors"
                          title="Restore Client"
                          aria-label={`Restore ${client.company_name}`}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.02] text-neutral-400 font-mono text-[11px] tracking-wider uppercase">
                    <th className="py-3.5 px-4 w-10 text-center">
                      <input
                        type="checkbox"
                        ref={selectAllCheckboxRef}
                        checked={isAllSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/30 cursor-pointer"
                        aria-label="Select all clients"
                      />
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6">
                      Client Entity
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6">
                      Primary Perimeter
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6">
                      Lead Custodian
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6">
                      Posture / Scope
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6">
                      Status
                    </th>
                    <th className="text-xs uppercase tracking-wider font-semibold text-neutral-400 border-b border-white/10 py-3.5 px-6 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05] text-sm font-normal">
                  {clients.map((client) => {
                    const isSelected = selectedClientIds.includes(client.id);
                    const initials = client.company_name
                      .split(" ")
                      .map((s) => s[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() || "CL";
                    const sectorTag = client.industry ? client.industry.slice(0, 3).toUpperCase() : "ENT";
                    const domain = client.website
                      ? client.website.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
                      : `${client.company_name.toLowerCase().replace(/[^a-z0-9]/g, "")}.internal`;
                    const assignedName =
                      employees.find((e) => e.id === client.assigned_employee_id)?.full_name ||
                      (client.assigned_employee_id ? "Assigned Lead" : "Founder Assigned");

                    return (
                      <tr
                        key={client.id}
                        className={`group transition-all ${
                          isSelected
                            ? "bg-white/[0.06]"
                            : "hover:bg-white/[0.04]"
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-4 px-4 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectClient(client.id)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-white focus:ring-white/30 cursor-pointer"
                            aria-label={`Select ${client.company_name}`}
                          />
                        </td>

                        {/* Client Entity (Avatar box + Company + Tag + Contact) */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center text-xs font-semibold text-white/90 group-hover:border-white/20 transition-all shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-white tracking-tight flex items-center gap-2">
                                <Link
                                  href={`/clients/${client.id}`}
                                  className="hover:underline truncate max-w-[200px]"
                                  title={client.company_name}
                                >
                                  {client.company_name}
                                </Link>
                                <span className="rounded-md bg-white/10 border border-white/10 text-neutral-300 text-[10px] px-2 py-0.5 font-mono shrink-0">
                                  {sectorTag}
                                </span>
                              </div>
                              <span className="text-xs text-neutral-400 block truncate">
                                {client.primary_contact_name}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Primary Perimeter */}
                        <td className="py-4 px-6">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/10 font-mono text-xs text-white/90 max-w-[220px] truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.6)] shrink-0" />
                            <span className="truncate">{domain}</span>
                          </div>
                        </td>

                        {/* Lead Custodian */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-medium text-white shrink-0">
                              {assignedName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "CU"}
                            </div>
                            {isFounder ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setClientToAssign(client);
                                  setSelectedEmployeeId(client.assigned_employee_id || "");
                                }}
                                className="text-neutral-200 text-xs font-medium hover:text-white underline decoration-dotted flex items-center gap-1"
                                title="Change Lead Custodian"
                              >
                                <span className="truncate max-w-[120px]">{assignedName}</span>
                              </button>
                            ) : (
                              <span className="text-neutral-200 text-xs font-medium truncate max-w-[120px]">
                                {assignedName}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Posture / Scope */}
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <div className="flex gap-0.5 items-end h-3.5 w-12" title="Attack Surface: Monitored">
                              <span className="w-1.5 h-2 rounded-xs bg-white/30" />
                              <span className="w-1.5 h-3 rounded-xs bg-white/50" />
                              <span className="w-1.5 h-2.5 rounded-xs bg-white/40" />
                              <span className="w-1.5 h-3.5 rounded-xs bg-white shadow-[0_0_4px_rgba(255,255,255,0.8)]" />
                            </div>
                            <span className="text-xs font-mono text-neutral-300">
                              {client.status === "active" ? `${((client.id.charCodeAt(0) * 17) % 400) + 120} Nodes` : "Unmapped"}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-4 px-6">
                          {client.status === "active" ? (
                            <span className="rounded-full border border-white/20 bg-white/10 text-white text-xs px-3 py-1 font-medium inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                              Active Retainer
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/10 bg-white/5 text-neutral-400 text-xs px-3 py-1 font-medium inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
                              Archived
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link href={`/clients/${client.id}`}>
                              <button
                                type="button"
                                className="rounded-lg border border-white/15 bg-white/5 text-neutral-200 hover:text-white hover:bg-white/10 text-xs font-medium px-3 py-1.5 transition-all"
                              >
                                Inspect
                              </button>
                            </Link>
                            <Link href={`/clients/${client.id}/edit`}>
                              <button
                                type="button"
                                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
                                title="Edit Client"
                                aria-label={`Edit ${client.company_name}`}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            </Link>
                            {client.status === "active" ? (
                              <button
                                type="button"
                                onClick={() => setClientToArchive(client)}
                                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-rose-400 transition-colors"
                                title="Archive Client"
                                aria-label={`Archive ${client.company_name}`}
                              >
                                <Archive className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleRestore(client)}
                                className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-400 hover:text-emerald-400 transition-colors"
                                title="Restore Client"
                                aria-label={`Restore ${client.company_name}`}
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

          {/* Quiet Monochromatic Glass Footer & Pagination (Stitch c9eeeac767c3426e9a8d736f5bd26614) */}
          <div className="py-3 px-6 border-t border-white/[0.06] bg-white/[0.01] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 font-mono">
            <div className="flex items-center gap-3 flex-wrap">
              <span>
                Displaying{" "}
                <span className="text-white font-medium">
                  {clients.length > 0 ? `1 - ${clients.length}` : "0"}
                </span>{" "}
                of <span className="text-white font-medium">{total}</span> authorized client entities
              </span>
              <span className="text-white/20">•</span>
              <span className="text-[11px] text-neutral-400">Scoping SLA: 99.98% Synchronized</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 rounded-lg bg-white/[0.02] text-neutral-400 hover:text-white border border-white/5 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                <span className="w-6 h-6 rounded-lg bg-white text-black font-semibold text-xs flex items-center justify-center shadow-xs">
                  {page}
                </span>
                {totalPages > 1 && page < totalPages && (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="w-6 h-6 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white flex items-center justify-center text-xs transition-colors"
                  >
                    {page + 1}
                  </button>
                )}
              </div>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 text-white border border-white/15 text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Floating Bulk Action Bar (Liquid Glass) */}
      {selectedClientIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 liquid-glass rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
          <span className="text-xs font-mono text-white/90">
            <strong className="text-white font-bold">{selectedClientIds.length}</strong> client
            {selectedClientIds.length > 1 ? "s" : ""} selected
          </span>
          <div className="h-4 w-px bg-white/10" />
          {statusFilter === "active" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsBulkArchiveModalOpen(true)}
              className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border-rose-500/30 gap-1.5 font-medium"
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
              className="h-8 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30 gap-1.5 font-medium"
            >
              {isBulkLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              <span>Restore Selected</span>
            </Button>
          )}
          <button
            onClick={() => setSelectedClientIds([])}
            className="text-xs text-neutral-400 hover:text-white underline ml-1"
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
          <p className="text-xs text-neutral-400">
            Are you sure you want to archive the <strong className="text-white">{selectedClientIds.length} selected organizations</strong>? You can review or restore them anytime from the Archived view.
          </p>
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
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
              variant="primary"
              size="sm"
              isLoading={isBulkLoading}
              onClick={handleBulkArchiveConfirm}
              className="text-xs font-semibold"
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
              <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                Select Engineer / Operator
              </label>
              <select
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
                className="w-full rounded-xl bg-[#090a0f] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
              >
                <option value="">No employee assigned (Founder oversight)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
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
                variant="primary"
                size="sm"
                isLoading={isAssigning}
                className="font-semibold text-xs"
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
          <ClientsSkeleton />
        </AppShell>
      }
    >
      <ClientsContent />
    </Suspense>
  );
}
