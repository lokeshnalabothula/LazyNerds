"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Asset } from "@/types/asset";
import { Client } from "@/types/client";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Shield, Plus, CheckCircle, AlertCircle, Loader2, Edit2, Trash2 } from "lucide-react";

interface ClientAssetsTabProps {
  client: Client;
}

export const ClientAssetsTab: React.FC<ClientAssetsTabProps> = ({ client }) => {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const data = await api.getAssets({ client_id: client.id, page_size: 100 });
      setAssets(data.items);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, [client.id]);

  const handleDeleteConfirm = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      await api.deleteAsset(assetToDelete.id);
      toast.success(`Target asset '${assetToDelete.name}' deleted.`);
      setAssetToDelete(null);
      await fetchAssets();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
            Client Infrastructure & Target Assets ({assets.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Registered endpoints, web apps, domains, and scope boundaries for {client.company_name}.
          </p>
        </div>

        <button
          onClick={() => {
            setAssetToEdit(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F5C518] hover:bg-[#FFD84D] active:bg-[#DDAA07] text-[#111318] text-xs font-semibold transition-colors shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Asset</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-[#F5C518]" />
        </div>
      ) : assets.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-500 text-xs">
          <Shield className="h-6 w-6 text-zinc-400 mx-auto mb-2 opacity-50" />
          <p className="font-medium text-zinc-700 dark:text-zinc-300">No authorized assets defined</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Register domains or IP targets for vulnerability assessment.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-zinc-900/60 shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500">
              <tr>
                <th className="px-3.5 py-2.5 font-medium">Asset Name</th>
                <th className="px-3.5 py-2.5 font-medium">Type</th>
                <th className="px-3.5 py-2.5 font-medium">Target / Value</th>
                <th className="px-3.5 py-2.5 font-medium">Scope Status</th>
                <th className="px-3.5 py-2.5 font-medium">Criticality</th>
                <th className="px-3.5 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-3.5 py-2.5 font-medium text-zinc-900 dark:text-zinc-100">
                    {asset.name}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-zinc-500 uppercase">
                    {asset.asset_type}
                  </td>
                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                    {asset.target}
                  </td>
                  <td className="px-3.5 py-2.5">
                    {asset.in_scope ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle className="h-3 w-3" />
                        <span>In Scope</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400">
                        <AlertCircle className="h-3 w-3" />
                        <span>Excluded</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        asset.criticality === "critical"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : asset.criticality === "high"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {asset.criticality}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setAssetToEdit(asset);
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                        title="Edit Asset"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setAssetToDelete({ id: asset.id, name: asset.name })}
                        className="p-1 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                        title="Delete Asset"
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
      )}

      <AssetFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchAssets}
        defaultClientId={client.id}
        assetToEdit={assetToEdit}
      />

      <ConfirmDialog
        isOpen={Boolean(assetToDelete)}
        onClose={() => setAssetToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Target Asset"
        description={`Are you sure you want to delete asset '${assetToDelete?.name}' from this client? This cannot be undone.`}
        confirmLabel="Delete Asset"
        variant="destructive"
        loading={isDeleting}
      />
    </div>
  );
};
