"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { EngagementForm } from "@/components/engagements/engagement-form";
import { api } from "@/lib/api";
import { ArrowLeft, Loader2 } from "lucide-react";

function CreateEngagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client_id") || undefined;

  const handleSubmit = async (data: any) => {
    const created = await api.createEngagement(data);
    router.push(`/engagements/${created.id}`);
  };

  return (
    <AppShell title="Create Engagement">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/engagements"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Engagements Directory</span>
          </Link>
        </div>

        {/* Card Header */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-6">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Create Security Engagement
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Configure a new security assessment, penetration test, or compliance review scoped to an active client.
            </p>
          </div>

          <EngagementForm
            preselectedClientId={preselectedClientId}
            onSubmit={handleSubmit}
            onCancel={() => router.push("/engagements")}
            submitLabel="Create Engagement"
          />
        </div>
      </div>
    </AppShell>
  );
}

export default function CreateEngagementPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="Create Engagement">
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            <span className="text-xs font-mono">Initializing Engagement Form...</span>
          </div>
        </AppShell>
      }
    >
      <CreateEngagementContent />
    </Suspense>
  );
}
