"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Report } from "@/types/report";
import { ReportFormModal } from "@/components/reports/report-form-modal";
import { Button } from "@/components/ui/button";
import { CardGridSkeleton } from "@/components/ui/loading";
import { formatDateTime } from "@/lib/utils";
import {
  PieChart,
  Plus,
  FileText,
  Download,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await api.getReports({ page_size: 100 });
      setReports(data.items);
      setTotal(data.total);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <AppShell title="Reporting & Evidence">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-mono">
              Assessment Reports & Deliverables
            </h1>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1">
              Client-facing assessment reports, executive summaries, and downloadable deliverables derived from real assessment data.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs h-9 gap-1.5 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate Report</span>
          </Button>
        </div>

        {/* Reports List */}
        {loading && reports.length === 0 ? (
          <CardGridSkeleton count={6} />
        ) : reports.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-zinc-300 dark:border-[#222630] rounded-xl bg-zinc-50/50 dark:bg-[#111318]">
            <PieChart className="h-8 w-8 text-zinc-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">No assessment reports generated</p>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1 max-w-sm mx-auto leading-relaxed">
              Generate executive and technical assessment reports summarizing real findings, scoping boundaries, and remediation progress.
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="mt-4 text-xs h-9 gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Generate First Report</span>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="cockpit-card cockpit-card-interactive specular-top p-5 shadow-md flex flex-col justify-between space-y-4 min-w-0"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30 font-semibold">
                      {report.report_type.replace("_", " ")}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono" suppressHydrationWarning>
                      {formatDateTime(report.created_at)}
                    </span>
                  </div>

                  <Link
                    href={`/reports/${report.id}`}
                    className="block font-bold text-sm text-zinc-900 dark:text-[#F9FAFB] hover:text-[#B88700] dark:hover:text-[#FFD84D] transition-colors font-mono truncate"
                  >
                    {report.title}
                  </Link>

                  <div className="text-xs text-zinc-500 dark:text-[#9CA3AF] truncate">
                    <span>Engagement: </span>
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                      {report.engagement_name || "Linked Engagement"}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-[#222630] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    By {report.generated_by || "System"}
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/v1/reports/${report.id}/download?format=html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB] font-mono"
                    >
                      <Download className="h-3 w-3" />
                      <span>Print/HTML</span>
                    </a>
                    <Link
                      href={`/reports/${report.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline font-semibold font-mono"
                    >
                      <span>View</span>
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <ReportFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onGenerated={(id) => router.push(`/reports/${id}`)}
        />
      </div>
    </AppShell>
  );
}
