"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { Report } from "@/types/report";
import { ReportFormModal } from "@/components/reports/report-form-modal";
import { Button } from "@/components/ui/button";
import { ReportsSkeleton } from "@/components/ui/skeleton";
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
      <div className="space-y-6 max-w-7xl mx-auto pb-16">
        {/* Cockpit Header Card (Stitch Obsidian Precision) */}
        <div className="cockpit-card specular-top border-[#222630] bg-[#111318]/90 p-5 sm:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border border-[#F5C518]/40 bg-[#161920] shadow-[0_2px_12px_rgba(245,197,24,0.15)] flex items-center justify-center shrink-0 text-[#F5C518]">
              <PieChart className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#F9FAFB] font-sans">
                  Assessment Reports &amp; Deliverables
                </h1>
                <span className="badge-cyber bg-[#F5C518]/15 text-[#FFD84D] border-[#F5C518]/30 text-[10px] font-mono">
                  Verified Audit Trails
                </span>
              </div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed max-w-2xl">
                Client-facing assessment reports, executive summaries, and downloadable deliverables derived from real assessment data.
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="text-xs h-9 px-4 gap-1.5 shrink-0 font-bold shadow-md"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Generate Report</span>
          </Button>
        </div>

        {/* Framework Deliverable Templates Ribbon (Stitch Screen 10) */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            onClick={() => setIsModalOpen(true)}
            className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-cyan-300 font-semibold">PENTEST BRIEF</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                ZERO-TRUST
              </span>
            </div>
            <div className="my-2">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#F5C518] transition-colors">
                Multi-Tier Infrastructure Pentest
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Full external scope, verified CVE deductions, and remediation timeline.
              </p>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>PDF / JSON Export</span>
              <span className="text-white group-hover:translate-x-0.5 transition-transform">Deploy →</span>
            </div>
          </div>

          <div
            onClick={() => setIsModalOpen(true)}
            className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-emerald-400 font-semibold">COMPLIANCE</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                PCI-DSS v4.0
              </span>
            </div>
            <div className="my-2">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#F5C518] transition-colors">
                PCI-DSS Level 1 Attestation
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Cardholder data environment boundaries, encryption, and audit signs.
              </p>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>Executive Brief</span>
              <span className="text-white group-hover:translate-x-0.5 transition-transform">Deploy →</span>
            </div>
          </div>

          <div
            onClick={() => setIsModalOpen(true)}
            className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-amber-300 font-semibold">GOVERNANCE</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                SOC 2 TYPE II
              </span>
            </div>
            <div className="my-2">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#F5C518] transition-colors">
                Trust Services Criteria Audit
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Security, availability, and confidentiality control effectiveness mapping.
              </p>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>AICPA Aligned</span>
              <span className="text-white group-hover:translate-x-0.5 transition-transform">Deploy →</span>
            </div>
          </div>

          <div
            onClick={() => setIsModalOpen(true)}
            className="glass-card rounded-2xl p-4 flex flex-col justify-between hover:border-white/30 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-rose-300 font-semibold">SECURITY AUDIT</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30">
                HIPAA / HITECH
              </span>
            </div>
            <div className="my-2">
              <h3 className="text-sm font-semibold text-white group-hover:text-[#F5C518] transition-colors">
                ePHI Protection Assessment
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Administrative, physical, and technical safeguard validation.
              </p>
            </div>
            <div className="text-[10px] font-mono text-zinc-500 flex items-center justify-between pt-1 border-t border-white/[0.06]">
              <span>Full Dossier</span>
              <span className="text-white group-hover:translate-x-0.5 transition-transform">Deploy →</span>
            </div>
          </div>
        </section>

        {/* Reports List */}
        <div data-loading-state={loading && reports.length === 0 ? "loading" : "complete"}>
        {loading && reports.length === 0 ? (
          <ReportsSkeleton />
        ) : reports.length === 0 ? (
          <div data-empty="true" className="p-12 text-center border border-dashed border-zinc-300 dark:border-[#222630] rounded-xl bg-zinc-50/50 dark:bg-[#111318]">
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
                    className="block font-bold text-sm text-zinc-900 dark:text-[#F9FAFB] hover:text-[#B88700] dark:hover:text-[#FFD84D] transition-colors font-sans truncate"
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
                      className="inline-flex items-center gap-1 text-[11px] text-zinc-600 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB] font-sans"
                    >
                      <Download className="h-3 w-3" />
                      <span>Print/HTML</span>
                    </a>
                    <Link
                      href={`/reports/${report.id}`}
                      className="inline-flex items-center gap-1 text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline font-semibold font-sans"
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
        </div>

        <ReportFormModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onGenerated={(id) => router.push(`/reports/${id}`)}
        />
      </div>
    </AppShell>
  );
}
