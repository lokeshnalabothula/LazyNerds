"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Asset } from "@/types/asset";
import { Client } from "@/types/client";
import { AssetFormModal } from "@/components/assets/asset-form-modal";
import { Shield, Plus, CheckCircle, AlertCircle, Loader2, Edit2, Trash2 } from "lucide-react";

interface ClientAssetsTabProps {
  client: Client;
}

export const ClientAssetsTab: React.FC<ClientAssetsTabProps> = ({ client }) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assetToEdit, setAssetToEdit] = useState<Asset | null>(null);

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

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete asset '${name}'?`)) return;
    try {
      await api.deleteAsset(id);
      await fetchAssets();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Register Asset</span>
        </button>
      </div>

      {loading && assets.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-brand-500" />
          <span className="text-xs font-mono">Loading assets...</span>
        </div>
      ) : assets.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
          <Shield className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">No assets registered for this client</p>
          <button
            onClick={() => {
              setAssetToEdit(null);
              setIsModalOpen(true);
            }}
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add target asset now</span>
          </button>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                <th className="py-2.5 px-3 font-semibold">Asset Name & Target</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Criticality</th>
                <th className="py-2.5 px-3 font-semibold">Scope</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">{asset.name}</div>
                    <div className="font-mono text-[11px] text-zinc-500">{asset.target}</div>
                  </td>
                  <td className="py-2.5 px-3 capitalize font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                    {asset.asset_type.replace("_", " ")}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                        asset.criticality === "critical"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border border-zinc-500/20"
                      }`}
                    >
                      {asset.criticality}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {asset.in_scope ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle className="h-3 w-3" /> In Scope
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        <AlertCircle className="h-3 w-3" /> Out of Scope
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setAssetToEdit(asset);
                          setIsModalOpen(true);
                        }}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                        title="Edit Asset"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id, asset.name)}
                        className="p-1 rounded text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400"
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
    </div>
  );
};
