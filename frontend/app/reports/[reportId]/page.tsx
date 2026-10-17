"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Report } from "@/types/report";
import { formatDateTime } from "@/lib/utils";
import {
  ArrowLeft,
  Download,
  Printer,
  Calendar,
  User,
  Shield,
  Loader2,
  FileText,
} from "lucide-react";

export default function ReportDetailPage() {
  const params = useParams();
  const reportId = params?.reportId as string;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      if (!reportId) return;
      try {
        setLoading(true);
        setError(null);
        const data = await api.getReportById(reportId);
        setReport(data);
      } catch (err: any) {
        setError(err.message || "Failed to load report deliverable.");
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [reportId]);

  return (
    <AppShell title="Assessment Report Deliverable">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Reports</span>
          </Link>

          {report && (
            <div className="flex items-center gap-2">
              <a
                href={`/api/v1/reports/${report.id}/download?format=markdown`}
                download
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download Markdown</span>
              </a>
              <a
                href={`/api/v1/reports/${report.id}/download?format=html`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium transition-colors shadow-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print / HTML Deliverable</span>
              </a>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500 mr-2" />
            <span className="text-xs font-mono">Loading report document...</span>
          </div>
        ) : error || !report ? (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error || "Report deliverable not found."}
          </div>
        ) : (
          <article className="p-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 shadow-xs space-y-6">
            {/* Header Metadata */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 pb-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 font-bold">
                  {report.report_type.replace("_", " ")}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {report.status}
                </span>
              </div>

              <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-zinc-50 tracking-tight">
                {report.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-500 dark:text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Engagement: </span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {report.engagement_name || "Linked Engagement"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Generated: </span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">
                    {formatDateTime(report.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Auditor: </span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {report.generated_by || "FixOps Automated Reporting"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rendered Report Content */}
            <div className="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed font-sans">
              <pre className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 font-sans text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed border border-zinc-200 dark:border-zinc-800">
                {report.summary_content}
              </pre>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}
