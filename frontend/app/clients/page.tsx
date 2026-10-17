"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ClientForm } from "@/components/clients/client-form";
import { ArchiveDialog } from "@/components/clients/archive-dialog";
import { api } from "@/lib/api";
import { useViewMode } from "@/lib/use-view-mode";
import { Client, ClientCreateInput } from "@/types/client";
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
} from "lucide-react";

function ClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  // Dialog states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState<Client | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

    fetchClients();
  }, [page, search, statusFilter, sortBy, sortOrder, fetchClients]);

  // Handle client creation
  const handleCreateClient = async (data: ClientCreateInput) => {
    const created = await api.createClient(data);
    setIsAddModalOpen(false);
    fetchClients();
    router.push(`/clients/${created.id}`);
  };

  // Handle archive
  const handleArchiveConfirm = async (client: Client) => {
    await api.archiveClient(client.id);
    setClientToArchive(null);
    fetchClients();
  };

  // Handle restore
  const handleRestore = async (client: Client) => {
    try {
      await api.restoreClient(client.id);
      fetchClients();
    } catch (err: any) {
      alert(err.message || "Could not restore client.");
    }
  };

  return (
    <AppShell title="Client Directory">
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Clients
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage client organizations, authorized security points of contact, and communication history.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              onClick={() => setIsAddModalOpen(true)}
              className="gap-1.5 shadow-sm"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              <span>Add Client</span>
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="h-4 w-4 absolute left-3 top-2.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by company, contact, or email..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to page 1 on new search
                }}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Tabs */}
            <div className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-100 dark:bg-zinc-900 text-xs">
              <button
                onClick={() => {
                  setStatusFilter("active");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  statusFilter === "active"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                Active
              </button>
              <button
                onClick={() => {
                  setStatusFilter("archived");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  statusFilter === "archived"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                Archived
              </button>
              <button
                onClick={() => {
                  setStatusFilter("all");
                  setPage(1);
                }}
                className={`px-3 py-1 rounded font-medium transition-colors ${
                  statusFilter === "all"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                All
              </button>
            </div>

            {/* Sort Dropdown */}
            <select
              value={`${sortBy}:${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split(":");
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              aria-label="Sort client records"
              className="px-2.5 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="created_at:desc">Date Added (Newest)</option>
              <option value="created_at:asc">Date Added (Oldest)</option>
              <option value="company_name:asc">Company Name (A-Z)</option>
              <option value="company_name:desc">Company Name (Z-A)</option>
              <option value="updated_at:desc">Recently Updated</option>
            </select>

            {/* View Mode Toggle (Table / Card) */}
            <div
              role="group"
              aria-label="Directory view mode"
              className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-100 dark:bg-zinc-900 text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to list view"
                aria-pressed={viewMode === "table"}
                className={`px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  viewMode === "table"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
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
                className={`px-2.5 py-1.5 rounded font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
            </div>
          </div>
        </div>

        {/* Directory Content Table / Cards */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
              <span className="text-xs font-mono">Loading client directory…</span>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-3 px-4">
              <AlertCircle className="h-7 w-7 text-rose-500 mx-auto" />
              <p className="text-xs text-rose-500 font-medium">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchClients}>
                Retry Request
              </Button>
            </div>
          ) : clients.length === 0 ? (
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
                <Button
                  size="sm"
                  onClick={() => setIsAddModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add First Client</span>
                </Button>
              )}
            </div>
          ) : viewMode === "cards" ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 p-4 space-y-3.5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
                >
                  <div className="space-y-2.5">
                    {/* Header: Company & Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1.5 group/link"
                        >
                          <span className="truncate">{client.company_name}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-0 group-hover/link:opacity-100 transition-opacity text-zinc-400" />
                        </Link>
                        {client.industry && (
                          <span className="text-[11px] text-zinc-400 font-mono block mt-0.5 truncate">
                            {client.industry}
                          </span>
                        )}
                      </div>
                      <Badge variant={client.status === "active" ? "active" : "archived"} className="shrink-0">
                        {client.status === "active" ? "Active" : "Archived"}
                      </Badge>
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-1.5 text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                        <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{client.primary_contact_name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <a
                          href={`mailto:${client.primary_contact_email}`}
                          className="hover:text-brand-500 hover:underline truncate"
                          title={client.primary_contact_email}
                        >
                          {client.primary_contact_email}
                        </a>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                          <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <span className="truncate">{client.phone}</span>
                        </div>
                      )}
                      {client.website && (
                        <div className="flex items-center gap-2 font-mono text-[11px] text-zinc-500">
                          <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                          <a
                            href={client.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-brand-500 hover:underline truncate flex items-center gap-1"
                          >
                            <span className="truncate">{client.website.replace(/^https?:\/\//, "")}</span>
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Timestamps in IST */}
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-2 gap-2 text-[11px] font-mono text-zinc-500">
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">Added (IST)</span>
                        <span className="text-zinc-800 dark:text-zinc-200" title={formatDateTime(client.created_at)}>
                          {formatDate(client.created_at)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-zinc-400 block font-sans">Updated (IST)</span>
                        <span className="text-zinc-800 dark:text-zinc-200" title={formatDateTime(client.updated_at)}>
                          {formatDate(client.updated_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
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
                        className="h-8 px-2.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
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
                        className="h-8 px-2.5 text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"
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
                        className="h-8 px-2.5 text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
                        title="Restore Client"
                        aria-label={`Restore ${client.company_name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-950/60 border-b border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 font-medium select-none">
                  <tr>
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Primary Contact</th>
                    <th className="py-3 px-4">Contact Email</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date Added (IST)</th>
                    <th className="py-3 px-4">Last Updated (IST)</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/80">
                  {clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors group"
                    >
                      {/* Company Name & Link */}
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        <Link
                          href={`/clients/${client.id}`}
                          className="hover:text-brand-600 dark:hover:text-brand-400 font-semibold flex items-center gap-1.5"
                        >
                          <span>{client.company_name}</span>
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
                        </Link>
                        {client.industry && (
                          <span className="text-[11px] text-zinc-400 block font-normal">
                            {client.industry}
                          </span>
                        )}
                      </td>

                      {/* Contact Name */}
                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">
                        {client.primary_contact_name}
                      </td>

                      {/* Contact Email */}
                      <td className="py-3 px-4 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                        {client.primary_contact_email}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <Badge variant={client.status === "active" ? "active" : "archived"}>
                          {client.status === "active" ? "Active" : "Archived"}
                        </Badge>
                      </td>

                      {/* Date Added */}
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]" title={formatDateTime(client.created_at)}>
                        <div className="text-zinc-850 dark:text-zinc-200">{formatDate(client.created_at)}</div>
                        {formatRelativeTime(client.created_at) && (
                          <div className="text-[10px] text-zinc-400 font-sans tracking-tight">
                            {formatRelativeTime(client.created_at)}
                          </div>
                        )}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]" title={formatDateTime(client.updated_at)}>
                        <div className="text-zinc-850 dark:text-zinc-200">{formatDate(client.updated_at)}</div>
                        {formatRelativeTime(client.updated_at) && (
                          <div className="text-[10px] text-zinc-400 font-sans tracking-tight">
                            {formatRelativeTime(client.updated_at)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/clients/${client.id}`}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Open Profile"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                          <Link
                            href={`/clients/${client.id}/edit`}
                            className="p-1 rounded text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            title="Edit Client"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Link>
                          {client.status === "active" ? (
                            <button
                              onClick={() => setClientToArchive(client)}
                              className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Archive Client"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRestore(client)}
                              className="p-1 rounded text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              title="Restore Client"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {total > 0 && (
            <div className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-950/40 text-xs text-zinc-500">
              <div className="font-mono text-[11px]">
                Showing {clients.length} of {total} record{total === 1 ? "" : "s"}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                  disabled={page <= 1}
                  className="h-7 px-2.5 gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>
                <span className="font-mono text-[11px] px-1">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                  disabled={page >= totalPages}
                  className="h-7 px-2.5 gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Client"
        description="Create an organization profile and primary cybersecurity contact point."
        maxWidth="lg"
      >
        <ClientForm
          onSubmit={handleCreateClient}
          onCancel={() => setIsAddModalOpen(false)}
          submitLabel="Create Client"
        />
      </Modal>

      {/* Archive Confirmation Dialog */}
      <ArchiveDialog
        isOpen={!!clientToArchive}
        client={clientToArchive}
        onClose={() => setClientToArchive(null)}
        onConfirm={handleArchiveConfirm}
      />
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

