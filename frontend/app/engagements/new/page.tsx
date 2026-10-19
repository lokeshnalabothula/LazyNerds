"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EngagementWizard } from "@/components/engagements/engagement-wizard";
import { api } from "@/lib/api";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { EngagementCreateInput } from "@/types/engagement";

function CreateEngagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("client_id") || undefined;

  const handleSubmit = async (data: EngagementCreateInput) => {
    const created = await api.createEngagement(data);
    router.push(`/engagements/${created.id}`);
  };

  return (
    <AppShell title="New Engagement">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Navigation Breadcrumb & Back Action */}
        <div className="flex items-center justify-between">
          <Link
            href="/engagements"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Engagements Directory</span>
          </Link>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
            <span>Multi-Step Engagement Scoping</span>
          </div>
        </div>

        {/* Guided Wizard Container */}
        <EngagementWizard
          preselectedClientId={preselectedClientId}
          onSubmit={handleSubmit}
          onCancel={() => router.push("/engagements")}
          submitLabel="Confirm & Launch Engagement"
        />
      </div>
    </AppShell>
  );
}

export default function CreateEngagementPage() {
  return (
    <Suspense
      fallback={
        <AppShell title="New Engagement">
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin text-[#F5C518]" />
            <span className="text-xs font-mono">Initializing Engagement Scoping Wizard...</span>
          </div>
        </AppShell>
      }
    >
      <CreateEngagementContent />
    </Suspense>
  );
}
