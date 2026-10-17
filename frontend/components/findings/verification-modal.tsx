"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Finding, VerificationMethodType, VerificationResultType } from "@/types/finding";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  finding: Finding | null;
}

export const VerificationModal: React.FC<VerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  finding,
}) => {
  const [result, setResult] = useState<VerificationResultType>("passed");
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethodType>("manual_verification");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!finding) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      await api.addVerification(finding.id, {
        result,
        verification_method: verificationMethod,
        notes: notes.trim() || undefined,
      });

      onVerified();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to record verification.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Retest & Remediation Verification"
      description={`Perform rigorous verification check for '${finding.title}'.`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Verification Result *
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setResult("passed")}
              className={`p-2.5 rounded-md border text-center transition-all ${
                result === "passed"
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <CheckCircle2 className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
              <span className="text-xs">Passed (Fixed)</span>
            </button>

            <button
              type="button"
              onClick={() => setResult("failed")}
              className={`p-2.5 rounded-md border text-center transition-all ${
                result === "failed"
                  ? "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <XCircle className="h-4 w-4 mx-auto mb-1 text-rose-500" />
              <span className="text-xs">Failed (Unresolved)</span>
            </button>

            <button
              type="button"
              onClick={() => setResult("partially_resolved")}
              className={`p-2.5 rounded-md border text-center transition-all ${
                result === "partially_resolved"
                  ? "border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                  : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="block text-amber-500 text-sm font-bold mb-0.5">&sim;</span>
              <span className="text-xs">Partial</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Verification Methodology *
          </label>
          <select
            value={verificationMethod}
            onChange={(e) => setVerificationMethod(e.target.value as VerificationMethodType)}
            className="w-full px-2.5 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100"
          >
            <option value="manual_verification">Manual Verification / Pentest Retest</option>
            <option value="automated_rescan">Automated Scanner Rescan</option>
            <option value="code_review">Source Code / PR Inspection</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Retest Evidence & Verification Notes
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Document exact steps executed to verify whether the vulnerability was eliminated..."
            rows={3}
            className="text-xs"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
            <span>Record Verification</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
