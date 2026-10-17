"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Finding, FindingCreateInput, FindingStatusType, SeverityType } from "@/types/finding";
import { Engagement } from "@/types/engagement";
import { Asset } from "@/types/asset";
import { Loader2 } from "lucide-react";

interface FindingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  findingToEdit?: Finding | null;
  defaultEngagementId?: string;
  defaultAssetId?: string;
}

export const FindingFormModal: React.FC<FindingFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  findingToEdit,
  defaultEngagementId,
  defaultAssetId,
}) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [engagementId, setEngagementId] = useState(defaultEngagementId || "");
  const [assetId, setAssetId] = useState(defaultAssetId || "");
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<SeverityType>("medium");
  const [cvssScore, setCvssScore] = useState<string>("");
  const [status, setStatus] = useState<FindingStatusType>("open");
  const [cveId, setCveId] = useState("");
  const [description, setDescription] = useState("");
  const [impact, setImpact] = useState("");
  const [remediationGuidance, setRemediationGuidance] = useState("");
  const [evidence, setEvidence] = useState("");
  const [referencesUrl, setReferencesUrl] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      if (findingToEdit) {
        setEngagementId(findingToEdit.engagement_id);
        setAssetId(findingToEdit.asset_id || "");
        setTitle(findingToEdit.title);
        setSeverity(findingToEdit.severity);
        setCvssScore(findingToEdit.cvss_score !== null && findingToEdit.cvss_score !== undefined ? String(findingToEdit.cvss_score) : "");
        setStatus(findingToEdit.status);
        setCveId(findingToEdit.cve_id || "");
        setDescription(findingToEdit.description || "");
        setImpact(findingToEdit.impact || "");
        setRemediationGuidance(findingToEdit.remediation_guidance || "");
        setEvidence(findingToEdit.evidence || "");
        setReferencesUrl(findingToEdit.references_url || "");
        setAssignedTo(findingToEdit.assigned_to || "");
      } else {
        setEngagementId(defaultEngagementId || "");
        setAssetId(defaultAssetId || "");
        setTitle("");
        setSeverity("medium");
        setCvssScore("");
        setStatus("open");
        setCveId("");
        setDescription("");
        setImpact("");
        setRemediationGuidance("");
        setEvidence("");
        setReferencesUrl("");
        setAssignedTo("");
      }
      setError(null);
    }
  }, [isOpen, findingToEdit, defaultEngagementId, defaultAssetId]);

  const loadOptions = async () => {
    try {
      setLoadingOptions(true);
      const [eData, aData] = await Promise.all([
        api.getEngagements({ page_size: 100 }),
        api.getAssets({ page_size: 100 }),
      ]);
      setEngagements(eData.items);
      setAssets(aData.items);
      if (!engagementId && eData.items.length > 0 && !defaultEngagementId) {
        setEngagementId(eData.items[0].id);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !engagementId) {
      setError("Please provide a Title and select an Engagement.");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const parsedCvss = cvssScore ? parseFloat(cvssScore) : undefined;

      if (findingToEdit) {
        await api.updateFinding(findingToEdit.id, {
          title: title.trim(),
          severity,
          cvss_score: parsedCvss,
          status,
          cve_id: cveId.trim() || undefined,
          description: description.trim() || undefined,
          impact: impact.trim() || undefined,
          remediation_guidance: remediationGuidance.trim() || undefined,
          evidence: evidence.trim() || undefined,
          references_url: referencesUrl.trim() || undefined,
          assigned_to: assignedTo.trim() || undefined,
          asset_id: assetId || undefined,
        });
      } else {
        await api.createFinding({
          engagement_id: engagementId,
          asset_id: assetId || undefined,
          title: title.trim(),
          severity,
          cvss_score: parsedCvss,
          status,
          cve_id: cveId.trim() || undefined,
          description: description.trim() || undefined,
          impact: impact.trim() || undefined,
          remediation_guidance: remediationGuidance.trim() || undefined,
          evidence: evidence.trim() || undefined,
          references_url: referencesUrl.trim() || undefined,
          assigned_to: assignedTo.trim() || undefined,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save finding.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={findingToEdit ? "Edit Security Finding" : "Record Discovered Finding"}
      description="Document security vulnerabilities, risk impact, and remediation guidance."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Engagement *
            </label>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              disabled={!!findingToEdit || loadingOptions}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
              required
            >
              <option value="">Select engagement...</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Affected Asset (Optional)
            </label>
            <select
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
            >
              <option value="">None / System Wide</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.target})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Vulnerability Title *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Remote Code Execution via Insecure Deserialization"
            required
          />
        </div>

        {/* Severity, CVSS & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Severity *
            </label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as SeverityType)}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              CVSS v3.1 Score
            </label>
            <Input
              type="number"
              step="0.1"
              min="0.0"
              max="10.0"
              value={cvssScore}
              onChange={(e) => setCvssScore(e.target.value)}
              placeholder="e.g. 9.8"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as FindingStatusType)}
              className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
            >
              <option value="open">Open</option>
              <option value="in_remediation">In Remediation</option>
              <option value="verification_pending">Verification Pending</option>
              <option value="verified_fixed">Verified Fixed</option>
              <option value="accepted_risk">Accepted Risk</option>
              <option value="false_positive">False Positive</option>
            </select>
          </div>
        </div>

        {/* CVE & Assigned To */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              CVE Reference
            </label>
            <Input
              value={cveId}
              onChange={(e) => setCveId(e.target.value)}
              placeholder="e.g. CVE-2024-38077"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Assigned Personnel
            </label>
            <Input
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              placeholder="e.g. lead-analyst@lazynerds.com"
            />
          </div>
        </div>

        {/* Description & Impact */}
        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description & Technical Details
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Detailed vulnerability analysis, parameters, and affected endpoints..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Impact Assessment
          </label>
          <Textarea
            value={impact}
            onChange={(e) => setImpact(e.target.value)}
            placeholder="Confidentiality, Integrity, and Availability threat vectors..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Remediation Guidance
          </label>
          <Textarea
            value={remediationGuidance}
            onChange={(e) => setRemediationGuidance(e.target.value)}
            placeholder="Specific engineering steps to remediate and patch the defect..."
            rows={2}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Replication Evidence / HTTP Payload
          </label>
          <Textarea
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="curl commands, HTTP requests/responses, or proof-of-concept steps..."
            rows={2}
            className="font-mono text-[11px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            {findingToEdit ? "Update Finding" : "Record Finding"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
