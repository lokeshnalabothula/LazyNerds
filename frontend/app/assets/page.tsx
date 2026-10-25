"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Asset } from "@/types/asset";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { Button } from "@/components/ui/button";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useViewMode } from "@/lib/use-view-mode";
import { formatDateTime } from "@/lib/utils";
import {
  Shield,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  ExternalLink,
  Loader2,
  AlertCircle,
  CheckCircle,
  LayoutList,
  LayoutGrid,
  Globe,
  Server,
  Layers,
  Building2,
} from "lucide-react";

export default function AssetsPage() {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Device-aware view mode preference (Cards on mobile/tablet, Table on desktop)
  const { viewMode, setViewMode } = useViewMode("fixops_asset_view_mode", 1024);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const data = await api.getAssets({
        search: search || undefined,
        asset_type: typeFilter || undefined,
        in_scope: scopeFilter ? scopeFilter === "true" : undefined,
        criticality: criticalityFilter || undefined,
        page_size: 100,
      });
      setAssets(data.items);
      setTotal(data.total);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchAssets, 200);
    return () => clearTimeout(timer);
  }, [search, typeFilter, scopeFilter, criticalityFilter]);

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAsset(assetToDelete.id);
      toast.success(`Target asset '${assetToDelete.name}' has been deleted.`);
      setAssetToDelete(null);
      await fetchAssets();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const getCriticalityBadge = (crit: string) => {
    switch (crit) {
      case "critical":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "high":
        return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
      case "medium":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      default:
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
  };

  // Calculate stats
  const inScopeCount = assets.filter((a) => a.in_scope).length;
  const criticalCount = assets.filter((a) => a.criticality === "critical" || a.criticality === "high").length;
  const outOfScopeCount = assets.filter((a) => !a.in_scope).length;

  return (
    <AppShell title="Asset & Scope Management">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-sans">
              Target Assets & Scope Boundaries
            </h1>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1 leading-relaxed">
              Authorized digital infrastructure, web applications, APIs, and scope enforcement rules.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setAssetToEdit(null);
              setIsModalOpen(true);
            }}
            className="text-xs h-9 gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register Asset</span>
          </Button>
        </div>

        {/* KPI Stat Chips */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="telemetry-card cockpit-card-interactive specular-top p-3.5 sm:p-4 shadow-md">
            <div className="text-[11px] font-sans uppercase tracking-wider text-zinc-500 dark:text-[#94A3B8] font-semibold">
              Total Assets
            </div>
            <div className="text-xl sm:text-2xl font-bold font-sans text-zinc-900 dark:text-[#F9FAFB] mt-1 tracking-tight tabular-nums">
              {total}
            </div>
          </div>
          <div className="telemetry-card cockpit-card-interactive specular-top p-3.5 sm:p-4 shadow-md">
            <div className="text-[11px] font-sans uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
              In-Scope (Approved)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-sans text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight tabular-nums">
              {inScopeCount}
            </div>
          </div>
          <div className="telemetry-card cockpit-card-interactive specular-top p-3.5 sm:p-4 shadow-md">
            <div className="text-[11px] font-sans uppercase tracking-wider text-rose-500 dark:text-[#F43F5E] font-semibold">
              Critical & High Impact
            </div>
            <div className="text-xl sm:text-2xl font-bold font-sans text-rose-500 dark:text-[#F43F5E] mt-1 tracking-tight tabular-nums">
              {criticalCount}
            </div>
          </div>
          <div className="telemetry-card cockpit-card-interactive specular-top p-3.5 sm:p-4 shadow-md">
            <div className="text-[11px] font-sans uppercase tracking-wider text-amber-500 dark:text-[#FBBF24] font-semibold">
              Out-of-Scope (Restricted)
            </div>
            <div className="text-xl sm:text-2xl font-bold font-sans text-amber-500 dark:text-[#FBBF24] mt-1 tracking-tight tabular-nums">
              {outOfScopeCount}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="cockpit-card specular-top p-3.5 sm:p-4 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-md">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-[#9CA3AF]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by name or target URL/IP..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#9CA3AF]/60 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-label="Filter by asset type"
            >
              <option value="">All Types</option>
              <option value="web_application">Web App</option>
              <option value="api">API</option>
              <option value="domain">Domain</option>
              <option value="ip_address">IP Address</option>
              <option value="cloud_resource">Cloud Resource</option>
            </select>

            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-label="Filter by scope status"
            >
              <option value="">All Scopes</option>
              <option value="true">In-Scope Only</option>
              <option value="false">Out-of-Scope (Restricted)</option>
            </select>

            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] min-h-[36px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-label="Filter by asset criticality"
            >
              <option value="">All Criticalities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* View Mode Toggle */}
            <div
              role="group"
              aria-label="Asset directory view mode"
              className="inline-flex rounded-lg border border-zinc-200 dark:border-[#222630] p-0.5 bg-zinc-100 dark:bg-[#161920] text-xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                aria-label="Switch to card view"
                aria-pressed={viewMode === "cards"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "cards"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#F9FAFB] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                aria-label="Switch to list view"
                aria-pressed={viewMode === "table"}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 min-h-[34px] focus:outline-none focus:ring-2 focus:ring-[#F5C518] ${
                  viewMode === "table"
                    ? "bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#F9FAFB] shadow-xs font-semibold"
                    : "text-zinc-500 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-zinc-200"
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Assets List */}
        <div data-loading-state={loading && assets.length === 0 ? "loading" : "complete"}>
        {loading && assets.length === 0 ? (
          viewMode === "cards" ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              <TableSkeleton rows={5} cols={6} />
            </div>
          )
        ) : assets.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30" data-empty="true">
            <Shield className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No assets registered yet</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto leading-relaxed">
              Add your target domains, IP ranges, APIs, and web apps to enable automated scans and vulnerability tracking.
            </p>
            <button
              onClick={() => {
                setAssetToEdit(null);
                setIsModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg btn-glossy-gold text-xs font-bold min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Register First Asset</span>
            </button>
          </div>
        ) : viewMode === "cards" ? (
          /* Responsive Cards View (Default on Mobile) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="cockpit-card cockpit-card-interactive specular-top p-5 shadow-md flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-[#F9FAFB] text-sm truncate">
                        {asset.name}
                      </div>
                      <div className="font-mono text-xs text-zinc-500 dark:text-[#9CA3AF] break-all mt-0.5">
                        {asset.target}
                      </div>
                    </div>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border shrink-0 ${getCriticalityBadge(
                        asset.criticality
                      )}`}
                    >
                      {asset.criticality}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-zinc-100 dark:border-[#222630] space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 dark:text-[#9CA3AF]">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Organization:</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                        {asset.client_company_name || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-[#9CA3AF]">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Engagement:</span>
                      <span className="truncate max-w-[180px]">
                        {asset.engagement_name || "Unassigned"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-[#9CA3AF]">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Type:</span>
                      <span className="capitalize font-mono text-[11px]">
                        {asset.asset_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-[#222630] flex items-center justify-between gap-2">
                  <div>
                    {asset.in_scope ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span>In Scope</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span>Out of Scope</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setAssetToEdit(asset);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center transition-colors"
                      title="Edit Asset"
                      aria-label={`Edit asset ${asset.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setAssetToDelete({ id: asset.id, name: asset.name })}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center transition-colors"
                      title="Delete Asset"
                      aria-label={`Delete asset ${asset.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Table View (Default on Desktop) */
          <div className="cockpit-card specular-top rounded-xl overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04] backdrop-blur-md text-slate-300 font-sans text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 min-w-[200px] font-semibold">Asset Name & Target</th>
                    <th className="py-2.5 px-3 min-w-[180px] font-semibold">Client & Engagement</th>
                    <th className="py-2.5 px-3 min-w-[110px] font-semibold">Type</th>
                    <th className="py-2.5 px-3 min-w-[100px] font-semibold">Criticality</th>
                    <th className="py-2.5 px-3 min-w-[120px] font-semibold">Scope Status</th>
                    <th className="py-2.5 pl-3 pr-6 font-semibold text-right min-w-[110px] whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#222630]">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-zinc-50 dark:hover:bg-[#161920]/60 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                          {asset.name}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500 dark:text-[#9CA3AF] truncate max-w-xs">
                          {asset.target}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-zinc-800 dark:text-zinc-200">
                          {asset.client_company_name || "Client"}
                        </div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {asset.engagement_name || "No engagement linked"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize text-zinc-600 dark:text-[#9CA3AF] font-mono text-[11px]">
                          {asset.asset_type.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border ${getCriticalityBadge(
                            asset.criticality
                          )}`}
                        >
                          {asset.criticality}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {asset.in_scope ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>In Scope</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <AlertCircle className="h-3.5 w-3.5" />
                            <span>Out of Scope</span>
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 pr-6 text-right min-w-[110px] whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2 pr-1">
                          <button
                            onClick={() => {
                              setAssetToEdit(asset);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center transition-colors"
                            title="Edit Asset"
                            aria-label={`Edit asset ${asset.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setAssetToDelete({ id: asset.id, name: asset.name })}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-[#161920] min-h-[34px] min-w-[34px] flex items-center justify-center transition-colors"
                            title="Delete Asset"
                            aria-label={`Delete asset ${asset.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>

        <AssetFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={fetchAssets}
          assetToEdit={assetToEdit}
        />

        <ConfirmDialog
          isOpen={Boolean(assetToDelete)}
          onClose={() => setAssetToDelete(null)}
          onConfirm={handleDeleteConfirm}
          title="Delete Target Asset"
          description={`Are you sure you want to delete asset '${assetToDelete?.name}'? This cannot be undone.`}
          confirmLabel="Delete Asset"
          variant="destructive"
          loading={isDeleting}
        />
      </div>
    </AppShell>
  );
}
