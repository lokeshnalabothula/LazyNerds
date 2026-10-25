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
import { Engagement, ASSESSMENT_TYPE_OPTIONS, ENGAGEMENT_STATUS_CONFIG, AUTHORIZATION_STATUS_CONFIG } from "@/types/engagement";
import { Client } from "@/types/client";
import { api } from "@/lib/api";
import { AlertCircle, Calendar, Shield, Building2, User, Layers, Info } from "lucide-react";

interface EngagementFormProps {
  initialData?: Engagement;
  preselectedClientId?: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
}

export const EngagementForm: React.FC<EngagementFormProps> = ({
  initialData,
  preselectedClientId,
  onSubmit,
  onCancel,
  submitLabel = "Save Engagement",
}) => {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(true);
  const [clientLoadError, setClientLoadError] = useState<string | null>(null);

  const defaultClientId = initialData?.client_id || preselectedClientId || "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<EngagementFormData>({
    resolver: zodResolver(engagementFormSchema),
    defaultValues: {
      client_id: defaultClientId,
      name: initialData?.name || "",
      assessment_type: initialData?.assessment_type || "Web App Pen Test",
      status: initialData?.status || "draft",
      start_date: initialData?.start_date || "",
      due_date: initialData?.due_date || "",
      description: initialData?.description || "",
      scope_summary: initialData?.scope_summary || "",
      authorization_status: initialData?.authorization_status || "not_confirmed",
      assigned_to: initialData?.assigned_to || "",
    },
  });

  useEffect(() => {
    let isMounted = true;
    async function loadClients() {
      setIsLoadingClients(true);
      try {
        const response = await api.getClients({ page_size: 100, status: "active" });
        if (isMounted) {
          setClients(response.items || []);
          if (defaultClientId) {
            setValue("client_id", defaultClientId);
          } else if (response.items?.length > 0 && !initialData) {
            setValue("client_id", response.items[0].id);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setClientLoadError(err.message || "Failed to load active clients.");
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
  }, [defaultClientId, initialData, setValue]);

  const handleFormSubmit = async (data: EngagementFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const payload: any = {
        client_id: data.client_id,
        name: data.name,
        assessment_type: data.assessment_type,
        status: initialData?.status === "completed" ? "completed" : data.status,
        start_date: data.start_date || null,
        due_date: data.due_date || null,
        description: data.description || null,
        scope_summary: data.scope_summary || null,
        authorization_status: data.authorization_status,
        assigned_to: data.assigned_to || null,
      };
      await onSubmit(payload);
    } catch (err: any) {
      setServerError(err.message || "An unexpected error occurred while saving the engagement.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const clientOptions = [
    ...(clients.length === 0 ? [{ value: "", label: isLoadingClients ? "Loading clients..." : "No active clients available" }] : []),
    ...clients.map((c) => ({
      value: c.id,
      label: `${c.company_name} (${c.primary_contact_name})`,
    })),
  ];

  const statusOptions = Object.entries(ENGAGEMENT_STATUS_CONFIG).map(([val, cfg]) => ({
    value: val,
    label: cfg.label,
  }));

  const authStatusOptions = Object.entries(AUTHORIZATION_STATUS_CONFIG).map(([val, cfg]) => ({
    value: val,
    label: cfg.label,
  }));

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-8 max-w-3xl">
      {serverError && (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Unable to process engagement submission</p>
            <p>{serverError}</p>
          </div>
        </div>
      )}

      {clientLoadError && (
        <div className="rounded-md border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <p>{clientLoadError}</p>
        </div>
      )}

      {/* Section A: Basic Information */}
      <div className="space-y-4">
        <div className="border-b border-zinc-200 dark:border-[#222630] pb-2">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] flex items-center gap-2 uppercase tracking-wider font-mono">
            <Building2 className="h-4 w-4 text-[#F5C518]" />
            1. Client & Methodology
          </h3>
          <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
            Define the target client, engagement title, and security assessment type.
          </p>
        </div>

        <div className="space-y-4">
          {/* Client Selection / Read-Only Display */}
          {initialData ? (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-[#222630] bg-zinc-50/50 dark:bg-[#161920]/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[#111318] border border-[#F5C518]/30 flex items-center justify-center text-[#F5C518]">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                    {initialData.client_company_name || "Associated Client Organization"}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                    Client association is locked to maintain audit trail integrity.
                  </div>
                </div>
              </div>
              <Link
                href={`/clients/${initialData.client_id}`}
                target="_blank"
                className="text-xs font-mono text-[#F5C518] hover:underline"
              >
                View Client &rarr;
              </Link>
            </div>
          ) : (
            <div>
              <Select
                label="Client Organization"
                required
                disabled={isLoadingClients || clients.length === 0}
                options={clientOptions}
                error={errors.client_id?.message}
                hint="Select an active client registered in the FixOps platform."
                {...register("client_id")}
              />
              {clients.length === 0 && !isLoadingClients && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  No active clients found. You must{" "}
                  <Link href="/clients/new" className="text-[#F5C518] underline font-medium">
                    create an active client
                  </Link>{" "}
                  first.
                </p>
              )}
            </div>
          )}

          {/* Engagement Name */}
          <Input
            label="Engagement Name"
            placeholder="e.g. Q4 Web Application Penetration Test"
            required
            error={errors.name?.message}
            hint="A clear, human-readable identifier for this assessment."
            {...register("name")}
          />

          {/* Assessment Type */}
          <Select
            label="Assessment Type"
            required
            options={ASSESSMENT_TYPE_OPTIONS}
            error={errors.assessment_type?.message}
            hint="Determines standard testing methodologies, compliance expectations, and reporting artifacts."
            {...register("assessment_type")}
          />

          {/* Description */}
          <Textarea
            label="Engagement Description"
            placeholder="High-level narrative outlining testing objectives, rules of engagement, and critical business context..."
            rows={3}
            error={errors.description?.message}
            hint="Optional contextual notes for the assessment team."
            {...register("description")}
          />
        </div>
      </div>

      {/* Section B: Scheduling & Lifecycle */}
      <div className="space-y-4">
        <div className="border-b border-zinc-200 dark:border-[#222630] pb-2">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] flex items-center gap-2 uppercase tracking-wider font-mono">
            <Calendar className="h-4 w-4 text-[#F5C518]" />
            2. Scheduling & Operational Lifecycle
          </h3>
          <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
            Manage assessment execution dates and operational status progression.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Scheduled Start Date"
            type="date"
            error={errors.start_date?.message}
            hint="Planned commencement date."
            {...register("start_date")}
          />

          <Input
            label="Scheduled Due Date"
            type="date"
            error={errors.due_date?.message}
            hint="Planned completion and reporting deadline."
            {...register("due_date")}
          />
        </div>

        <Select
          label="Lifecycle Status"
          required
          disabled={Boolean(initialData?.status === "completed")}
          options={statusOptions}
          error={errors.status?.message}
          hint={
            initialData?.status === "completed"
              ? "Completed engagements are in a terminal state and cannot be cancelled, archived, or transitioned."
              : "Operational state: Draft → Planned → In Progress → Completed / Cancelled."
          }
          {...register("status")}
        />
      </div>

      {/* Section C: Scope & Authorization */}
      <div className="space-y-4">
        <div className="border-b border-zinc-200 dark:border-[#222630] pb-2">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] flex items-center gap-2 uppercase tracking-wider font-mono">
            <Shield className="h-4 w-4 text-[#F5C518]" />
            3. Scope & Rules of Engagement (RoE)
          </h3>
          <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
            Track authorized target assets and verify written legal authorization.
          </p>
        </div>

        <Textarea
          label="Scope Summary"
          placeholder="e.g. In-scope targets: https://app.example.com, api.example.com, 192.0.2.0/24. Out-of-scope: Third-party billing providers, production email servers."
          rows={3}
          error={errors.scope_summary?.message}
          hint="Summarize target systems, CIDR blocks, domains, repositories, or exclusions."
          {...register("scope_summary")}
        />

        <Select
          label="Client Authorization Status"
          required
          options={authStatusOptions}
          error={errors.authorization_status?.message}
          hint="Confirmation of signed Rules of Engagement (ROA) or written assessment permission."
          {...register("authorization_status")}
        />
      </div>

      {/* Section D: Assignment */}
      <div className="space-y-4">
        <div className="border-b border-zinc-200 dark:border-[#222630] pb-2">
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] flex items-center gap-2 uppercase tracking-wider font-mono">
            <User className="h-4 w-4 text-[#F5C518]" />
            4. Assessor Assignment
          </h3>
          <p className="text-xs text-zinc-500 dark:text-[#9CA3AF]">
            Designate the lead penetration tester or security analyst responsible for delivery.
          </p>
        </div>

        <Input
          label="Assigned Lead Assessor"
          placeholder="e.g. alex.chen@lazynerds.com"
          error={errors.assigned_to?.message}
          hint="Designated team member leading the assessment execution."
          {...register("assigned_to")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-[#222630]">
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
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitting || (clients.length === 0 && !initialData)}
          className="text-xs gap-1.5"
        >
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
