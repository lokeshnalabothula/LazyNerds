"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Engagement } from "@/types/engagement";
import { Asset } from "@/types/asset";
import { Assessment } from "@/types/finding";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  GitBranch,
  Terminal,
  Globe,
  Code2,
  Info,
  CheckCircle2,
} from "lucide-react";

interface ScanLauncherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanLaunched: (assessment: Assessment) => void;
  defaultEngagementId?: string;
  defaultAssetId?: string;
}

export const ScanLauncherModal: React.FC<ScanLauncherModalProps> = ({
  isOpen,
  onClose,
  onScanLaunched,
  defaultEngagementId,
  defaultAssetId,
}) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [engagementId, setEngagementId] = useState(defaultEngagementId || "");
  const [targetAssetId, setTargetAssetId] = useState(defaultAssetId || "");
  const [scanMode, setScanMode] = useState<"source_assisted" | "blackbox">("source_assisted");
  const [sourceRepo, setSourceRepo] = useState("lab/vulnerable_app");
  const [isMockRun, setIsMockRun] = useState(true);
  const [authorizedConsent, setAuthorizedConsent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadOptions();
      setEngagementId(defaultEngagementId || "");
      setTargetAssetId(defaultAssetId || "");
      setError(null);
      setAuthorizedConsent(false);
    }
  }, [isOpen, defaultEngagementId, defaultAssetId]);

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

  // Filter assets to those belonging to the selected engagement's client or engagement
  const eligibleAssets = assets.filter((a) => {
    if (!a.in_scope) return false;
    if (targetAssetId === a.id) return true;
    if (!engagementId) return true;
    const selectedEng = engagements.find((e) => e.id === engagementId);
    if (!selectedEng) return true;
    return a.client_id === selectedEng.client_id;
  });

  const selectedAsset = assets.find((a) => a.id === targetAssetId);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementId) {
      setError("Please select an active engagement.");
      return;
    }
    if (!targetAssetId) {
      setError("Please select an authorized in-scope target asset.");
      return;
    }
    if (scanMode === "source_assisted") {
      const trimmedRepo = sourceRepo.trim();
      if (!trimmedRepo) {
        setError("Source-assisted AI pentests require an accessible local repository directory path on the worker host.");
        return;
      }
      if (
        trimmedRepo.startsWith("http://") ||
        trimmedRepo.startsWith("https://") ||
        trimmedRepo.startsWith("git@") ||
        trimmedRepo.startsWith("ssh://")
      ) {
        setError(
          "Direct Git repository URLs are not yet supported for automated bind-mounting. " +
          "Please specify an accessible local directory path on the worker host (e.g. 'lab/vulnerable_app')."
        );
        return;
      }
    }
    if (!authorizedConsent) {
      setError("You must confirm that this target asset is authorized under active Rules of Engagement.");
      return;
    }

    try {
      setLaunching(true);
      setError(null);

      const assessment = await api.launchScan({
        engagement_id: engagementId,
        target_asset_id: targetAssetId,
        scan_mode: scanMode,
        source_repo: scanMode === "source_assisted" ? sourceRepo.trim() : undefined,
        is_mock_run: isMockRun,
      });

      onScanLaunched(assessment);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to launch security assessment.");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Launch FixOps Automated Assessment"
      maxWidth="lg"
    >
      <form onSubmit={handleLaunch} className="space-y-5 text-xs text-zinc-300">
        {/* Banner */}
        <div className="p-3.5 rounded-lg bg-zinc-900 border border-zinc-800 flex items-start gap-3">
          <Terminal className="h-4 w-4 text-[#F5C518] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-zinc-100 text-[13px]">
              FixOps Autonomous Scanning Engine
            </div>
            <p className="text-zinc-400 leading-relaxed text-[11px]">
              Orchestrate automated penetration testing on isolated Lazy Nerds infrastructure.
              All scans enforce strict in-scope authorization and SSRF guardrails.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Scan Mode Toggle */}
        <div className="space-y-2">
          <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Assessment Engine & Methodology
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setScanMode("source_assisted")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                scanMode === "source_assisted"
                  ? "border-[#F5C518] bg-[#F5C518]/10 text-white shadow-xs"
                  : "border-zinc-800 bg-[#161920] hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Code2 className={`h-4 w-4 ${scanMode === "source_assisted" ? "text-[#F5C518]" : "text-zinc-400"}`} />
                <span className="font-bold text-zinc-100 text-xs">Source-Assisted AI Pentest</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Shannon agentic engine: Combines deep code analysis with live PoC exploit verification. Zero speculative false positives.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setScanMode("blackbox")}
              className={`p-3.5 rounded-xl border text-left transition-all ${
                scanMode === "blackbox"
                  ? "border-[#F5C518] bg-[#F5C518]/10 text-white shadow-xs"
                  : "border-zinc-800 bg-[#161920] hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Globe className={`h-4 w-4 ${scanMode === "blackbox" ? "text-[#F5C518]" : "text-zinc-400"}`} />
                <span className="font-bold text-zinc-100 text-xs">External Black-Box Scan</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                URL-only vulnerability scanning via FixOps dynamic engine. Assesses perimeter services without requiring source code.
              </p>
            </button>
          </div>
        </div>

        {/* Engagement & Target Selection */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-zinc-300">
              Active Engagement <span className="text-rose-400">*</span>
            </label>
            <select
              value={engagementId}
              onChange={(e) => {
                setEngagementId(e.target.value);
                setTargetAssetId("");
              }}
              disabled={loadingOptions || launching}
              className="w-full px-3 py-2 rounded-lg bg-[#161920] border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-[#F5C518]"
            >
              <option value="">Select Engagement...</option>
              {engagements.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.status})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-zinc-300">
              Target Asset (In-Scope) <span className="text-rose-400">*</span>
            </label>
            <select
              value={targetAssetId}
              onChange={(e) => setTargetAssetId(e.target.value)}
              disabled={loadingOptions || launching || !engagementId}
              className="w-full px-3 py-2 rounded-lg bg-[#161920] border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-[#F5C518]"
            >
              <option value="">Select In-Scope Asset...</option>
              {eligibleAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.target})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selected Asset Scope Indicator */}
        {selectedAsset && (
          <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span className="font-semibold text-zinc-200">{selectedAsset.name}</span>
              <span className="text-zinc-500 font-mono">({selectedAsset.target})</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Verified In-Scope
            </span>
          </div>
        )}

        {/* Source Repository (shown only if source-assisted) */}
        {scanMode === "source_assisted" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-semibold text-zinc-300">
                Source Repository Directory Path <span className="text-rose-400">*</span>
              </label>
              <span className="text-[10px] text-zinc-500 font-mono">Mounted read-only (:ro)</span>
            </div>
            <div className="relative">
              <GitBranch className="h-4 w-4 text-zinc-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={sourceRepo}
                onChange={(e) => setSourceRepo(e.target.value)}
                placeholder="e.g. lab/vulnerable_app or /absolute/path/to/repo"
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#161920] border border-zinc-800 text-zinc-200 text-xs focus:outline-none focus:border-[#F5C518]"
              />
            </div>
            <p className="text-[10px] text-zinc-500">
              Local repository directory path on worker host. Direct Git clone URLs are currently unavailable.
            </p>
          </div>
        )}

        {/* Execution Profile */}
        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-zinc-300 uppercase tracking-wider">
            Execution Profile & Cost Control
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsMockRun(true)}
              className={`p-3 rounded-lg border text-left transition-all ${
                isMockRun
                  ? "border-emerald-500/60 bg-emerald-500/10 text-white shadow-xs"
                  : "border-zinc-800 bg-[#161920] hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className="font-bold text-xs text-emerald-400 mb-0.5 flex items-center justify-between">
                <span>Lab Benchmark (Zero Cost)</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">RECOMMENDED</span>
              </div>
              <div className="text-[10px] text-zinc-400 leading-relaxed">
                Safe sandbox verification against local test target. Evaluates scanner adapters and telemetry without third-party API costs.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIsMockRun(false)}
              className={`p-3 rounded-lg border text-left transition-all ${
                !isMockRun
                  ? "border-[#F5C518] bg-[#F5C518]/10 text-white shadow-xs"
                  : "border-zinc-800 bg-[#161920] hover:border-zinc-700 text-zinc-400"
              }`}
            >
              <div className="font-bold text-xs text-[#F5C518] mb-0.5">Live Production Worker</div>
              <div className="text-[10px] text-zinc-400 leading-relaxed">
                Executes via Docker worker container. Requires configured provider credits (Grok / OpenAI).
              </div>
            </button>
          </div>
        </div>

        {/* Authorization Consent Checkbox */}
        <div className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={authorizedConsent}
              onChange={(e) => setAuthorizedConsent(e.target.checked)}
              className="mt-0.5 rounded border-zinc-700 bg-zinc-800 text-[#F5C518] focus:ring-0"
            />
            <span className="text-[11px] text-zinc-300 leading-relaxed">
              I verify that testing against this target is explicitly authorized under an executed Rules of Engagement agreement and strictly complies with FixOps security policies.
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={launching}
            className="text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={launching || !authorizedConsent || !targetAssetId}
            className="text-xs px-4 py-2 min-h-[36px]"
          >
            {launching ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                Initializing Worker...
              </>
            ) : (
              <>
                <Terminal className="h-3.5 w-3.5 mr-1.5" />
                Launch Assessment
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
