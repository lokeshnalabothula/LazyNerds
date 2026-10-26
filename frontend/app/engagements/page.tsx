"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
import { api } from "@/lib/api";
import { useViewMode } from "@/lib/use-view-mode";
import {
  Engagement,
  ASSESSMENT_TYPE_OPTIONS,
  ENGAGEMENT_STATUS_CONFIG,
  AUTHORIZATION_STATUS_CONFIG,
  EngagementStatus,
  AuthorizationStatus,
} from "@/types/engagement";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  ArrowUpDown,
  ExternalLink,
  Edit2,
  Building2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Filter,
  LayoutList,
  LayoutGrid,
  Calendar,
  Shield,
  User,
  Layers,
} from "lucide-react";

function EngagementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL state
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialSearch = searchParams.get("search") || "";
  const initialStatus = searchParams.get("status") || "all";
  const initialType = searchParams.get("assessment_type") || "all";
  const initialAuth = searchParams.get("authorization_status") || "all";
  const initialSortBy = searchParams.get("sort_by") || "created_at";
  const initialSortOrder = searchParams.get("sort_order") || "desc";

  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(initialPage);
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [authFilter, setAuthFilter] = useState(initialAuth);
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortOrder, setSortOrder] = useState(initialSortOrder);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Layout Mode (Cards vs Table) with device-aware screen defaults and saved user preference
  const { viewMode, setViewMode } = useViewMode("fixops_engagement_view_mode", 1024);

  const fetchEngagements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getEngagements({
        page,
        page_size: 10,
        search: search.trim() ? search.trim() : undefined,
        status: statusFilter !== "all" ? statusFilter : undefined,
        assessment_type: typeFilter !== "all" ? typeFilter : undefined,
        authorization_status: authFilter !== "all" ? authFilter : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setEngagements(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      setError(err.message || "Failed to load engagements from database.");
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, typeFilter, authFilter, sortBy, sortOrder]);

  // Sync URL parameters
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", page.toString());
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter !== "all") params.set("assessment_type", typeFilter);
    if (authFilter !== "all") params.set("authorization_status", authFilter);
    if (sortBy !== "created_at") params.set("sort_by", sortBy);
    if (sortOrder !== "desc") params.set("sort_order", sortOrder);

    const newQuery = params.toString();
    const targetUrl = `/engagements${newQuery ? `?${newQuery}` : ""}`;
    window.history.replaceState(null, "", targetUrl);
  }, [page, search, statusFilter, typeFilter, authFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchEngagements();
  }, [fetchEngagements]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const handleTypeFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };

  const handleAuthFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setAuthFilter(e.target.value);
    setPage(1);
  };

  const handleSortChange = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setAuthFilter("all");
    setSortBy("created_at");
    setSortOrder("desc");
    setPage(1);
  };

  const isFiltered =
    Boolean(search.trim()) ||
    statusFilter !== "all" ||
    typeFilter !== "all" ||
    authFilter !== "all";

  return (
    <AppShell title="Engagements">
      <div className="space-y-6">
        {/* Page Header (Stitch Obsidian Precision) */}
        <div className="cockpit-card specular-top border-[#222630] bg-[#111318]/90 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border border-[#F5C518]/40 bg-[#161920] shadow-[0_2px_12px_rgba(245,197,24,0.15)] flex items-center justify-center shrink-0 text-[#F5C518]">
              <Layers className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F9FAFB] font-sans">
                  Security Audits &amp; Engagements
                </h1>
                <span className="badge-cyber bg-[#F5C518]/15 text-[#FFD84D] border-[#F5C518]/30 text-[10px] font-mono">
                  Continuous Operations
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-2xl">
                Penetration testing &amp; security assessments — Scoping parameters, rules of engagement (RoE), and lead assessor assignments.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link href="/engagements/new">
              <Button variant="primary" size="sm" className="gap-1.5 text-xs h-9 px-4 font-bold shadow-md">
                <Plus className="h-3.5 w-3.5" />
                <span>Create Engagement</span>
              </Button>
            </Link>
          </div>
        </div>
        {/* Search, Filter, Sort and Layout Controls */}
        <div className="cockpit-card specular-top p-4 shadow-md flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-[#6B7280]" />
              <Input
                value={search}
                onChange={handleSearchChange}
                placeholder="Search by engagement title, scope, or client company..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* View Mode Toggle */}
            <div
              className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-[#161920] rounded-lg border border-zinc-200 dark:border-[#222630] self-start sm:self-auto shrink-0"
              role="group"
              aria-label="View layout toggle"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
                title="Switch to Card View"
                aria-label="Switch to card view"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
                title="Switch to List View"
                aria-label="Switch to list view"
                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#FFD84D] shadow-xs font-semibold"
                    : "text-zinc-600 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB]"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs">
            <span className="text-zinc-400 flex items-center gap-1 text-[11px] font-medium mr-1">
              <Filter className="h-3.5 w-3.5" />
              Filters:
            </span>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-md px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="all">All Statuses</option>
              {Object.entries(ENGAGEMENT_STATUS_CONFIG).map(([val, cfg]) => (
                <option key={val} value={val} className="bg-[#07090E] text-slate-200">
                  {cfg.label}
                </option>
              ))}
            </select>

            {/* Assessment Type Filter */}
            <select
              value={typeFilter}
              onChange={handleTypeFilterChange}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-md px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="all">All Assessment Types</option>
              {ASSESSMENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#07090E] text-slate-200">
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Authorization Filter */}
            <select
              value={authFilter}
              onChange={handleAuthFilterChange}
              className="h-8 rounded-lg border border-white/[0.08] bg-white/[0.04] backdrop-blur-md px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="all">All Written Authorizations</option>
              {Object.entries(AUTHORIZATION_STATUS_CONFIG).map(([val, cfg]) => (
                <option key={val} value={val} className="bg-[#07090E] text-slate-200">
                  {cfg.label}
                </option>
              ))}
            </select>

            {isFiltered && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline ml-auto font-medium"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => fetchEngagements()}>
              Retry
            </Button>
          </div>
        )}

        {/* Content Body */}
        <div data-loading-state={isLoading ? "loading" : "complete"}>
        {isLoading ? (
          viewMode === "cards" ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className="rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] overflow-hidden shadow-xs">
              <TableSkeleton rows={5} cols={6} />
            </div>
          )
        ) : engagements.length === 0 ? (
          <div className="py-16 px-4 text-center border border-dashed border-zinc-200 dark:border-[#222630] rounded-xl space-y-3">
            <Layers className="h-8 w-8 mx-auto text-zinc-400 opacity-60" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                {isFiltered ? "No matching engagements found" : "No engagements registered yet"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] max-w-sm mx-auto">
                {isFiltered
                  ? "Try adjusting your search criteria or resetting the applied filters."
                  : "Launch a penetration test or security assessment by linking an active client."}
              </p>
            </div>
            {isFiltered ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear Filters
              </Button>
            ) : (
              <Link href="/engagements/new">
                <Button size="sm" className="btn-glossy-gold text-[#111318] font-bold border-none shadow-md">
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create First Engagement
                </Button>
              </Link>
            )}
          </div>
        ) : viewMode === "cards" ? (
          /* Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {engagements.map((eng) => {
              const statusCfg =
                ENGAGEMENT_STATUS_CONFIG[eng.status as EngagementStatus] ||
                ENGAGEMENT_STATUS_CONFIG.draft;
              const authCfg =
                AUTHORIZATION_STATUS_CONFIG[eng.authorization_status as AuthorizationStatus] ||
                AUTHORIZATION_STATUS_CONFIG.not_confirmed;

              return (
                <div
                  key={eng.id}
                  className="cockpit-card cockpit-card-interactive specular-top p-5 shadow-md flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Client & Status Badge */}
                    <div className="flex items-center justify-between gap-2.5 min-w-0 w-full">
                      <Link
                        href={`/clients/${eng.client_id}`}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B88700] dark:text-[#FFD84D] hover:underline min-w-0 flex-1"
                        title={eng.client_company_name || "Client Profile"}
                      >
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
                        <span className="truncate">{eng.client_company_name || "Unknown Client"}</span>
                      </Link>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border shrink-0 ${statusCfg.badgeClass}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                        <span>{statusCfg.label}</span>
                      </span>
                    </div>

                    {/* Engagement Title */}
                    <div>
                      <Link
                        href={`/engagements/${eng.id}`}
                        className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-brand-500 line-clamp-1"
                        title={eng.name}
                      >
                        {eng.name}
                      </Link>
                      <p className="text-xs text-zinc-500 font-medium mt-0.5">
                        {eng.assessment_type}
                      </p>
                    </div>

                    {/* Authorization Status Badge */}
                    <div className="pt-1">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${authCfg.badgeClass}`}
                      >
                        <Shield className="h-3 w-3 shrink-0" />
                        {authCfg.label}
                      </span>
                    </div>

                    {/* Dates & Assignment */}
                    <div className="space-y-1.5 text-xs text-zinc-500 pt-2 border-t border-white/[0.06]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="font-sans text-xs text-slate-300">
                          {eng.start_date ? formatDate(eng.start_date) : "Start unset"} →{" "}
                          {eng.due_date ? formatDate(eng.due_date) : "Due unset"}
                        </span>
                      </div>
                      {eng.assigned_to && (
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate text-xs font-sans text-slate-400">
                            {eng.assigned_to}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <Link
                      href={`/engagements/${eng.id}`}
                      className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
                    >
                      <span>View details</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>

                    <Link href={`/engagements/${eng.id}/edit`}>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                        <Edit2 className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="cockpit-card specular-top overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] backdrop-blur-md border-b border-white/[0.08] text-slate-400 font-medium text-xs">
                  <tr>
                    <th
                      className="py-3 px-4 min-w-[160px] cursor-pointer hover:text-zinc-900 dark:hover:text-[#F9FAFB] transition-colors"
                      onClick={() => handleSortChange("name")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Engagement</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-4 min-w-[140px] cursor-pointer hover:text-zinc-900 dark:hover:text-[#F9FAFB] transition-colors"
                      onClick={() => handleSortChange("client_company_name")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Client</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[120px]">Assessment Type</th>
                    <th
                      className="py-3 px-4 min-w-[110px] cursor-pointer hover:text-zinc-900 dark:hover:text-[#F9FAFB] transition-colors"
                      onClick={() => handleSortChange("status")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Status</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[130px]">Written Authorization</th>
                    <th
                      className="py-3 px-4 min-w-[140px] cursor-pointer hover:text-zinc-900 dark:hover:text-[#F9FAFB] transition-colors"
                      onClick={() => handleSortChange("start_date")}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>Schedule</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </div>
                    </th>
                    <th className="py-3 pl-4 pr-6 text-right min-w-[120px] whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#222630]/60">
                  {engagements.map((eng) => {
                    const statusCfg =
                      ENGAGEMENT_STATUS_CONFIG[eng.status as EngagementStatus] ||
                      ENGAGEMENT_STATUS_CONFIG.draft;
                    const authCfg =
                      AUTHORIZATION_STATUS_CONFIG[eng.authorization_status as AuthorizationStatus] ||
                      AUTHORIZATION_STATUS_CONFIG.not_confirmed;

                    return (
                      <tr
                        key={eng.id}
                        className="hover:bg-zinc-50/60 dark:hover:bg-white/[0.04] transition-colors"
                      >
                        <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                          <Link
                            href={`/engagements/${eng.id}`}
                            className="hover:text-brand-500 hover:underline block max-w-xs truncate"
                            title={eng.name}
                          >
                            {eng.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/clients/${eng.client_id}`}
                            className="text-[#B88700] dark:text-[#FFD84D] hover:underline flex items-center gap-1 max-w-[180px] truncate"
                          >
                            <Building2 className="h-3 w-3 shrink-0 text-[#F5C518]" />
                            <span className="truncate">{eng.client_company_name || "Unknown"}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400">
                          {eng.assessment_type}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.badgeClass}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${authCfg.badgeClass}`}
                          >
                            <Shield className="h-3 w-3 shrink-0" />
                            {authCfg.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                          {eng.start_date ? formatDate(eng.start_date) : "—"} →{" "}
                          {eng.due_date ? formatDate(eng.due_date) : "—"}
                        </td>
                        <td className="py-3 pl-4 pr-6 text-right min-w-[120px] whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-2 pr-1">
                            <Link href={`/engagements/${eng.id}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs">
                                Details
                              </Button>
                            </Link>
                            <Link href={`/engagements/${eng.id}/edit`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                            </Link>
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

        {/* Pagination Bar */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2 text-xs text-zinc-500">
            <span>
              Showing {engagements.length} of {total} engagements (Page {page} of {totalPages})
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 w-8 p-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 w-8 p-0"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function EngagementsPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Engagements">
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <span className="text-xs font-mono">Loading Engagements Workspace...</span>
          </div>
        </AppShell>
      }
    >
      <EngagementsContent />
    </Suspense>
  );
}
