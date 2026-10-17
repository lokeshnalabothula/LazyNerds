"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Report } from "@/types/report";
import { Client } from "@/types/client";
import { formatDateTime } from "@/lib/utils";
import { PieChart, Download, ExternalLink, Loader2, Plus } from "lucide-react";
import { ReportFormModal } from "@/components/reports/report-form-modal";

interface ClientReportsTabProps {
  client: Client;
}

export const ClientReportsTab: React.FC<ClientReportsTabProps> = ({ client }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const engData = await api.getEngagements({ client_id: client.id, page_size: 100 });
      if (engData.items.length === 0) {
        setReports([]);
        return;
      }

      const allReports: Report[] = [];
      for (const eng of engData.items) {
        const rData = await api.getReports({ engagement_id: eng.id, page_size: 100 });
        allReports.push(...rData.items);
      }
      setReports(allReports);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [client.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
            Assessment Deliverables & Reports ({reports.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Executive and technical reports compiled for {client.company_name}.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Generate Report</span>
        </button>
      </div>

      {loading && reports.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-brand-500" />
          <span className="text-xs font-mono">Loading reports...</span>
        </div>
      ) : reports.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
          <PieChart className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">No reports generated for this client</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600 dark:text-brand-400 hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate first report</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((report) => (
            <div
              key={report.id}
              className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 font-semibold">
                  {report.report_type.replace("_", " ")}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono" suppressHydrationWarning>
                  {formatDateTime(report.created_at)}
                </span>
              </div>

              <Link
                href={`/reports/${report.id}`}
                className="block font-bold text-xs text-zinc-900 dark:text-zinc-100 hover:text-brand-600 dark:hover:text-brand-400 transition-colors font-mono"
              >
                {report.title}
              </Link>

              <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs">
                <span className="text-[10px] text-zinc-400">
                  {report.engagement_name || "Engagement"}
                </span>

                <div className="flex items-center gap-2">
                  <a
                    href={`/api/v1/reports/${report.id}/download?format=html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    <Download className="h-3 w-3" />
                    <span>HTML</span>
                  </a>
                  <Link
                    href={`/reports/${report.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium"
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
        onGenerated={fetchReports}
      />
    </div>
  );
};
