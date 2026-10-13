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
import { toDatetimeLocalValue, fromDatetimeLocalToIso } from "@/lib/utils";
import { AlertCircle, Clock } from "lucide-react";

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
  submitLabel = "Save Client",
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const payload = {
        ...data,
        created_at: fromDatetimeLocalToIso(data.created_at),
      };
      await onSubmit(payload);
    } catch (err: any) {
      setServerError(err.message || "Failed to persist client record. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {serverError && (
        <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Core Company Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Company Name"
          required
          placeholder="e.g. Acme Sentinel Corp"
          error={errors.company_name?.message}
          {...register("company_name")}
        />

        <Select
          label="Industry"
          options={INDUSTRY_OPTIONS}
          error={errors.industry?.message}
          {...register("industry")}
        />
      </div>

      {/* Primary Contact Details */}
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

      {/* Communication & Web */}
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

      {/* Onboarding Timestamp Setting */}
      <div className="p-3.5 rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            Client Addition Timestamp
          </span>
        </div>
        <Input
          label="Date & Time Added (Local Time)"
          type="datetime-local"
          hint="Set the exact date and time this client was onboarded. Defaults to current local time."
          error={errors.created_at?.message}
          {...register("created_at")}
        />
      </div>

      {/* Notes */}
      <Textarea
        label="Internal Engagement Notes"
        placeholder="Confidential notes on engagement history, preliminary scope, or client communication preferences."
        rows={4}
        error={errors.notes?.message}
        hint="Max 5,000 characters. Encrypted at rest, never executed as HTML."
        {...register("notes")}
      />

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" isLoading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
