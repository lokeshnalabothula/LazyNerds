"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientFormSchema, ClientFormData } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ClientCreateInput } from "@/types/client";
import {
  Building2,
  User,
  FileText,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Globe,
  Phone,
  Mail,
  Edit3,
  Landmark,
  Cloud,
  HeartPulse,
  ShoppingCart,
  Shield,
  Code2,
  Radio,
  Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientWizardProps {
  onSubmit: (data: ClientCreateInput) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

const INDUSTRY_ITEMS = [
  { value: "Fintech & Banking", label: "Fintech & Banking", icon: Landmark, desc: "Payment rails, core banking, financial services" },
  { value: "Cloud Services & Infrastructure", label: "Cloud & Infrastructure", icon: Cloud, desc: "Hosting, DevOps pipelines, multi-cloud platforms" },
  { value: "Healthcare & Life Sciences", label: "Healthcare & Life Sciences", icon: HeartPulse, desc: "HIPAA-regulated health data, biotech, diagnostics" },
  { value: "E-Commerce & Retail", label: "E-Commerce & Retail", icon: ShoppingCart, desc: "Online storefronts, consumer payment gateways" },
  { value: "Government & Public Sector", label: "Government & Public", icon: Building2, desc: "Civilian agencies, municipal public infrastructure" },
  { value: "Defense & Critical Infrastructure", label: "Defense & Critical Infra", icon: Shield, desc: "Mission-critical, operational technology, aerospace" },
  { value: "Software & SaaS", label: "Software & SaaS", icon: Code2, desc: "B2B SaaS, developer platforms, web applications" },
  { value: "Telecommunications", label: "Telecommunications", icon: Radio, desc: "Carriers, edge communications, ISP networks" },
  { value: "Other", label: "Other Business Sector", icon: Sparkles, desc: "Specialized, non-traditional or unlisted industry" },
];

const STEPS = [
  {
    id: "organization",
    number: 1,
    title: "Organization",
    subtitle: "Legal entity & company name",
    icon: Building2,
  },
  {
    id: "contact",
    number: 2,
    title: "Contact Info",
    subtitle: "Security point of contact",
    icon: User,
  },
  {
    id: "industry",
    number: 3,
    title: "Industry & Context",
    subtitle: "Sector & scoping parameters",
    icon: FileText,
  },
  {
    id: "review",
    number: 4,
    title: "Review & Confirm",
    subtitle: "Final data verification",
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

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
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
    },
  });

  const formData = watch();

  // Validate only the current step's fields before moving forward
  const handleNext = async () => {
    setServerError(null);
    let stepValid = false;

    if (currentStep === 0) {
      stepValid = await trigger(["company_name"]);
    } else if (currentStep === 1) {
      stepValid = await trigger([
        "primary_contact_name",
        "primary_contact_email",
        "website",
        "phone",
      ]);
    } else if (currentStep === 2) {
      stepValid = await trigger(["industry", "notes"]);
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
      const s0 = await trigger(["company_name"]);
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
      const s2 = await trigger(["industry", "notes"]);
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

      await onSubmit(payload);
    } catch (err: any) {
      setServerError(
        err.message || "Failed to persist client record. Please review details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Keyboard navigation: Enter on text inputs advances when valid
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
    return 100;
  };

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* Visual Stepper Bar */}
      <div className="rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#F5C518] animate-pulse motion-reduce:animate-none" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-700 dark:text-[#F9FAFB]">
              Stage {currentStep + 1} of {STEPS.length}: {STEPS[currentStep].title}
            </span>
          </div>
          <span className="text-xs font-mono font-bold text-[#B88700] dark:text-[#FFD84D]">
            {calculateProgress()}% Complete
          </span>
        </div>

        {/* Progress Track */}
        <div className="w-full bg-zinc-100 dark:bg-[#161920] h-1.5 rounded-full overflow-hidden mb-4 border border-transparent dark:border-[#222630]/60">
          <div
            className="h-full bg-gradient-to-r from-[#FFD84D] to-[#F5C518] transition-all duration-300 ease-out"
            style={{ width: `${calculateProgress()}%` }}
          />
        </div>

        {/* Clickable Step Pills */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {STEPS.map((step, idx) => {
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleStepClick(idx)}
                className={cn(
                  "p-2.5 rounded-lg border text-left transition-all duration-150 flex items-start gap-2.5 relative group",
                  isActive
                    ? "border-[#F5C518] bg-[#F5C518]/10 dark:bg-[#161920] shadow-xs ring-1 ring-[#F5C518]/30"
                    : isCompleted
                    ? "border-zinc-300 dark:border-[#222630] bg-white/60 dark:bg-[#161920]/40 hover:border-zinc-400 dark:hover:border-zinc-600"
                    : "border-zinc-200 dark:border-[#222630]/60 bg-zinc-100/30 dark:bg-[#111318]/40 text-zinc-400"
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
                      : "bg-zinc-200 dark:bg-[#161920] text-zinc-500"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.number}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-xs font-semibold truncate",
                      isActive
                        ? "text-zinc-900 dark:text-[#FFD84D]"
                        : isCompleted
                        ? "text-zinc-700 dark:text-[#F9FAFB]"
                        : "text-zinc-400 dark:text-[#6B7280]"
                    )}
                  >
                    {step.title}
                  </div>
                  <div className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] truncate hidden sm:block">
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
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold">Client Registration Error</span>
            <p className="leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Wizard Step Body */}
      <div className="rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] p-6 shadow-xs">
        {/* Stage 1: Organization Details */}
        {currentStep === 0 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#F5C518]" />
                Stage 1: Organization Details
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Enter the legal company or enterprise organization name to establish tenancy.
              </p>
            </div>

            <div className="max-w-xl">
              <Input
                label="Company or Organization Name"
                required
                placeholder="e.g. Acme Sentinel Technologies Inc."
                hint="Official corporate or entity name used across scopes, engagements, and reports"
                error={errors.company_name?.message}
                {...register("company_name")}
              />
            </div>
          </div>
        )}

        {/* Stage 2: Contact Information */}
        {currentStep === 1 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <User className="h-4 w-4 text-[#F5C518]" />
                Stage 2: Primary Security Contact
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Designate the authorized corporate representative for audit communication and deliverables.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Primary Contact Full Name"
                required
                placeholder="e.g. Alex Mercer"
                hint="Authorized representative, CISO, or security lead"
                error={errors.primary_contact_name?.message}
                {...register("primary_contact_name")}
              />

              <Input
                label="Primary Contact Email"
                type="email"
                required
                placeholder="e.g. alex@acme.com"
                hint="Destination for audit deliverables and critical vulnerability alerts"
                error={errors.primary_contact_email?.message}
                {...register("primary_contact_email")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <Input
                label="Company Website"
                type="url"
                placeholder="https://acme.com"
                hint="Optional corporate URL (must begin with http:// or https://)"
                error={errors.website?.message}
                {...register("website")}
              />

              <Input
                label="Contact Phone"
                type="tel"
                placeholder="+1 (555) 019-2834"
                hint="Optional direct line for high-severity incident notifications"
                error={errors.phone?.message}
                {...register("phone")}
              />
            </div>
          </div>
        )}

        {/* Stage 3: Industry & Business Context */}
        {currentStep === 2 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#F5C518]" />
                Stage 3: Industry Sector & Business Context
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Select the primary operational sector to configure relevant compliance benchmarks and threat intelligence.
              </p>
            </div>

            {/* Accessible Industry Icon Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Industry Sector
              </label>
              <div
                role="radiogroup"
                aria-label="Industry Sector Selection"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {INDUSTRY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isSelected = formData.industry === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setValue("industry", item.value, { shouldValidate: true })}
                      className={cn(
                        "p-3 rounded-xl border text-left transition-all duration-150 flex items-start gap-3 relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]",
                        isSelected
                          ? "border-[#F5C518] bg-[#F5C518]/10 dark:bg-[#161920] shadow-xs ring-1 ring-[#F5C518]/40"
                          : "border-zinc-200 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]/40 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-100/50 dark:hover:bg-[#161920]/80"
                      )}
                    >
                      <div
                        className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                          isSelected
                            ? "bg-[#F5C518] text-[#111318]"
                            : "bg-zinc-200 dark:bg-[#111318] text-zinc-400 dark:text-[#9CA3AF] group-hover:text-zinc-200"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-xs font-semibold block truncate",
                              isSelected
                                ? "text-zinc-900 dark:text-[#F9FAFB]"
                                : "text-zinc-700 dark:text-zinc-300"
                            )}
                          >
                            {item.label}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#F5C518] shrink-0 ml-1" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400 dark:text-[#9CA3AF] mt-0.5 line-clamp-2 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Business Context & Scoping Notes */}
            <div className="pt-2">
              <Textarea
                label="Confidential Scoping Notes & Business Context"
                rows={3}
                placeholder="Include compliance requirements (e.g. SOC 2 Type II, ISO 27001, PCI-DSS), testing window restrictions, or specialized infrastructure parameters..."
                hint={`Optional operational notes. Stored securely and visible to authorized assessors (${formData.notes?.length || 0}/5000 chars)`}
                error={errors.notes?.message}
                {...register("notes")}
              />
            </div>
          </div>
        )}

        {/* Stage 4: Review & Confirm */}
        {currentStep === 3 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#F5C518]" />
                Stage 4: Review & Confirm Client Registration
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Verify the client parameters before creating the operational workspace and tenant database record.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Organization Summary */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-[#F5C518]" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                      Organization Profile
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    className="text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 block font-mono">Company Name:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                      {formData.company_name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-zinc-400 block font-mono">Industry Sector:</span>
                    <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                      {formData.industry || "Not specified (General Enterprise)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Primary Contact Summary */}
              <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#F5C518]" />
                    <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                      Security Contact
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[11px] text-zinc-400 block font-mono">Full Name:</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {formData.primary_contact_name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                    <Mail className="h-3.5 w-3.5 text-[#F5C518] shrink-0" />
                    <span className="font-mono text-[11px]">{formData.primary_contact_email || "—"}</span>
                  </div>
                  {formData.website && (
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <Globe className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="font-mono text-[11px] truncate">{formData.website}</span>
                    </div>
                  )}
                  {formData.phone && (
                    <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
                      <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="font-mono text-[11px]">{formData.phone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Business Context & Scoping Notes Summary */}
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
              <div className="flex items-center justify-between border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#F5C518]" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
                    Scoping & Engagement Context
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-[11px] text-[#B88700] dark:text-[#FFD84D] hover:underline flex items-center gap-1 font-semibold"
                >
                  <Edit3 className="h-3 w-3" />
                  <span>Edit</span>
                </button>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed pt-1">
                {formData.notes || "No special scoping constraints or confidential context provided."}
              </p>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-6 border-t border-zinc-100 dark:border-[#222630] mt-6">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={isSubmitting}
            className="text-xs h-9 px-4 gap-1.5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>{currentStep === 0 ? "Cancel" : "Back"}</span>
          </Button>

          {currentStep < 3 ? (
            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="text-xs h-9 px-5 gap-1.5 btn-glossy-gold text-[#111318] font-bold border-none shadow-md"
            >
              <span>Continue to Stage {currentStep + 2}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              disabled={isSubmitting}
              onClick={handleSubmit(handleFormSubmit)}
              className="text-xs h-9 px-5 gap-1.5 btn-glossy-gold text-[#111318] font-bold border-none shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  <span>Registering Client…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  <span>{submitLabel}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
