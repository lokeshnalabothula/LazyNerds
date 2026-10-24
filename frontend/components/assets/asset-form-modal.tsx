"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { api } from "@/lib/api";
import { Asset, AssetCreateInput, AssetType, CriticalityType, EnvironmentType } from "@/types/asset";
import { Client } from "@/types/client";
import { Engagement } from "@/types/engagement";
import { Loader2 } from "lucide-react";

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  assetToEdit?: Asset | null;
  defaultClientId?: string;
  defaultEngagementId?: string;
}

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  assetToEdit,
  defaultClientId,
  defaultEngagementId,
}) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(defaultClientId || "");
  const [engagementId, setEngagementId] = useState(defaultEngagementId || "");
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>("web_application");
  const [target, setTarget] = useState("");
  const [environment, setEnvironment] = useState<EnvironmentType>("production");
  const [criticality, setCriticality] = useState<CriticalityType>("medium");
  const [inScope, setInScope] = useState(true);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (assetToEdit) {
        setClientId(assetToEdit.client_id);
        setEngagementId(assetToEdit.engagement_id || "");
        setName(assetToEdit.name);
        setAssetType(assetToEdit.asset_type);
        setTarget(assetToEdit.target);
        setEnvironment(assetToEdit.environment);
        setCriticality(assetToEdit.criticality);
        setInScope(assetToEdit.in_scope);
        setNotes(assetToEdit.notes || "");
      } else {
        setClientId(defaultClientId || "");
        setEngagementId(defaultEngagementId || "");
        setName("");
        setAssetType("web_application");
        setTarget("");
        setEnvironment("production");
        setCriticality("medium");
        setInScope(true);
        setNotes("");
      }
      setError(null);
    }
  }, [isOpen, assetToEdit, defaultClientId, defaultEngagementId]);

  const loadOptions = async () => {
    try {
      setLoadingOptions(true);
      const [cData, eData] = await Promise.all([
        api.getClients({ page_size: 100 }),
        api.getEngagements({ page_size: 100 }),
      ]);
      setClients(cData.items);
      setEngagements(eData.items);
      if (!clientId && cData.items.length > 0 && !defaultClientId) {
        setClientId(cData.items[0].id);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !target.trim() || !clientId) {
      setError("Please fill in all required fields (Client, Asset Name, Target).");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (assetToEdit) {
        await api.updateAsset(assetToEdit.id, {
          name: name.trim(),
          asset_type: assetType,
          target: target.trim(),
          environment,
          criticality,
          in_scope: inScope,
          engagement_id: engagementId || null,
          notes: notes.trim() || null,
        });
      } else {
        await api.createAsset({
          client_id: clientId,
          engagement_id: engagementId || null,
          name: name.trim(),
          asset_type: assetType,
          target: target.trim(),
          environment,
          criticality,
          in_scope: inScope,
          notes: notes.trim() || null,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save asset.");
    } finally {
      setSaving(false);
    }
  };

  const filteredEngagements = clientId
    ? engagements.filter((e) => e.client_id === clientId)
    : engagements;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={assetToEdit ? "Edit Digital Asset" : "Register Target Asset"}
      description="Register in-scope or boundary assets for vulnerability assessment and verification."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Client Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Client Organization *
            </label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setEngagementId("");
              }}
              disabled={!!assetToEdit || loadingOptions}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              required
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Engagement Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Linked Engagement (Optional)
            </label>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="">None / Platform Asset</option>
              {filteredEngagements.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Asset Name & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Asset Name *
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Payment Gateway API"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Asset Type *
            </label>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value as AssetType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="web_application">Web Application</option>
              <option value="api">API Endpoint</option>
              <option value="domain">Domain / Hostname</option>
              <option value="ip_address">IP Address</option>
              <option value="cloud_resource">Cloud Resource</option>
              <option value="network_range">Network CIDR Range</option>
            </select>
          </div>
        </div>

        {/* Target URL / IP */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
            Target URL / Host / IP *
          </label>
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. https://api.client.com or 10.0.4.15"
            required
          />
        </div>

        {/* Environment, Criticality & Scope */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Criticality
            </label>
            <select
              value={criticality}
              onChange={(e) => setCriticality(e.target.value as CriticalityType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Scope Boundary
            </label>
            <select
              value={inScope ? "true" : "false"}
              onChange={(e) => setInScope(e.target.value === "true")}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="true">In-Scope (Approved)</option>
              <option value="false">Out-of-Scope (Restricted)</option>
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
            Scoping & Verification Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Confidential scoping boundaries, testing windows, or credentials..."
            rows={2}
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#222630]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="border-zinc-200 dark:border-[#222630]">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving} className="btn-glossy-gold font-bold">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {assetToEdit ? "Update Asset" : "Register Asset"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
