"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Engagement } from "@/types/engagement";
import { ReportType } from "@/types/report";
import { Loader2, PieChart, AlertCircle, Plus } from "lucide-react";

interface ReportFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (reportId: string) => void;
  defaultEngagementId?: string;
}

export const ReportFormModal: React.FC<ReportFormModalProps> = ({
  isOpen,
  onClose,
  onGenerated,
  defaultEngagementId,
}) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [engagementId, setEngagementId] = useState(defaultEngagementId || "");
  const [title, setTitle] = useState("");
  const [reportType, setReportType] = useState<ReportType>("full_assessment");

  useEffect(() => {
    if (isOpen) {
      loadEngagements();
      setEngagementId(defaultEngagementId || "");
      setTitle("");
      setReportType("full_assessment");
      setError(null);
    }
  }, [isOpen, defaultEngagementId]);

  const loadEngagements = async () => {
    try {
      setLoadingOptions(true);
      const data = await api.getEngagements({ page_size: 100 });
      setEngagements(data.items);
      if (!engagementId && data.items.length > 0 && !defaultEngagementId) {
        setEngagementId(data.items[0].id);
        setTitle(`Cybersecurity Assessment Report - ${data.items[0].name}`);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSelectEngagement = (id: string) => {
    setEngagementId(id);
    const eng = engagements.find((e) => e.id === id);
    if (eng) {
      setTitle(`Cybersecurity Assessment Report - ${eng.name}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!engagementId || !title.trim()) {
      setError("Please select an engagement and enter a report title.");
      return;
    }

    try {
      setGenerating(true);
      setError(null);

      const report = await api.createReport({
        engagement_id: engagementId,
        title: title.trim(),
        report_type: reportType,
      });

      onGenerated(report.id);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to generate report.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate Client Assessment Report"
      description="Compiles real findings, scoping boundaries, methodology, and remediation metrics from the database."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {!loadingOptions && engagements.length === 0 ? (
          <div className="p-5 rounded-xl border border-dashed border-zinc-300 dark:border-[#222630] text-center space-y-3 bg-zinc-50/50 dark:bg-[#161920]/40">
            <AlertCircle className="h-6 w-6 text-amber-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                No In-Scope Engagements Available
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF] max-w-xs mx-auto leading-relaxed">
                Assessment reports require an active or completed engagement record to compile verified findings and scoping telemetry.
              </p>
            </div>
            <Link href="/engagements/new" onClick={onClose} className="inline-block">
              <Button size="sm" type="button" className="text-xs gap-1.5 btn-glossy-gold font-bold">
                <Plus className="h-3.5 w-3.5" />
                <span>Create New Engagement</span>
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                Target Engagement *
              </label>
              <select
                value={engagementId}
                onChange={(e) => handleSelectEngagement(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
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
              <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                Report Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Q4 Penetration Testing Comprehensive Report"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                Report Type *
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              >
                <option value="full_assessment">Full Assessment (Executive Summary + Scope + All Findings)</option>
                <option value="executive_summary">Executive Summary Only (High-Level Posture & Risk Matrix)</option>
                <option value="technical_findings">Technical Findings (Vulnerabilities, CVSS & Evidence Only)</option>
                <option value="remediation_audit">Remediation & Verification Audit (Fixed vs Outstanding)</option>
              </select>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#222630]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={generating} className="border-zinc-200 dark:border-[#222630]">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={generating || engagements.length === 0 || !engagementId}
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <PieChart className="h-3.5 w-3.5 mr-1.5" />}
            <span>{generating ? "Compiling Telemetry…" : "Generate Report"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
