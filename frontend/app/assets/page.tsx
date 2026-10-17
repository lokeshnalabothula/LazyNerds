"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Asset } from "@/types/asset";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { TableSkeleton, CardGridSkeleton } from "@/components/ui/loading";
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
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);

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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete asset '${name}'? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteAsset(id);
      await fetchAssets();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
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

  return (
    <AppShell title="Asset & Scope Management">
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 font-mono">
              Target Assets & Scope Boundaries
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
              Authorized digital infrastructure, web applications, APIs, and scope enforcement rules.
            </p>
          </div>

          <button
            onClick={() => {
              setAssetToEdit(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs shrink-0 min-h-[36px]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register Asset</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets by name or target URL/IP..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 min-h-[36px]"
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
              className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 min-h-[36px]"
              aria-label="Filter by scope status"
            >
              <option value="">All Scopes</option>
              <option value="true">In-Scope Only</option>
              <option value="false">Out-of-Scope (Restricted)</option>
            </select>

            <select
              value={criticalityFilter}
              onChange={(e) => setCriticalityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 min-h-[36px]"
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
              className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-800 p-0.5 bg-zinc-100 dark:bg-zinc-900 text-xs shrink-0"
            >
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
            </div>
          </div>
        </div>

        {/* Assets List */}
        {loading && assets.length === 0 ? (
          viewMode === "cards" ? (
            <CardGridSkeleton count={6} />
          ) : (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
              <TableSkeleton rows={5} cols={6} />
            </div>
          )
        ) : assets.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/30">
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
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium min-h-[36px]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Register First Asset</span>
            </button>
          </div>
        ) : viewMode === "cards" ? (
          /* Responsive Cards View (Default on Mobile) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-4 sm:p-5 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm truncate">
                        {asset.name}
                      </div>
                      <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400 break-all mt-0.5">
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

                  <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-[11px] text-zinc-400">Organization:</span>
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[180px]">
                        {asset.client_company_name || "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-[11px] text-zinc-400">Engagement:</span>
                      <span className="truncate max-w-[180px]">
                        {asset.engagement_name || "Unassigned"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span className="text-[11px] text-zinc-400">Type:</span>
                      <span className="capitalize font-mono text-[11px]">
                        {asset.asset_type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-2">
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
                      className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
                      title="Edit Asset"
                      aria-label={`Edit asset ${asset.name}`}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.id, asset.name)}
                      className="p-1.5 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
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
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                    <th className="py-2.5 px-3 font-semibold">Asset Name & Target</th>
                    <th className="py-2.5 px-3 font-semibold">Client & Engagement</th>
                    <th className="py-2.5 px-3 font-semibold">Type</th>
                    <th className="py-2.5 px-3 font-semibold">Criticality</th>
                    <th className="py-2.5 px-3 font-semibold">Scope Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {asset.name}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-500 truncate max-w-xs">
                          {asset.target}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-zinc-800 dark:text-zinc-200">
                          {asset.client_company_name || "Client"}
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {asset.engagement_name || "No engagement linked"}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="capitalize text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
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
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setAssetToEdit(asset);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
                            title="Edit Asset"
                            aria-label={`Edit asset ${asset.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id, asset.name)}
                            className="p-1.5 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 min-h-[34px] min-w-[34px] flex items-center justify-center"
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

        <AssetFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSaved={fetchAssets}
          assetToEdit={assetToEdit}
        />
      </div>
    </AppShell>
  );
}
