"use client";

import React, { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api";
import { AutomationRule, AutomationExecution } from "@/types/automation";
import { RuleFormModal } from "@/components/automation/rule-form-modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { formatDateTime } from "@/lib/utils";
import {
  Zap,
  Plus,
  Play,
  Check,
  X,
  Trash2,
  Edit2,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function AutomationPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [reminderStatus, setReminderStatus] = useState<{
    status: string;
    last_executed_at: string | null;
    last_status: string | null;
    open_findings_with_deadlines: number;
    overdue_count: number;
  } | null>(null);
  const [runningReminders, setRunningReminders] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<AutomationRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [rData, eData] = await Promise.all([
        api.getAutomationRules(),
        api.getAutomationExecutions(),
      ]);
      setRules(rData.items);
      setExecutions(eData.items);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchReminderStatus = async () => {
    try {
      const data = await api.getRemediationReminderStatus();
      setReminderStatus(data);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    fetchData();
    fetchReminderStatus();
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("create") === "true") {
        setRuleToEdit(null);
        setIsFormOpen(true);
      }
    }
  }, []);

  const handleRunRemediationReminders = async () => {
    try {
      setRunningReminders(true);
      const res = await api.runRemediationReminders();
      toast.success(
        `Remediation check complete: ${res.reminders_sent} reminder(s) dispatched, ${res.duplicates_skipped} duplicate(s) avoided.`
      );
      await Promise.all([fetchData(), fetchReminderStatus()]);
    } catch (err: any) {
      toast.error(`Reminder check failed: ${err.message}`);
    } finally {
      setRunningReminders(false);
    }
  };

  const handleToggleActive = async (rule: AutomationRule) => {
    try {
      await api.updateAutomationRule(rule.id, { is_active: !rule.is_active });
      toast.success(`Workflow '${rule.name}' is now ${!rule.is_active ? "active" : "paused"}.`);
      await fetchData();
    } catch (err: any) {
      toast.error(`Toggle failed: ${err.message}`);
    }
  };

  const handleDeleteRuleConfirm = async () => {
    if (!ruleToDelete) return;
    setIsDeletingRule(true);
    try {
      await api.deleteAutomationRule(ruleToDelete.id);
      toast.success(`Automation rule '${ruleToDelete.name}' deleted.`);
      setRuleToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    } finally {
      setIsDeletingRule(false);
    }
  };

  const handleDispatchTest = async (ruleId: string, ruleName: string) => {
    try {
      setActionLoadingId(ruleId);
      await api.dispatchWorkflow(ruleId, {
        test: true,
        dispatched_at: new Date().toISOString(),
      });
      toast.success(`Test execution dispatched for '${ruleName}'.`);
      await fetchData();
    } catch (err: any) {
      toast.error(`Dispatch failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleApproval = async (executionId: string, action: "approve" | "reject") => {
    try {
      setActionLoadingId(executionId);
      await api.approveExecution(executionId, action);
      toast.success(action === "approve" ? "Execution approved." : "Execution rejected.");
      await fetchData();
    } catch (err: any) {
      toast.error(`Approval action failed: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const pendingApprovals = executions.filter((e) => e.status === "pending_approval");

  return (
    <AppShell title="Workflow Automation Engine">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-mono">
              Cybersecurity Workflow Automation
            </h1>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1">
              Event-driven policy automation, allowlisted remediation tasks, and human-in-the-loop approval gates.
            </p>
          </div>

          <button
            onClick={() => {
              setRuleToEdit(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg btn-glossy-gold text-xs font-bold transition-all shadow-md shrink-0 min-h-[36px]"
            aria-label="Configure new cybersecurity workflow"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>New Workflow</span>
          </button>
        </div>

        {/* Flagship Production Automation: Remediation Follow-up Engine */}
        <div className="rounded-xl border border-[#F5C518]/30 bg-white dark:bg-[#111318] p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/60 dark:border-[#222630] pb-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#F5C518]/15 border border-[#F5C518]/40 flex items-center justify-center text-[#F5C518]">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-[#F9FAFB] font-mono">
                    Flagship Automation: Remediation Follow-up Reminder
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase">
                    Verified
                  </span>
                </div>
                <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-0.5">
                  Continuously tracks assigned remediation tasks, alerts owners of approaching or overdue deadlines, and strictly enforces a 24-hour duplicate notification cooldown.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleRunRemediationReminders}
              disabled={runningReminders}
              className="text-xs h-9 px-4 gap-1.5 shrink-0 btn-glossy-gold font-bold"
            >
              {runningReminders ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Play className="h-3.5 w-3.5 mr-1.5" />
              )}
              <span>Run Follow-up Check Now</span>
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-lg border border-zinc-200/60 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]">
              <span className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono block">Pending Tracked Tasks</span>
              <span className="text-base font-bold font-mono text-zinc-900 dark:text-[#F9FAFB]">
                {reminderStatus?.open_findings_with_deadlines ?? "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-lg border border-zinc-200/60 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]">
              <span className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono block">Overdue Vulnerabilities</span>
              <span className={`text-base font-bold font-mono ${reminderStatus?.overdue_count ? "text-rose-500 dark:text-[#F43F5E]" : "text-emerald-500 dark:text-emerald-400"}`}>
                {reminderStatus?.overdue_count ?? "—"}
              </span>
            </div>
            <div className="p-3.5 rounded-lg border border-zinc-200/60 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]">
              <span className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono block">Duplicate Cooldown</span>
              <span className="text-base font-bold font-mono text-[#F5C518]">
                24 Hours Guard
              </span>
            </div>
            <div className="p-3.5 rounded-lg border border-zinc-200/60 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]">
              <span className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] font-mono block">Last Run Status</span>
              <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-300 capitalize truncate block mt-1">
                {reminderStatus?.last_status || "Ready (Idle)"}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#161920]/60 border border-zinc-200 dark:border-[#222630] text-[11px] text-zinc-500 dark:text-[#9CA3AF] font-mono flex items-start gap-2">
            <span className="text-[#F5C518] font-bold shrink-0">EXECUTION NOTE:</span>
            <span>
              Direct API execution is verified end-to-end. For automatic background recurring execution in production, configure an external cron trigger (Render Cron Job, GitHub Actions, or Neon Function Trigger) to call <code className="text-zinc-200 bg-zinc-800 px-1 py-0.5 rounded">POST /api/v1/automation/remediation-reminders/run</code>.
            </span>
          </div>
        </div>

        {/* Pending Human Approvals Queue (Module F Governance) */}
        {pendingApprovals.length > 0 && (
          <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <h2 className="text-xs font-semibold uppercase tracking-wider">
                Human Approval Required ({pendingApprovals.length} Pending)
              </h2>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              The following automated actions triggered approval safeguards and require an authorized security engineer before execution.
            </p>

            <div className="divide-y divide-amber-500/20">
              {pendingApprovals.map((exec) => (
                <div key={exec.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 block truncate">
                      {exec.rule_name || "Workflow Rule"}
                    </span>
                    <div className="text-[11px] text-zinc-500 font-mono mt-0.5" suppressHydrationWarning>
                      Source: {exec.trigger_source} &bull; Queued: {formatDateTime(exec.executed_at)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproval(exec.id, "approve")}
                      disabled={actionLoadingId === exec.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium shadow-xs min-h-[34px]"
                    >
                      {actionLoadingId === exec.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleApproval(exec.id, "reject")}
                      disabled={actionLoadingId === exec.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-medium min-h-[34px]"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Rules List */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF]">
            Active Automation Rules ({rules.length})
          </h2>

          {loading && rules.length === 0 ? (
            <div className="h-32 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="h-5 w-5 animate-spin text-[#F5C518]" />
              <span className="text-xs font-mono">Loading automation policies…</span>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-[#222630] rounded-xl bg-zinc-50/50 dark:bg-[#111318]">
              <Zap className="h-6 w-6 text-zinc-400 mx-auto mb-2 opacity-60" />
              <p className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB]">No automation rules configured</p>
              <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF] mt-1 max-w-sm mx-auto leading-relaxed">
                Create event-driven workflows to automate remediation assignment, notifications, and reporting.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all ${
                    rule.is_active
                      ? "border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-xs hover:border-[#F5C518]/40 dark:hover:border-[#F5C518]/40"
                      : "border-zinc-200/50 dark:border-[#222630]/40 bg-zinc-50/50 dark:bg-[#111318]/40 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-900 dark:text-[#F9FAFB] font-mono">
                          {rule.name}
                        </span>
                        {rule.requires_approval && (
                          <span className="px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[9px] font-mono rounded">
                            Approval Gate
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] leading-relaxed">
                        {rule.description || "No description provided."}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                        rule.is_active ? "bg-[#F5C518]" : "bg-zinc-300 dark:bg-[#161920] dark:border-[#222630]"
                      }`}
                      role="switch"
                      aria-checked={rule.is_active}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-[#F9FAFB] shadow-lg ring-0 transition duration-200 ease-in-out ${
                          rule.is_active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-[#222630] flex items-center justify-between text-[11px] text-zinc-400 dark:text-[#9CA3AF] font-mono">
                    <div>
                      <span>On </span>
                      <span className="text-zinc-700 dark:text-zinc-200 font-semibold">{rule.trigger_event}</span>
                      <span> &rarr; </span>
                      <span className="text-zinc-700 dark:text-zinc-200">{rule.action_type}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDispatchTest(rule.id, rule.name)}
                        disabled={actionLoadingId === rule.id}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors"
                        title="Run Test Dispatch"
                        aria-label={`Test dispatch rule ${rule.name}`}
                      >
                        {actionLoadingId === rule.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setRuleToEdit(rule);
                          setIsFormOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors"
                        title="Edit Rule"
                        aria-label={`Edit rule ${rule.name}`}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRuleToDelete({ id: rule.id, name: rule.name })}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors"
                        title="Delete Rule"
                        aria-label={`Delete rule ${rule.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Execution Logs */}
        <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-[#222630]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-[#9CA3AF]">
            Workflow Execution History & Telemetry
          </h2>

          <div className="border border-zinc-200 dark:border-[#222630] rounded-xl overflow-hidden bg-white dark:bg-[#111318] shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920] text-zinc-500 dark:text-[#9CA3AF]">
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Rule Name</th>
                    <th className="py-2.5 px-3 font-semibold">Trigger Source</th>
                    <th className="py-2.5 px-3 font-semibold">Result / Notes</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-[#222630]">
                  {executions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-zinc-400 dark:text-[#9CA3AF]">
                        No workflow executions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    executions.map((exec) => (
                      <tr key={exec.id} className="hover:bg-zinc-50 dark:hover:bg-[#161920]/60 transition-colors">
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                              exec.status === "completed"
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                : exec.status === "pending_approval"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                            }`}
                          >
                            {exec.status === "completed" && <CheckCircle2 className="h-3 w-3" />}
                            {exec.status === "failed" && <XCircle className="h-3 w-3" />}
                            <span>{exec.status.replace("_", " ")}</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-zinc-900 dark:text-[#F9FAFB]">
                          {exec.rule_name || "Automation Rule"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500 dark:text-[#9CA3AF] truncate max-w-xs">
                          {exec.trigger_source}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-600 dark:text-zinc-300 font-mono text-[10px] truncate max-w-xs">
                          {exec.output_result || exec.error_message || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-400 dark:text-[#9CA3AF] font-mono text-[10px] shrink-0" suppressHydrationWarning>
                          {formatDateTime(exec.executed_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <RuleFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSaved={fetchData}
          ruleToEdit={ruleToEdit}
        />

        <ConfirmDialog
          isOpen={Boolean(ruleToDelete)}
          onClose={() => setRuleToDelete(null)}
          onConfirm={handleDeleteRuleConfirm}
          title="Delete Workflow Rule"
          description={`Are you sure you want to delete workflow rule '${ruleToDelete?.name}'? Automatic dispatching and triggers for this rule will be permanently removed.`}
          confirmLabel="Delete Rule"
          variant="destructive"
          loading={isDeletingRule}
        />
      </div>
    </AppShell>
  );
}
