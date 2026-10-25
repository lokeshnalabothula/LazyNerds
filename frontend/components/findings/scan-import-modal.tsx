"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Engagement } from "@/types/engagement";
import { Asset } from "@/types/asset";
import { Loader2, Terminal, ShieldAlert } from "lucide-react";

interface ScanImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
  defaultEngagementId?: string;
}

export const ScanImportModal: React.FC<ScanImportModalProps> = ({
  isOpen,
  onClose,
  onImported,
  defaultEngagementId,
}) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [engagementId, setEngagementId] = useState(defaultEngagementId || "");
  const [toolName, setToolName] = useState("nuclei");
  const [targetAssetId, setTargetAssetId] = useState("");
  const [scanData, setScanData] = useState("");
  const [autoCreateFindings, setAutoCreateFindings] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      setEngagementId(defaultEngagementId || "");
      setTargetAssetId("");
      setScanData("");
      setError(null);
    }
  }, [isOpen, defaultEngagementId]);

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

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementId || !scanData.trim()) {
      setError("Please select an engagement and provide scan output.");
      return;
    }

    // Check scope before sending
    if (targetAssetId) {
      const selectedAsset = assets.find((a) => a.id === targetAssetId);
      if (selectedAsset && !selectedAsset.in_scope) {
        setError(
          `Scope violation: Asset '${selectedAsset.name}' is marked out-of-scope. Cannot target out-of-scope assets.`
        );
        return;
      }
    }

    try {
      setImporting(true);
      setError(null);

      await api.importScan({
        engagement_id: engagementId,
        tool_name: toolName,
        target_asset_id: targetAssetId || null,
        scan_data: scanData.trim(),
        auto_create_findings: autoCreateFindings,
      });

      onImported();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to process scan adapter output.");
    } finally {
      setImporting(false);
    }
  };

  const selectedAsset = assets.find((a) => a.id === targetAssetId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automated Assessment Scan Adapter"
      description="Import or dispatch scanner output (Nuclei, Nmap, or structured assessment JSON) to ingest verified findings."
      maxWidth="lg"
    >
      <form onSubmit={handleImport} className="space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Target Engagement *
            </label>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#111318] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
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
              Assessment Tool Adapter *
            </label>
            <select
              value={toolName}
              onChange={(e) => setToolName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#111318] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
            >
              <option value="nuclei">Nuclei (Vulnerability Scanner JSON/NDJSON)</option>
              <option value="nmap">Nmap (Service & Port Enumeration)</option>
              <option value="owasp_zap">OWASP ZAP (Web Application Findings)</option>
              <option value="semgrep">Semgrep / Code Audit</option>
              <option value="generic_json">Standard Structured Security JSON</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Associated In-Scope Target Asset (Optional)
          </label>
          <select
            value={targetAssetId}
            onChange={(e) => setTargetAssetId(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#111318] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
          >
            <option value="">None / General Engagement Target</option>
            {assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.target}) {a.in_scope ? "[IN-SCOPE]" : "[OUT-OF-SCOPE - RESTRICTED]"}
              </option>
            ))}
          </select>

          {selectedAsset && !selectedAsset.in_scope && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-rose-500 font-medium">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>Warning: This asset is out-of-scope. Scanning will be rejected.</span>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Raw Scanner Output / JSON Stream *
            </label>
            <button
              type="button"
              onClick={() => {
                if (toolName === "nuclei") {
                  setScanData(
                    JSON.stringify(
                      {
                        "template-id": "cve-2024-43451",
                        info: {
                          name: "NTLM Hash Disclosure Vulnerability",
                          severity: "high",
                          classification: { "cve-id": ["CVE-2024-43451"], "cvss-score": 8.8 },
                          description: "Remote unauthenticated NTLM hash disclosure in web component.",
                          remediation: "Apply vendor security patch KB5044284 immediately.",
                        },
                        "matched-at": "https://api.acme.com/v1/auth",
                        "curl-command": "curl -X GET https://api.acme.com/v1/auth/exchange",
                      },
                      null,
                      2
                    )
                  );
                } else {
                  setScanData(
                    JSON.stringify(
                      [
                        { port: 443, service: "https", state: "open", protocol: "tcp" },
                        { port: 8443, service: "alt-https", state: "open", protocol: "tcp" },
                      ],
                      null,
                      2
                    )
                  );
                }
              }}
              className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline"
            >
              Insert example payload
            </button>
          </div>
          <Textarea
            value={scanData}
            onChange={(e) => setScanData(e.target.value)}
            placeholder='Paste JSON array or newline-delimited JSON output from scanner...'
            rows={6}
            className="font-mono text-xs"
            required
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="autoCreateFindings"
            checked={autoCreateFindings}
            onChange={(e) => setAutoCreateFindings(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700 text-brand-600 focus:ring-brand-500 h-4 w-4"
          />
          <label htmlFor="autoCreateFindings" className="text-xs text-zinc-700 dark:text-zinc-300 select-none">
            Automatically create finding records from scan results and trigger workflow rules
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-[#222630]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={importing}>
            {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Terminal className="h-3.5 w-3.5 mr-1.5" />}
            <span>Process & Import Scan</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
