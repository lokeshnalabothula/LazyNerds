"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ClientForm } from "@/components/clients/client-form";
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
    <AppShell title="Create Client">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Client Directory</span>
          </Link>
        </div>

        {/* Card Header */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-6">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Create Client Organization
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Register a client company or partner organization and designate an authorized primary contact.
            </p>
          </div>

          <ClientForm
            onSubmit={handleCreate}
            onCancel={() => router.push("/clients")}
            submitLabel="Create Client"
          />
        </div>
      </div>
    </AppShell>
  );
}
