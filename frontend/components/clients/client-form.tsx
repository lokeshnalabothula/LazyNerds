"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { clientFormSchema, ClientFormData } from "@/lib/validators";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Client } from "@/types/client";
import {
  toDatetimeLocalValue,
  fromDatetimeLocalToIso,
  formatDateTime,
  getTimezonePreference,
  getTimezoneLabel,
} from "@/lib/utils";
import {
  AlertCircle,
  Clock,
  Building2,
  User,
  FileText,
  Save,
  CheckCircle2,
} from "lucide-react";

interface ClientFormProps {
  initialData?: Client;
  onSubmit: (data: any) => Promise<void>;
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

export const ClientForm: React.FC<ClientFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
  submitLabel = "Save Changes",
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTzLabel, setActiveTzLabel] = useState<string>("IST");

  React.useEffect(() => {
    const tz = getTimezonePreference();
    setActiveTzLabel(getTimezoneLabel(tz, new Date()));
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      company_name: initialData?.company_name || "",
      primary_contact_name: initialData?.primary_contact_name || "",
      primary_contact_email: initialData?.primary_contact_email || "",
      website: initialData?.website || "",
      phone: initialData?.phone || "",
      industry: initialData?.industry || "",
      notes: initialData?.notes || "",
      created_at: toDatetimeLocalValue(initialData?.created_at),
    },
  });

  const handleFormSubmit = async (data: ClientFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: any = {
        company_name: data.company_name.trim(),
        primary_contact_name: data.primary_contact_name.trim(),
        primary_contact_email: data.primary_contact_email.trim().toLowerCase(),
        website: data.website?.trim() ? data.website.trim() : null,
        phone: data.phone?.trim() ? data.phone.trim() : null,
        industry: data.industry?.trim() ? data.industry.trim() : null,
        notes: data.notes?.trim() ? data.notes.trim() : null,
      };
      // created_at is strictly immutable and only supplied on initial creation
      if (!initialData && data.created_at) {
        payload.created_at = fromDatetimeLocalToIso(data.created_at);
      }
      await onSubmit(payload);
    } catch (err: any) {
      setServerError(err.message || "Failed to persist client record. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {serverError && (
        <div className="p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Section 1: Organization Details */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <Building2 className="h-4 w-4 text-[#F5C518]" />
          <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            1. Organization Profile
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Company Name"
            required
            placeholder="e.g. Acme Sentinel Corp"
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

        {initialData ? (
          <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#F5C518]" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                Onboarding Registration ({activeTzLabel})
              </span>
            </div>
            <div className="text-xs font-mono text-zinc-600 dark:text-zinc-400 pt-0.5" suppressHydrationWarning>
              {formatDateTime(initialData.created_at)}
            </div>
            <p className="text-[10px] text-zinc-400">
              System registration timestamps are strictly immutable audit records.
            </p>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-[#F5C518]" />
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Client Addition Timestamp ({activeTzLabel})
              </span>
            </div>
            <Input
              label={`Date & Time Added (${activeTzLabel})`}
              type="datetime-local"
              hint={`Set the exact date and time in your operational time zone (${activeTzLabel}). Defaults to current time.`}
              error={errors.created_at?.message}
              {...register("created_at")}
            />
          </div>
        )}
      </div>

      {/* Section 2: Primary Security Contact */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <User className="h-4 w-4 text-[#F5C518]" />
          <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            2. Primary Security Contact
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Primary Contact Name"
            required
            placeholder="e.g. Alex Mercer"
            error={errors.primary_contact_name?.message}
            {...register("primary_contact_name")}
          />

          <Input
            label="Primary Contact Email"
            type="email"
            required
            placeholder="e.g. alex@acme.com"
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
            label="Phone Number"
            type="tel"
            placeholder="+1-555-0199"
            error={errors.phone?.message}
            {...register("phone")}
          />
        </div>
      </div>

      {/* Section 3: Context & Scoping Notes */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <FileText className="h-4 w-4 text-[#F5C518]" />
          <h2 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            3. Business Context & Scoping Notes
          </h2>
        </div>

        <Textarea
          label="Internal Scoping Notes"
          placeholder="Confidential notes on engagement history, preliminary scope, or client communication preferences."
          rows={4}
          error={errors.notes?.message}
          hint="Max 5,000 characters. Encrypted at rest, never executed as HTML."
          {...register("notes")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
            className="text-xs"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          isLoading={isSubmitting}
          className="text-xs bg-[#F5C518] hover:bg-[#FFD84D] text-[#111318] font-bold border-none shadow-sm gap-1.5"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{submitLabel}</span>
        </Button>
      </div>
    </form>
  );
};
