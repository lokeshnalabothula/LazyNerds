"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import {
  ActionType,
  AutomationRule,
  AutomationRuleCreateInput,
  TriggerEventType,
} from "@/types/automation";
import { Loader2, Zap } from "lucide-react";

interface RuleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  ruleToEdit?: AutomationRule | null;
}

export const RuleFormModal: React.FC<RuleFormModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  ruleToEdit,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerEvent, setTriggerEvent] = useState<TriggerEventType>("on_finding_created");
  const [actionType, setActionType] = useState<ActionType>("send_notification");
  const [conditionSeverity, setConditionSeverity] = useState<string>("critical");
  const [recipient, setRecipient] = useState("founder@lazynerds.com");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (ruleToEdit) {
        setName(ruleToEdit.name);
        setDescription(ruleToEdit.description || "");
        setTriggerEvent(ruleToEdit.trigger_event);
        setActionType(ruleToEdit.action_type);
        setRequiresApproval(ruleToEdit.requires_approval);
        setIsActive(ruleToEdit.is_active);

        if (ruleToEdit.conditions) {
          try {
            const cond = JSON.parse(ruleToEdit.conditions);
            if (cond.severity) {
              setConditionSeverity(Array.isArray(cond.severity) ? cond.severity[0] : cond.severity);
            }
          } catch {}
        }
      } else {
        setName("");
        setDescription("");
        setTriggerEvent("on_finding_created");
        setActionType("send_notification");
        setConditionSeverity("critical");
        setRecipient("founder@lazynerds.com");
        setRequiresApproval(false);
        setIsActive(true);
      }
      setError(null);
    }
  }, [isOpen, ruleToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a workflow rule name.");
      return;
    }

    if (actionType === "send_notification" || actionType === "assign_remediation_task") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!recipient || !emailRegex.test(recipient.trim())) {
        setError("Please enter a valid recipient/assignee email address.");
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const conditions: Record<string, any> = {};
      if (triggerEvent === "on_finding_created" && conditionSeverity) {
        conditions["severity"] = [conditionSeverity];
      }

      const actionConfig: Record<string, any> = {};
      if (actionType === "send_notification") {
        actionConfig["recipient"] = recipient;
        actionConfig["title"] = `FixOps Security Alert: ${name}`;
      } else if (actionType === "assign_remediation_task") {
        actionConfig["assignee"] = recipient;
        actionConfig["deadline_days"] = 14;
      }

      if (ruleToEdit) {
        await api.updateAutomationRule(ruleToEdit.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          trigger_event: triggerEvent,
          action_type: actionType,
          conditions,
          action_config: actionConfig,
          requires_approval: requiresApproval,
          is_active: isActive,
        });
      } else {
        await api.createAutomationRule({
          name: name.trim(),
          description: description.trim() || undefined,
          trigger_event: triggerEvent,
          action_type: actionType,
          conditions,
          action_config: actionConfig,
          requires_approval: requiresApproval,
          is_active: isActive,
        });
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save workflow rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ruleToEdit ? "Edit Automation Rule" : "Configure Cybersecurity Workflow"}
      description="Define triggers, conditions, and allowlisted automated actions to eliminate repetitive security tasks."
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Workflow Name *
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Critical Finding Immediate Notification & Triage"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the operational goal of this automated policy..."
            rows={2}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Trigger Event *
            </label>
            <select
              value={triggerEvent}
              onChange={(e) => setTriggerEvent(e.target.value as TriggerEventType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="on_finding_created">On Finding Discovered</option>
              <option value="on_engagement_created">On Engagement Created</option>
              <option value="on_remediation_requested">On Retest / Remediation Verification</option>
              <option value="scheduled_check">Scheduled Interval Check</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Action *
            </label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value as ActionType)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="send_notification">Send In-App Notification</option>
              <option value="assign_remediation_task">Assign Task & Set 14-Day Deadline</option>
              <option value="generate_summary_report">Auto-Generate Executive Summary Report</option>
              <option value="trigger_adapter_scan">Schedule Automated Rescan Adapter</option>
              <option value="require_human_approval">Require Human Approval Gate</option>
            </select>
          </div>
        </div>

        {/* Condition Filter */}
        {triggerEvent === "on_finding_created" && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Trigger Condition: Finding Severity
            </label>
            <select
              value={conditionSeverity}
              onChange={(e) => setConditionSeverity(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-xs text-zinc-900 dark:text-[#F9FAFB] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
            >
              <option value="critical">Critical Severity Only</option>
              <option value="high">High Severity Only</option>
              <option value="medium">Medium Severity Only</option>
              <option value="">Any Severity</option>
            </select>
          </div>
        )}

        {(actionType === "send_notification" || actionType === "assign_remediation_task") && (
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
              Recipient / Assignee Email
            </label>
            <Input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="e.g. security-lead@lazynerds.com"
            />
          </div>
        )}

        {/* Safeguards & Governance */}
        <div className="pt-2 space-y-2 border-t border-zinc-100 dark:border-[#222630]">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requiresApproval"
              checked={requiresApproval}
              onChange={(e) => setRequiresApproval(e.target.checked)}
              className="rounded border-zinc-300 dark:border-[#222630] text-[#F5C518] focus:ring-[#F5C518] h-4 w-4 bg-white dark:bg-[#161920]"
            />
            <label htmlFor="requiresApproval" className="text-xs text-zinc-700 dark:text-[#9CA3AF] select-none">
              <span className="font-semibold text-amber-600 dark:text-amber-400">Human Approval Gate:</span> Require administrator review before executing action
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-zinc-300 dark:border-[#222630] text-[#F5C518] focus:ring-[#F5C518] h-4 w-4 bg-white dark:bg-[#161920]"
            />
            <label htmlFor="isActive" className="text-xs text-zinc-700 dark:text-[#9CA3AF] select-none">
              Workflow rule is enabled and active
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-[#222630]">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving} className="border-zinc-200 dark:border-[#222630]">
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
            {ruleToEdit ? "Update Rule" : "Create Workflow"}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
