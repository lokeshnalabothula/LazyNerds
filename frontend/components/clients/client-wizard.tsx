"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientFormSchema, ClientFormData } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { ClientCreateInput } from "@/types/client";
import {
  Building2,
  User,
  CheckCircle2,
  ArrowRight,
  ChevronLeft,
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
  X,
  Terminal,
  Lock,
  Network,
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
    stageTag: "ORGANIZATION DETAILS",
    title: "Organization Details",
    subtitle: "Enter the legal company or enterprise organization name to establish tenancy.",
  },
  {
    id: "scope",
    number: 2,
    stageTag: "SCOPE DEFINITION",
    title: "Target Asset Scope",
    subtitle: "Define verified in-scope assets and designate the primary authorized security contact.",
  },
  {
    id: "industry",
    number: 3,
    stageTag: "BUSINESS CONTEXT & ROE",
    title: "Industry & Rules of Engagement",
    subtitle: "Select operational sector and establish confidential scoping context.",
  },
  {
    id: "review",
    number: 4,
    stageTag: "REVIEW & SUBMIT",
    title: "Review & Confirm Client Registration",
    subtitle: "Verify parameters before provisioning tenant workspace and security telemetry.",
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

  // Target Asset Scope tags (from Google Stitch ADD CLIENT screen)
  const [assetInput, setAssetInput] = useState<string>("");
  const [assets, setAssets] = useState<string[]>([
    "api.gateway.prod.corp",
    "auth.identity-sso.net",
    "198.51.100.0/24",
  ]);

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

  const handleAddAsset = () => {
    const trimmed = assetInput.trim();
    if (!trimmed) return;
    if (!assets.includes(trimmed)) {
      setAssets([...assets, trimmed]);
    }
    setAssetInput("");
  };

  const handleRemoveAsset = (indexToRemove: number) => {
    setAssets(assets.filter((_, idx) => idx !== indexToRemove));
  };

  const getAssetBadge = (val: string) => {
    if (val.includes("/") || /^\d+\./.test(val)) return "CIDR Block";
    if (val.includes("auth") || val.includes("login") || val.includes("vpn") || val.includes("sso")) return "Auth Gateway";
    return "FQDN";
  };

  const getAssetIcon = (val: string) => {
    if (val.includes("/") || /^\d+\./.test(val)) {
      return <Network className="h-4 w-4 text-white shrink-0" />;
    }
    if (val.includes("auth") || val.includes("login") || val.includes("vpn") || val.includes("sso")) {
      return <Lock className="h-4 w-4 text-white shrink-0" />;
    }
    return <Terminal className="h-4 w-4 text-white shrink-0" />;
  };

  // Validate current step fields before advancing
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

  const handleFormSubmit = async (data: ClientFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      // Append asset scope definition into notes if present
      let finalNotes = data.notes?.trim() || "";
      if (assets.length > 0 && !finalNotes.includes("Verified Asset Scope:")) {
        const scopeSummary = `Verified Asset Scope: ${assets.join(", ")}`;
        finalNotes = finalNotes ? `${finalNotes}\n\n${scopeSummary}` : scopeSummary;
      }

      const payload: ClientCreateInput = {
        company_name: data.company_name.trim(),
        primary_contact_name: data.primary_contact_name.trim(),
        primary_contact_email: data.primary_contact_email.trim().toLowerCase(),
        website: data.website?.trim() ? data.website.trim() : null,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        industry: data.industry?.trim() ? data.industry.trim() : null,
        notes: finalNotes || null,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && currentStep < 3) {
      const target = e.target as HTMLElement;
      if (target.id === "asset-input") {
        e.preventDefault();
        handleAddAsset();
        return;
      }
      if (target.tagName.toLowerCase() === "textarea") return;
      e.preventDefault();
      handleNext();
    }
  };

  return (
    <div
      className="w-full max-w-2xl mx-auto liquid-glass-modal rounded-2xl p-6 sm:p-10 space-y-7 relative transition-all animate-in fade-in zoom-in-95 duration-200"
      onKeyDown={handleKeyDown}
    >
      {/* Top Progress Bar & Step Badge (Stitch Royal Monochrome) */}
      <div className="space-y-4 -mb-1">
        {/* Step Indicator Beacon & Close Button */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono font-medium tracking-wider uppercase text-neutral-300">
            <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
            <span>{`STEP ${currentStep + 1} OF 4 • ${STEPS[currentStep].stageTag}`}</span>
          </div>
          {onCancel && (
            <button
              aria-label="Close modal"
              type="button"
              onClick={onCancel}
              className="rounded-xl p-2 text-neutral-400 hover:text-white hover:bg-white/10 transition-colors flex items-center justify-center focus:outline-none"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 4 Segmented Status Bar */}
        <nav aria-label="Step progress" className="grid grid-cols-4 gap-2 w-full mb-6">
          {[0, 1, 2, 3].map((idx) => {
            if (idx <= currentStep) {
              return (
                <div
                  key={idx}
                  className="h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-300"
                />
              );
            }
            return (
              <div
                key={idx}
                className="h-1.5 rounded-full bg-white/15 transition-all duration-300"
              />
            );
          })}
        </nav>
      </div>

      {/* Title Section */}
      <div className="space-y-1 pt-1">
        <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
          {STEPS[currentStep].title}
        </h1>
        <p className="text-sm text-neutral-400">
          {STEPS[currentStep].subtitle}
        </p>
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-3 animate-in fade-in">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-rose-300">Registration Failed</span>
            <p className="leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      {/* Step Content */}
      <div className="space-y-6">
        {/* Step 1 (Stage 1): Organization Details */}
        {currentStep === 0 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-400">
                Company or Organization Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center pointer-events-none text-neutral-400 font-mono text-sm">
                  <span>&gt;_</span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. Acme Sentinel Technologies Inc."
                  autoFocus
                  className={cn(
                    "w-full rounded-xl bg-white/[0.04] border border-white/10 text-white pl-12 pr-4 py-3.5 font-mono text-sm placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner",
                    errors.company_name && "border-rose-500 focus:border-rose-500"
                  )}
                  {...register("company_name")}
                />
              </div>
              {errors.company_name && (
                <p className="text-[11px] font-medium text-rose-400 pt-1">
                  {errors.company_name.message}
                </p>
              )}
              <p className="text-[11px] text-neutral-500 pt-0.5">
                Official corporate or entity name used across scopes, engagements, and reports.
              </p>
            </div>
          </div>
        )}

        {/* Step 2 (Stage 2): Target Asset Scope & Primary Security Contact (Stitch 0e64ccd307a64826b7fb972706a21c8e) */}
        {currentStep === 1 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Input & Asset Tag List */}
            <div className="space-y-3">
              <label className="block text-xs font-medium text-neutral-400" htmlFor="asset-input">
                Add Domain, Subdomain or Network Block
              </label>
              <div className="relative flex items-center rounded-xl bg-white/[0.04] border border-white/10 transition-all">
                <div className="absolute left-4 flex items-center pointer-events-none text-neutral-400 font-mono text-sm">
                  <span>&gt;_</span>
                </div>
                <input
                  id="asset-input"
                  type="text"
                  autoFocus
                  value={assetInput}
                  onChange={(e) => setAssetInput(e.target.value)}
                  placeholder="e.g. api.domain.corp"
                  className="w-full bg-transparent border-0 pl-11 pr-24 py-3.5 text-sm font-mono text-white placeholder-neutral-500 focus:ring-0 focus:outline-none"
                />
                <div className="absolute right-2">
                  <button
                    type="button"
                    onClick={handleAddAsset}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Scoped Inventory Status Bar */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium uppercase tracking-wider text-neutral-400">Scoped Inventory</span>
                <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 text-neutral-300 border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                  {assets.length} Targets Active
                </span>
              </div>

              {/* Scope Tags */}
              <div className="space-y-2.5 pt-1" id="assets-list">
                {assets.map((asset, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3 flex items-center justify-between text-sm font-mono transition-all hover:border-white/25"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="text-white p-1.5 rounded-lg bg-white/5 border border-white/10 flex-shrink-0">
                        {getAssetIcon(asset)}
                      </div>
                      <div className="truncate">
                        <span className="tracking-wide font-medium text-white">{asset}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3 flex-shrink-0 ml-3">
                      <span className="text-xs px-2.5 py-1 rounded-md bg-white/10 text-neutral-300 font-sans border border-white/10">
                        {getAssetBadge(asset)}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove asset ${asset}`}
                        onClick={() => handleRemoveAsset(idx)}
                        className="text-neutral-400 hover:text-white transition-colors p-1"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Authorized Security Point of Contact Section */}
            <div className="pt-4 border-t border-white/10 space-y-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-neutral-300">
                  Authorized Security Point of Contact
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    Primary Contact Full Name <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-neutral-500">
                      <User className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Alex Mercer"
                      className={cn(
                        "w-full rounded-xl bg-white/[0.04] border border-white/10 text-white py-2.5 pl-10 pr-3 font-mono text-[13px] placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner",
                        errors.primary_contact_name && "border-rose-500"
                      )}
                      {...register("primary_contact_name")}
                    />
                  </div>
                  {errors.primary_contact_name && (
                    <p className="text-[11px] font-medium text-rose-400">
                      {errors.primary_contact_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    Primary Contact Email <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="email"
                      placeholder="e.g. alex@acme.com"
                      className={cn(
                        "w-full rounded-xl bg-white/[0.04] border border-white/10 text-white py-2.5 pl-10 pr-3 font-mono text-[13px] placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner",
                        errors.primary_contact_email && "border-rose-500"
                      )}
                      {...register("primary_contact_email")}
                    />
                  </div>
                  {errors.primary_contact_email && (
                    <p className="text-[11px] font-medium text-rose-400">
                      {errors.primary_contact_email.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    Company Website
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Globe className="h-4 w-4" />
                    </div>
                    <input
                      type="url"
                      placeholder="https://acme.com"
                      className={cn(
                        "w-full rounded-xl bg-white/[0.04] border border-white/10 text-white py-2.5 pl-10 pr-3 font-mono text-[13px] placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner",
                        errors.website && "border-rose-500"
                      )}
                      {...register("website")}
                    />
                  </div>
                  {errors.website && (
                    <p className="text-[11px] font-medium text-rose-400">
                      {errors.website.message}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-neutral-400">
                    Contact Phone
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3.5 flex items-center pointer-events-none text-neutral-500">
                      <Phone className="h-4 w-4" />
                    </div>
                    <input
                      type="tel"
                      placeholder="+1 (555) 019-2834"
                      className={cn(
                        "w-full rounded-xl bg-white/[0.04] border border-white/10 text-white py-2.5 pl-10 pr-3 font-mono text-[13px] placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner",
                        errors.phone && "border-rose-500"
                      )}
                      {...register("phone")}
                    />
                  </div>
                  {errors.phone && (
                    <p className="text-[11px] font-medium text-rose-400">
                      {errors.phone.message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 (Stage 3): Industry & Context (Stitch 108b91754eb3464cb6a9c71a56ddfcce) */}
        {currentStep === 2 && (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-400">
                Industry Sector
              </label>
              <div
                role="radiogroup"
                aria-label="Industry Sector Selection"
                className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-2"
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
                        "rounded-xl p-4 border transition-all text-left flex flex-col justify-between relative group cursor-pointer",
                        isSelected
                          ? "bg-white/10 border-white text-white shadow-lg"
                          : "bg-white/[0.03] border-white/10 text-neutral-300 hover:bg-white/[0.06] hover:border-white/20"
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-3">
                          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white flex-shrink-0">
                            <Icon className="h-5 w-5" />
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-white shrink-0 ml-1" />
                          )}
                        </div>
                        <div className="text-sm font-semibold text-white leading-snug">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-neutral-400 leading-normal mt-1">
                          {item.desc}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Business Context & Scoping Notes */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-neutral-400 mb-1.5" htmlFor="notes">
                Confidential Scoping Notes & Rules of Engagement
              </label>
              <textarea
                id="notes"
                rows={3}
                placeholder="Include compliance requirements (e.g. SOC 2 Type II, ISO 27001, PCI-DSS), testing window restrictions, or specialized infrastructure parameters..."
                className="w-full rounded-xl bg-white/[0.04] border border-white/10 text-white p-3.5 font-mono text-[13px] placeholder-neutral-500 focus:border-white/30 focus:ring-1 focus:ring-white/20 focus:outline-none transition-all shadow-inner"
                {...register("notes")}
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                {`Optional operational notes. Stored securely and visible to authorized assessors (${formData.notes?.length || 0}/5000 chars)`}
              </p>
            </div>
          </div>
        )}

        {/* Step 4 (Stage 4): Review & Confirm (Stitch 868c8d7ea2bd400390651e386cdda121) */}
        {currentStep === 3 && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Organization Profile */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                      Organization Profile
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(0)}
                    className="text-[11px] text-white hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[11px] text-neutral-400 block font-mono">Company Name:</span>
                    <span className="font-semibold text-white text-sm">
                      {formData.company_name || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block font-mono">Industry Sector:</span>
                    <span className="text-neutral-300 font-medium">
                      {formData.industry || "Not specified (General Enterprise)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Target Asset Scope */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                      Target Asset Scope
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[11px] text-white hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] text-neutral-400 block font-mono">
                    {assets.length} In-Scope Boundary Endpoints:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {assets.slice(0, 3).map((a, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-white/10 border border-white/15 font-mono text-[11px] text-white">
                        {a}
                      </span>
                    ))}
                    {assets.length > 3 && (
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] text-neutral-400 font-mono">
                        +{assets.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Primary Contact Summary */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                      Security Contact
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="text-[11px] text-white hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[11px] text-neutral-400 block font-mono">Full Name:</span>
                    <span className="font-semibold text-white">
                      {formData.primary_contact_name || "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-neutral-300">
                    <Mail className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
                    <span className="font-mono text-[11px]">{formData.primary_contact_email || "—"}</span>
                  </div>
                  {formData.website && (
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Globe className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      <span className="font-mono text-[11px] truncate">{formData.website}</span>
                    </div>
                  )}
                  {formData.phone && (
                    <div className="flex items-center gap-1.5 text-neutral-300">
                      <Phone className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      <span className="font-mono text-[11px]">{formData.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Scoping & RoE Context Summary */}
              <div className="rounded-xl bg-white/[0.03] border border-white/10 p-4 space-y-2.5">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-white" />
                    <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                      Scoping & RoE Context
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-[11px] text-white hover:underline flex items-center gap-1 font-semibold"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <p className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed line-clamp-3">
                  {formData.notes || "No special scoping constraints or confidential context provided."}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Controls (Exact Stitch Specification) */}
      <div className="pt-6 border-t border-white/10 flex items-center justify-between gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          disabled={isSubmitting}
          className="px-5 py-2.5 text-sm font-medium"
        >
          <span>← Back</span>
        </Button>

        {currentStep < 3 ? (
          <Button
            type="button"
            variant="primary"
            onClick={handleNext}
            className="px-6 py-2.5 font-semibold text-sm shadow-md"
          >
            <span>Continue →</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            disabled={isSubmitting}
            onClick={handleSubmit(handleFormSubmit)}
            className="px-6 py-2.5 font-semibold text-sm shadow-md"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                <span>Registering Client…</span>
              </>
            ) : (
              <span>{submitLabel}</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
};
