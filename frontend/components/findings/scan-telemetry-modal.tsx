"use client";

import React, { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Assessment } from "@/types/finding";
import {
  Terminal,
  Shield,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  XOctagon,
  ArrowRight,
  Activity,
  Layers,
  Bug,
  FileCheck2,
} from "lucide-react";

interface ScanTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string | null;
  onViewFindings?: (assessmentId: string) => void;
}

const PHASES = [
  { key: "pre-recon", label: "Pre-Recon", desc: "Code Architecture Baseline" },
  { key: "recon", label: "Recon", desc: "Attack Surface Mapping" },
  { key: "vuln_analysis", label: "Vuln Analysis", desc: "Parallel AI Agents" },
  { key: "exploitation", label: "Exploitation", desc: "Proof-of-Concept Validation" },
  { key: "completed", label: "Completed", desc: "Deliverables & SARIF" },
];

export const ScanTelemetryModal: React.FC<ScanTelemetryModalProps> = ({
  isOpen,
  onClose,
  assessmentId,
  onViewFindings,
}) => {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    if (!assessmentId) return;
    try {
      const data = await api.getAssessmentById(assessmentId);
      setAssessment(data);
    } catch {
      // Ignore poll error
    }
  };

  useEffect(() => {
    if (isOpen && assessmentId) {
      fetchStatus();
      const interval = setInterval(() => {
        if (assessment?.status === "completed" || assessment?.status === "failed") {
          clearInterval(interval);
          return;
        }
        fetchStatus();
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isOpen, assessmentId, assessment?.status]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [assessment?.execution_summary]);

  const handleCancel = async () => {
    if (!assessmentId) return;
    try {
      setCancelling(true);
      const updated = await api.cancelScan(assessmentId);
      setAssessment(updated);
    } catch {
      // Ignore
    } finally {
      setCancelling(false);
    }
  };

  let summaryData: any = {};
  if (assessment?.execution_summary) {
    try {
      summaryData = JSON.parse(assessment.execution_summary);
    } catch {
      summaryData = { current_status: assessment.execution_summary };
    }
  }

  const currentPhase = summaryData.phase || (assessment?.status === "completed" ? "completed" : "pre-recon");
  const progressPercent = summaryData.progress_percent || (assessment?.status === "completed" ? 100 : 15);
  const logs = summaryData.logs || [];
  const activeAgent = summaryData.active_agent || "worker";
  const statusMsg = summaryData.current_status || (assessment?.status === "running" ? "Running assessment..." : assessment?.status);

  const getPhaseIndex = (phaseKey: string) => {
    const idx = PHASES.findIndex((p) => p.key === phaseKey);
    return idx === -1 ? 0 : idx;
  };

  const activePhaseIdx = getPhaseIndex(currentPhase);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="FixOps Live Scan Telemetry"
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs text-zinc-300">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-100 text-sm truncate">
                {assessment?.name || "Autonomous Assessment"}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                  assessment?.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : assessment?.status === "failed"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                    : "bg-[#F5C518]/10 text-[#F5C518] border border-[#F5C518]/30 animate-pulse"
                }`}
              >
                {assessment?.status || "QUEUED"}
              </span>
            </div>
            <div className="text-[11px] text-zinc-400 flex items-center gap-3">
              <span>Engine: <strong className="text-zinc-200 capitalize">{assessment?.assessment_tool || "Shannon"}</strong></span>
              <span>•</span>
              <span>Mode: <strong className="text-zinc-200">{summaryData.scan_mode === "source_assisted" ? "Source-Assisted AI Pentest" : "Black-Box Scan"}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] text-zinc-500 font-mono block">PROVEN FINDINGS</span>
              <span className="text-base font-bold font-mono text-[#F5C518]">
                {assessment?.findings_count || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Phase Stepper */}
        <div className="p-4 rounded-xl bg-[#161920] border border-zinc-800 space-y-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#F5C518]" />
              Pipeline Execution Stage
            </span>
            <span className="font-mono text-zinc-400 font-semibold">{progressPercent}% Completed</span>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-zinc-950 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-amber-500 to-[#F5C518] h-full transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* 5 Phase Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {PHASES.map((p, idx) => {
              const isPast = idx < activePhaseIdx || assessment?.status === "completed";
              const isCurrent = idx === activePhaseIdx && assessment?.status !== "completed";
              return (
                <div
                  key={p.key}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isPast
                      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                      : isCurrent
                      ? "border-[#F5C518] bg-[#F5C518]/10 text-white shadow-xs"
                      : "border-zinc-800/60 bg-zinc-900/40 text-zinc-600"
                  }`}
                >
                  <div className="text-[11px] font-bold flex items-center justify-center gap-1">
                    {isPast ? (
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    ) : isCurrent ? (
                      <Loader2 className="h-3 w-3 text-[#F5C518] animate-spin" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-700 inline-block" />
                    )}
                    <span>{p.label}</span>
                  </div>
                  <div className="text-[9px] text-zinc-400 truncate mt-0.5">{p.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Current Status Callout */}
        <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-[#F5C518] animate-pulse" />
            <span className="text-zinc-200">{statusMsg}</span>
          </div>
          {activeAgent && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
              Agent: {activeAgent}
            </span>
          )}
        </div>

        {/* Terminal Log Output */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-zinc-500" />
              Isolated Execution Stream
            </span>
            <span className="text-[10px] font-mono text-zinc-500">Auto-tail enabled</span>
          </div>

          <div
            ref={logContainerRef}
            className="h-56 p-3 rounded-xl bg-[#08090b] border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-y-auto space-y-1.5 select-text leading-relaxed shadow-inner"
          >
            {logs.length === 0 ? (
              <div className="text-zinc-600 italic">Waiting for initial execution telemetry...</div>
            ) : (
              logs.map((log: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-zinc-600 shrink-0">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : "--:--:--"}
                  </span>
                  {log.agent && (
                    <span className="text-[#F5C518] shrink-0 font-semibold">[{log.agent}]</span>
                  )}
                  <span className="text-zinc-300 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <div>
            {assessment?.status === "running" && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={cancelling}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
              >
                {cancelling ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
                ) : (
                  <XOctagon className="h-3 w-3 mr-1.5" />
                )}
                Abort Scan
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {assessment?.status === "completed" && onViewFindings && (
              <Button
                type="button"
                onClick={() => onViewFindings(assessment.id)}
                className="btn-glossy-gold text-[#111318] text-xs font-bold px-4 py-2"
              >
                <Bug className="h-3.5 w-3.5 mr-1.5" />
                View Discovered Findings ({assessment.findings_count})
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="text-xs border-zinc-800 text-zinc-300 hover:bg-zinc-800"
            >
              Close Console
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
