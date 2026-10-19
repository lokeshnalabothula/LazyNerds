"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EngagementForm } from "@/components/engagements/engagement-form";
import { api } from "@/lib/api";
import { Engagement } from "@/types/engagement";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

interface EditEngagementPageProps {
  params: Promise<{ engagementId: string }>;
}

export default function EditEngagementPage({ params }: EditEngagementPageProps) {
  const resolvedParams = use(params);
  const engagementId = resolvedParams.engagementId;
  const router = useRouter();

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getEngagementById(engagementId);
        setEngagement(data);
      } catch (err: any) {
        if (err.status === 404) {
          setError("This engagement could not be found.");
        } else {
          setError(err.message || "Failed to load engagement record.");
        }
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [engagementId]);

  const handleSubmit = async (data: any) => {
    if (!engagement) return;
    const updated = await api.updateEngagement(engagement.id, data);
    router.push(`/engagements/${updated.id}`);
  };

  if (isLoading) {
    return (
      <AppShell title="Edit Engagement">
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <span className="text-xs font-mono">Loading engagement data...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !engagement) {
    return (
      <AppShell title="Engagement Not Found">
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {error || "Engagement Not Found"}
            </h2>
            <p className="text-xs text-zinc-500">
              The engagement you are trying to edit does not exist or may have been deleted.
            </p>
          </div>
          <Link href="/engagements">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Return to Engagements Directory
            </Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Edit: ${engagement.name}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/engagements/${engagement.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Engagement Details</span>
          </Link>
          <span className="text-[11px] font-mono text-zinc-400">
            ID: {engagement.id.slice(0, 8)}...
          </span>
        </div>

        {/* Card Header & Form */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111318] p-6 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Edit Security Engagement
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30">
                {engagement.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Modify operational parameters, target scope definitions, or scheduling for <strong className="font-mono text-zinc-700 dark:text-zinc-300">{engagement.name}</strong>.
            </p>
          </div>

          <EngagementForm
            initialData={engagement}
            onSubmit={handleSubmit}
            onCancel={() => router.push(`/engagements/${engagement.id}`)}
            submitLabel="Save Changes"
          />
        </div>
      </div>
    </AppShell>
  );
}
