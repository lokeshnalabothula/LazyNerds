"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ClientWizard } from "@/components/clients/client-wizard";
import { api } from "@/lib/api";
import { ClientCreateInput } from "@/types/client";
import { ArrowLeft, Shield } from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();

  const handleCreate = async (data: ClientCreateInput) => {
    const created = await api.createClient(data);
    router.push(`/clients/${created.id}`);
  };

  return (
    <AppShell title="Register Client">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Navigation Breadcrumb & Back Action */}
        <div className="flex items-center justify-between">
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to Client Directory</span>
          </Link>

          <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
            <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
            <span>Multi-Step Client Onboarding</span>
          </div>
        </div>

        {/* Guided Wizard Container */}
        <ClientWizard
          onSubmit={handleCreate}
          onCancel={() => router.push("/clients")}
          submitLabel="Confirm & Register Client"
        />
      </div>
    </AppShell>
  );
}
