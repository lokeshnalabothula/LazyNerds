"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { engagementFormSchema, EngagementFormData } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  EngagementCreateInput,
  ASSESSMENT_TYPE_OPTIONS,
  ENGAGEMENT_STATUS_CONFIG,
  AUTHORIZATION_STATUS_CONFIG,
} from "@/types/engagement";
import { Client } from "@/types/client";
import { api } from "@/lib/api";
import {
  Layers,
  Building2,
  Calendar,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Shield,
  Search,
  User,
  Clock,
  Edit3,
  Loader2,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementWizardProps {
  preselectedClientId?: string;
  onSubmit: (data: EngagementCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const STEPS = [
  {
    id: "basics",
    number: 1,
    title: "Basics",
    subtitle: "Assessment title & methodology",
    icon: Layers,
  },
  {
    id: "client",
    number: 2,
    title: "Client Association",
    subtitle: "Select target organization",
    icon: Building2,
  },
  {
    id: "schedule",
    number: 3,
    title: "Schedule & Scope",
    subtitle: "Timeline & RoE authorization",
    icon: Calendar,
  },
  {
    id: "review",
    number: 4,
    title: "Review & Launch",
    subtitle: "Operational verification",
    icon: CheckCircle2,
  },
];

export const EngagementWizard: React.FC<EngagementWizardProps> = ({
  preselectedClientId,
  onSubmit,
  onCancel,
  submitLabel = "Confirm & Launch Engagement",
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(true);
  const [clientSearch, setClientSearch] = useState<string>("");

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EngagementFormData>({
    resolver: zodResolver(engagementFormSchema),
    mode: "onTouched",
    defaultValues: {
      name: "",
      assessment_type: "Web App Pen Test",
      description: "",
      client_id: preselectedClientId || "",
      start_date: "",
      due_date: "",
      authorization_status: "not_confirmed",
      assigned_to: "",
      scope_summary: "",
      status: "draft",
    },
  });

  const formData = watch();

  // Load active clients
  useEffect(() => {
    let isMounted = true;
    async function loadClients() {
      setIsLoadingClients(true);
      try {
        const response = await api.getClients({ page_size: 100, status: "active" });
        if (isMounted) {
          const list = response.items || [];
          setClients(list);
          if (preselectedClientId) {
            setValue("client_id", preselectedClientId);
          } else if (list.length > 0 && !formData.client_id) {
            setValue("client_id", list[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setServerError(err.message || "Failed to load active clients.");
        }
      } finally {
        if (isMounted) {
          setIsLoadingClients(false);
        }
      }
    }
    loadClients();
    return () => {
      isMounted = false;
    };
  }, [preselectedClientId, setValue]);

  const selectedClient = clients.find((c) => c.id === formData.client_id);

  const filteredClients = clients.filter((c) => {
    const q = clientSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      c.company_name.toLowerCase().includes(q) ||
      c.primary_contact_name.toLowerCase().includes(q) ||
      c.primary_contact_email.toLowerCase().includes(q) ||
      (c.industry && c.industry.toLowerCase().includes(q))
    );
  });

  // Step validation
  const handleNext = async () => {
    setServerError(null);
    let stepValid = false;

    if (currentStep === 0) {
      stepValid = await trigger(["name", "assessment_type", "description"]);
    } else if (currentStep === 1) {
      stepValid = await trigger(["client_id"]);
      if (!formData.client_id) {
        setServerError("Please select an authorized client organization.");
        return;
      }
    } else if (currentStep === 2) {
      stepValid = await trigger([
        "start_date",
        "due_date",
        "authorization_status",
        "assigned_to",
        "scope_summary",
      ]);
    }

    if (stepValid) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }
  };

  const handleBack = () => {
    setServerError(null);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else if (onCancel) {
      onCancel();
    }
  };

  const handleStepClick = async (targetStep: number) => {
    if (targetStep === currentStep) return;
    if (targetStep < currentStep) {
      setServerError(null);
      setCurrentStep(targetStep);
      return;
    }
    // Validation before jumping forward
    let canAdvance = true;
    if (currentStep === 0 || targetStep > 0) {
      const s0 = await trigger(["name", "assessment_type"]);
      if (!s0) canAdvance = false;
    }
    if (canAdvance && (currentStep === 1 || targetStep > 1)) {
      const s1 = await trigger(["client_id"]);
      if (!s1 || !formData.client_id) canAdvance = false;
    }
    if (canAdvance && (currentStep === 2 || targetStep > 2)) {
      const s2 = await trigger(["start_date", "due_date", "authorization_status"]);
      if (!s2) canAdvance = false;
    }

    if (canAdvance) {
      setServerError(null);
      setCurrentStep(targetStep);
    }
  };

  const handleFormSubmit = async (data: EngagementFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: EngagementCreateInput = {
        client_id: data.client_id,
        name: data.name.trim(),
        assessment_type: data.assessment_type,
        status: data.status,
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        description: data.description?.trim() || null,
        scope_summary: data.scope_summary?.trim() || null,
        authorization_status: data.authorization_status,
        assigned_to: data.assigned_to?.trim() || null,
      };

      await onSubmit(payload);
    } catch (err: any) {
      setServerError(
        err.message || "Failed to create engagement record. Please check details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentStep < 3) {
      const target = e.target as HTMLElement;
      if (target.tagName.toLowerCase() === "textarea") return;
      e.preventDefault();
      handleNext();
    }
  };

  const calculateProgress = () => {
    if (currentStep === 0) return 25;
    if (currentStep === 1) return 50;
    if (currentStep === 2) return 75;
    return 90;
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* Visual Stepper Bar */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111318] p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#F5C518]" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Step {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#B88700] dark:text-[#FFD84D]">
            {calculateProgress()}% Complete
          </span>
        </div>

        {/* Progress Track */}
        <div className="h-1.5 w-full bg-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-[#F5C518] transition-all duration-300 ease-out"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>

        {/* Step Tabs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = currentStep === idx;
            const isCompleted = currentStep > idx;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(idx)}
                className={cn(
                  "p-2.5 rounded-lg border text-left transition-all duration-150 flex items-start gap-2.5 relative group",
                  isActive
                    ? "border-[#F5C518] bg-white dark:bg-[#1B1E24] shadow-xs"
                    : isCompleted
                    ? "border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40 hover:border-zinc-400 dark:hover:border-zinc-600"
                    : "border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/30 dark:bg-zinc-900/20 text-zinc-400"
                )}
                aria-current={isActive ? "step" : undefined}
              >
                <div
                  className={cn(
                    "h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-xs font-mono font-bold mt-0.5",
                    isActive
                      ? "bg-[#F5C518] text-[#111318]"
                      : isCompleted
                      ? "bg-[#F5C518]/20 text-[#B88700] dark:text-[#FFD84D]"
                      : "bg-zinc-200 dark:bg-zinc-800 text-zinc-500"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-xs font-semibold truncate",
                      isActive
                        ? "text-zinc-900 dark:text-zinc-100"
                        : isCompleted
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400 dark:text-zinc-500"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-zinc-400 truncate hidden sm:block">
                    {step.subtitle}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Configuration Error</span>
            <p className="leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Wizard Step Body */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111318] p-6 shadow-xs">
        {/* Step 1: Engagement Basics */}
        {currentStep === 0 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#F5C518]" />
                Engagement Basics
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Define the assessment name, security methodology, and high-level operational objective.
              </p>
            </div>

            <div className="space-y-4">
              <Input
                label="Engagement Title"
                required
                placeholder="e.g. Q4 2026 External Network & Web Application Assessment"
                hint="Descriptive name visible across dashboards and generated reports"
                error={errors.name?.message}
                {...register("name")}
              />

              <Select
                label="Assessment Methodology / Type"
                required
                options={ASSESSMENT_TYPE_OPTIONS}
                error={errors.assessment_type?.message}
                {...register("assessment_type")}
              />

              <Textarea
                label="Assessment Description & Context"
                placeholder="High-level description of testing goals, compliance drivers (e.g. SOC2, ISO 27001), or customer background..."
                rows={4}
                hint="Optional. Max 10,000 characters."
                error={errors.description?.message}
                {...register("description")}
              />
            </div>
          </div>
        )}

        {/* Step 2: Client Association */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-[#F5C518]" />
                  Client Organization Selection
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Select the active client organization authorizing and receiving this security engagement.
                </p>
              </div>
              <Link
                href="/clients/new"
                target="_blank"
                className="inline-flex items-center gap-1.5 text-xs text-[#B88700] dark:text-[#FFD84D] hover:underline font-mono shrink-0"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Register New Client</span>
              </Link>
            </div>

            {/* Selected Client Preview Banner */}
            {selectedClient && (
              <div className="p-4 rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 dark:bg-[#F5C518]/10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-[#F5C518] text-[#111318] flex items-center justify-center font-bold text-sm shrink-0">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {selectedClient.company_name}
                      </span>
                      <span className="px-1.5 py-0.2 bg-[#F5C518]/20 text-[#B88700] dark:text-[#FFD84D] text-[10px] font-mono rounded">
                        Selected Client
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      Primary Contact: {selectedClient.primary_contact_name} ({selectedClient.primary_contact_email})
                    </div>
                  </div>
                </div>
                <div className="text-xs font-mono text-zinc-400 shrink-0 hidden md:block">
                  {selectedClient.industry || "General Industry"}
                </div>
              </div>
            )}

            {/* Search Filter */}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search active clients by company name, contact, or email..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#F5C518]"
              />
            </div>

            {/* Client Directory List */}
            {isLoadingClients ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
                <Loader2 className="h-5 w-5 animate-spin text-[#F5C518]" />
                <span className="text-xs font-mono">Loading active client directory...</span>
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="py-8 text-center space-y-2 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                <Building2 className="h-6 w-6 text-zinc-400 mx-auto" />
                <p className="text-xs text-zinc-500">
                  {clientSearch ? "No clients match your search query." : "No active clients found in directory."}
                </p>
                <Link href="/clients/new">
                  <Button size="sm" variant="outline" className="text-xs mt-2">
                    Create New Client First
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto space-y-2 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 bg-zinc-50/30 dark:bg-zinc-900/20">
                {filteredClients.map((client) => {
                  const isSelected = formData.client_id === client.id;
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setValue("client_id", client.id, { shouldValidate: true });
                        setServerError(null);
                      }}
                      className={cn(
                        "w-full p-3 rounded-lg border text-left transition-all duration-150 flex items-center justify-between gap-3",
                        isSelected
                          ? "border-[#F5C518] bg-[#F5C518]/10 dark:bg-[#F5C518]/15 shadow-xs"
                          : "border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-[#1B1E24]/60 hover:border-zinc-300 dark:hover:border-zinc-700"
                      )}
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div
                          className={cn(
                            "h-4 w-4 rounded-full border flex items-center justify-center shrink-0",
                            isSelected
                              ? "border-[#F5C518] bg-[#F5C518]"
                              : "border-zinc-400 dark:border-zinc-600"
                          )}
                        >
                          {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-[#111318]" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {client.company_name}
                          </div>
                          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                            {client.primary_contact_name} • {client.primary_contact_email}
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                        {client.industry || "Active"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Schedule & Scope */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#F5C518]" />
                Schedule & Authorization
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Set operational timeline dates, lead assessor, and Rules of Engagement (RoE) signoff.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Operational Start Date"
                type="date"
                hint="Assessment execution or kickoff date"
                error={errors.start_date?.message}
                {...register("start_date")}
              />

              <Input
                label="Target Delivery / Due Date"
                type="date"
                hint="Report deliverable deadline (must be >= start date)"
                error={errors.due_date?.message}
                {...register("due_date")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Rules of Engagement (RoE) Authorization Status"
                required
                options={[
                  { value: "not_confirmed", label: "Not Confirmed (Authorization Letter Missing)" },
                  { value: "pending", label: "Pending Written Auth (Agreement in Progress)" },
                  { value: "confirmed", label: "Confirmed (RoE Fully Executed & Signed)" },
                ]}
                error={errors.authorization_status?.message}
                {...register("authorization_status")}
              />

              <Input
                label="Lead Assessor / Assigned Engineer"
                placeholder="e.g. Security Lead Alex"
                hint="Principal assessor overseeing execution"
                error={errors.assigned_to?.message}
                {...register("assigned_to")}
              />
            </div>

            <Textarea
              label="Defined Scope Summary"
              placeholder="e.g. *.example.com, 192.168.1.0/24, REST API at api.example.com/v2. Exclude production billing endpoints."
              rows={4}
              hint="High-level boundary targets, CIDR notations, and explicit exclusions."
              error={errors.scope_summary?.message}
              {...register("scope_summary")}
            />
          </div>
        )}

        {/* Step 4: Review & Launch */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#F5C518]" />
                Review & Initialize Engagement
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Verify testing scope and authorize the initial operational status.
              </p>
            </div>

            {/* Initial Status Configuration */}
            <div className="p-4 rounded-lg border border-[#F5C518]/30 bg-[#F5C518]/5 dark:bg-[#F5C518]/10 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#F5C518]" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Initial Operational Status
                </span>
              </div>
              <Select
                options={[
                  { value: "draft", label: "Draft (Scoping in progress, not visible on active radars)" },
                  { value: "planned", label: "Planned (Scheduled for upcoming sprint)" },
                  { value: "in_progress", label: "In Progress (Active penetration testing underway)" },
                  { value: "on_hold", label: "On Hold (Awaiting client response or scope adjustment)" },
                ]}
                error={errors.status?.message}
                {...register("status")}
              />
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Basics Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Layers className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>Basics</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline font-mono"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-zinc-400 text-[11px]">Title:</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formData.name || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[11px]">Methodology:</span>
                    <div className="text-zinc-700 dark:text-zinc-300 font-mono text-[11px]">
                      {formData.assessment_type}
                    </div>
                  </div>
                </div>
              </div>

              {/* Client Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Building2 className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>Client</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline font-mono"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-zinc-400 text-[11px]">Organization:</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {selectedClient?.company_name || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[11px]">Primary Contact:</span>
                    <div className="text-zinc-700 dark:text-zinc-300 text-[11px]">
                      {selectedClient ? `${selectedClient.primary_contact_name} (${selectedClient.primary_contact_email})` : "—"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule & RoE Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Calendar className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>Schedule & RoE</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-1 text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline font-mono"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-zinc-400 text-[11px]">Dates:</span>
                    <div className="font-mono text-zinc-800 dark:text-zinc-200 text-[11px]">
                      {formData.start_date || "TBD"} &rarr; {formData.due_date || "TBD"}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[11px]">Authorization:</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-[11px]">
                      {AUTHORIZATION_STATUS_CONFIG[formData.authorization_status as keyof typeof AUTHORIZATION_STATUS_CONFIG]?.label || formData.authorization_status}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scope Summary Preview */}
            {formData.scope_summary && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-1.5">
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Target Scope Definition:
                </span>
                <p className="text-xs font-mono text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {formData.scope_summary}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Wizard Action Footer */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-zinc-100 dark:border-zinc-800">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{currentStep === 0 ? "Cancel" : "Back"}</span>
          </Button>

          <div className="flex items-center gap-3">
            {currentStep < 3 ? (
              <Button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 text-xs bg-[#F5C518] hover:bg-[#FFD84D] text-[#111318] font-semibold border-none shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit(handleFormSubmit)}
                isLoading={isSubmitting}
                className="flex items-center gap-1.5 text-xs bg-[#F5C518] hover:bg-[#FFD84D] text-[#111318] font-bold border-none shadow-md px-5"
              >
                <Shield className="h-4 w-4" />
                <span>{submitLabel}</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
