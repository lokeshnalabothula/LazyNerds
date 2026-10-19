"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientFormSchema, ClientFormData } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ClientCreateInput } from "@/types/client";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalToIso,
  formatDateTime,
  getTimezonePreference,
  getTimezoneLabel,
} from "@/lib/utils";
import {
  Building2,
  User,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Clock,
  Sparkles,
  Globe,
  Phone,
  Mail,
  Edit3,
  Shield,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientWizardProps {
  onSubmit: (data: ClientCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select an industry (optional)" },
  { value: "Fintech & Banking", label: "Fintech & Banking" },
  { value: "Cloud Services & Infrastructure", label: "Cloud Services & Infrastructure" },
  { value: "Healthcare & Life Sciences", label: "Healthcare & Life Sciences" },
  { value: "E-Commerce & Retail", label: "E-Commerce & Retail" },
  { value: "Government & Public Sector", label: "Government & Public Sector" },
  { value: "Defense & Critical Infrastructure", label: "Defense & Critical Infrastructure" },
  { value: "Software & SaaS", label: "Software & SaaS" },
  { value: "Telecommunications", label: "Telecommunications" },
  { value: "Other", label: "Other" },
];

const STEPS = [
  {
    id: "organization",
    number: 1,
    title: "Organization",
    subtitle: "Company profile & sector",
    icon: Building2,
  },
  {
    id: "contact",
    number: 2,
    title: "Contact Info",
    subtitle: "Authorized security lead",
    icon: User,
  },
  {
    id: "context",
    number: 3,
    title: "Business Context",
    subtitle: "Scoping notes & parameters",
    icon: FileText,
  },
  {
    id: "review",
    number: 4,
    title: "Review & Confirm",
    subtitle: "Final verification",
    icon: CheckCircle2,
  },
];

export const ClientWizard: React.FC<ClientWizardProps> = ({
  onSubmit,
  onCancel,
  submitLabel = "Confirm & Register Client",
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeTzLabel, setActiveTzLabel] = useState<string>("IST");

  useEffect(() => {
    const tz = getTimezonePreference();
    setActiveTzLabel(getTimezoneLabel(tz, new Date()));
  }, []);

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    mode: "onTouched",
    defaultValues: {
      company_name: "",
      primary_contact_name: "",
      primary_contact_email: "",
      website: "",
      phone: "",
      industry: "",
      notes: "",
      created_at: toDatetimeLocalValue(new Date().toISOString()),
    },
  });

  const formData = watch();

  // Step-level validation before advancing
  const handleNext = async () => {
    setServerError(null);
    let stepValid = false;

    if (currentStep === 0) {
      stepValid = await trigger(["company_name", "industry", "created_at"]);
    } else if (currentStep === 1) {
      stepValid = await trigger([
        "primary_contact_name",
        "primary_contact_email",
        "website",
        "phone",
      ]);
    } else if (currentStep === 2) {
      stepValid = await trigger(["notes"]);
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
    // Check validation of preceding steps before jumping forward
    let canAdvance = true;
    if (currentStep === 0 || targetStep > 0) {
      const s0 = await trigger(["company_name", "industry"]);
      if (!s0) canAdvance = false;
    }
    if (canAdvance && (currentStep === 1 || targetStep > 1)) {
      const s1 = await trigger([
        "primary_contact_name",
        "primary_contact_email",
        "website",
        "phone",
      ]);
      if (!s1) canAdvance = false;
    }
    if (canAdvance && (currentStep === 2 || targetStep > 2)) {
      const s2 = await trigger(["notes"]);
      if (!s2) canAdvance = false;
    }

    if (canAdvance) {
      setServerError(null);
      setCurrentStep(targetStep);
    }
  };

  const handleFormSubmit = async (data: ClientFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: ClientCreateInput = {
        company_name: data.company_name.trim(),
        primary_contact_name: data.primary_contact_name.trim(),
        primary_contact_email: data.primary_contact_email.trim().toLowerCase(),
        website: data.website?.trim() ? data.website.trim() : null,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        industry: data.industry?.trim() ? data.industry.trim() : null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
      };

      if (data.created_at) {
        payload.created_at = fromDatetimeLocalToIso(data.created_at);
      }

      await onSubmit(payload);
    } catch (err: any) {
      setServerError(
        err.message || "Failed to persist client record. Please review details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation: Enter on form inputs advances when valid
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentStep < 3) {
      const target = e.target as HTMLElement;
      // Allow Enter in textarea to insert newline
      if (target.tagName.toLowerCase() === "textarea") return;
      e.preventDefault();
      handleNext();
    }
  };

  // Non-misleading completion percentage (capped at 90% until creation succeeds)
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
        <div className="h-1.5 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden mb-5">
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
            <span className="font-semibold">Creation Error</span>
            <p className="leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Wizard Step Body */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111318] p-6 shadow-xs">
        {/* Step 1: Organization Details */}
        {currentStep === 0 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#F5C518]" />
                Organization Details
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Provide the registered legal or operating entity name and relevant industry sector.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Company Name"
                required
                placeholder="e.g. Acme Sentinel Corp"
                hint="Official corporate or organization name"
                error={errors.company_name?.message}
                {...register("company_name")}
              />

              <Select
                label="Industry Sector"
                options={INDUSTRY_OPTIONS}
                error={errors.industry?.message}
                {...register("industry")}
              />
            </div>

            {/* Onboarding Timestamp Setting */}
            <div className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#F5C518]" />
                <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Client Addition Timestamp ({activeTzLabel})
                </span>
              </div>
              <Input
                label={`Date & Time Added (${activeTzLabel})`}
                type="datetime-local"
                hint={`Set the exact date and time this client was onboarded in your operational time zone (${activeTzLabel}). Defaults to current time.`}
                error={errors.created_at?.message}
                {...register("created_at")}
              />
            </div>
          </div>
        )}

        {/* Step 2: Contact Information */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <User className="h-4 w-4 text-[#F5C518]" />
                Primary Security Contact
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Designate the authorized corporate representative for audit notifications and deliverables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Primary Contact Full Name"
                required
                placeholder="e.g. Alex Mercer"
                hint="Authorized representative or CISO"
                error={errors.primary_contact_name?.message}
                {...register("primary_contact_name")}
              />

              <Input
                label="Primary Contact Email"
                type="email"
                required
                placeholder="e.g. alex@acme.com"
                hint="Used for critical vulnerability alerts & reports"
                error={errors.primary_contact_email?.message}
                {...register("primary_contact_email")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Company Website"
                type="url"
                placeholder="https://acme.com"
                hint="Accepts standard HTTP/HTTPS addresses"
                error={errors.website?.message}
                {...register("website")}
              />

              <Input
                label="Direct Phone Number"
                type="tel"
                placeholder="+1-555-0199"
                hint="Emergency escalation phone number (optional)"
                error={errors.phone?.message}
                {...register("phone")}
              />
            </div>
          </div>
        )}

        {/* Step 3: Business Context & Scoping Notes */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#F5C518]" />
                Business Context & Scoping Notes
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Internal operational notes, compliance mandates, or engagement history. Encrypted at rest.
              </p>
            </div>

            <Textarea
              label="Internal Security & Scoping Notes"
              placeholder="Record confidential notes on engagement history, preliminary testing scope, infrastructure caveats, or client communication preferences."
              rows={6}
              error={errors.notes?.message}
              hint="Max 5,000 characters. Visible only to internal security personnel."
              {...register("notes")}
            />
          </div>
        )}

        {/* Step 4: Review & Final Confirmation */}
        {currentStep === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#F5C518]" />
                Review & Confirm Client Registration
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Verify all operational details below. Click Edit on any card to revise before creation.
              </p>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Organization Summary Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <Building2 className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>Organization Profile</span>
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
                    <span className="text-zinc-400 text-[11px]">Company Name:</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                      {formData.company_name || "—"}
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-400 text-[11px]">Industry Sector:</span>
                    <div className="text-zinc-700 dark:text-zinc-300">
                      {formData.industry || "General / Unspecified"}
                    </div>
                  </div>
                  {formData.created_at && (
                    <div>
                      <span className="text-zinc-400 text-[11px]">Onboarding Timestamp:</span>
                      <div className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">
                        {formatDateTime(fromDatetimeLocalToIso(formData.created_at))} ({activeTzLabel})
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Primary Contact Summary Card */}
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    <User className="h-3.5 w-3.5 text-[#F5C518]" />
                    <span>Authorized Contact</span>
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
                    <span className="text-zinc-400 text-[11px]">Contact Name:</span>
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formData.primary_contact_name || "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <Mail className="h-3 w-3 text-zinc-400" />
                    <span className="font-mono">{formData.primary_contact_email || "—"}</span>
                  </div>
                  {formData.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <Phone className="h-3 w-3 text-zinc-400" />
                      <span className="font-mono">{formData.phone}</span>
                    </div>
                  )}
                  {formData.website && (
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <Globe className="h-3 w-3 text-zinc-400" />
                      <span className="font-mono truncate">{formData.website}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Context & Scoping Notes Summary Card */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#1B1E24]/60 p-4 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  <FileText className="h-3.5 w-3.5 text-[#F5C518]" />
                  <span>Internal Scoping Notes</span>
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
              <div className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {formData.notes || (
                  <span className="text-zinc-400 italic">No preliminary scoping notes entered.</span>
                )}
              </div>
            </div>
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
