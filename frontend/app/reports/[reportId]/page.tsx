"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { api, getStoredToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async (format: "html" | "markdown") => {
    if (!report) return;
    try {
      setDownloading(format);
      const blob = await api.downloadReportDeliverable(report.id, format);
      const url = window.URL.createObjectURL(blob);
      if (format === "html") {
        window.open(url, "_blank");
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `FixOps_Report_${report.id.slice(0, 8)}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to download report deliverable. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

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
      <div className="space-y-6 max-w-4xl">
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
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownload("markdown")}
                disabled={downloading !== null}
                className="text-xs h-9 gap-1.5 border-zinc-200 dark:border-[#222630] dark:bg-[#161920]"
              >
                {downloading === "markdown" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Download Markdown</span>
              </Button>
              <Button
                size="sm"
                onClick={() => handleDownload("html")}
                disabled={downloading !== null}
                className="text-xs h-9 gap-1.5 btn-glossy-gold font-bold"
              >
                {downloading === "html" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Printer className="h-3.5 w-3.5" />
                )}
                <span>Print / HTML Deliverable</span>
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-[#F5C518] mr-2" />
            <span className="text-xs font-mono">Loading report document...</span>
          </div>
        ) : error || !report ? (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error || "Report deliverable not found."}
          </div>
        ) : (
          <article className="p-8 rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs space-y-6">
            {/* Header Metadata */}
            <div className="border-b border-zinc-200 dark:border-[#222630] pb-6 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30 font-bold">
                  {report.report_type.replace("_", " ")}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                  {report.status}
                </span>
              </div>

              <h1 className="text-2xl font-bold font-mono text-zinc-900 dark:text-[#F9FAFB] tracking-tight">
                {report.title}
              </h1>

              <div className="flex flex-wrap items-center gap-6 text-xs text-zinc-500 dark:text-[#9CA3AF]">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
                  <span>Engagement: </span>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                    {report.engagement_name || "Linked Engagement"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>Generated: </span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>
                    {formatDateTime(report.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
                  <span>Auditor: </span>
                  <span className="text-zinc-800 dark:text-zinc-200">
                    {report.generated_by || "FixOps Automated Reporting"}
                  </span>
                </div>
              </div>
            </div>

            {/* Rendered Report Content */}
            <div className="prose prose-zinc dark:prose-invert max-w-none text-xs leading-relaxed font-sans">
              <pre className="p-5 rounded-xl bg-zinc-50 dark:bg-[#08090b] font-mono text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed border border-zinc-200 dark:border-[#222630]">
                {report.summary_content}
              </pre>
            </div>
          </article>
        )}
      </div>
    </AppShell>
  );
}
