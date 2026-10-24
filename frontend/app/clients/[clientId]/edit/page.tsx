"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ClientForm } from "@/components/clients/client-form";
import { api } from "@/lib/api";
import { Client, ClientUpdateInput } from "@/types/client";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";

interface EditClientPageProps {
  params: Promise<{ clientId: string }>;
}

export default function EditClientPage({ params }: EditClientPageProps) {
  const resolvedParams = use(params);
  const clientId = resolvedParams.clientId;
  const router = useRouter();

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getClientById(clientId);
        setClient(data);
      } catch (err: any) {
        if (err.status === 404) {
          setError("This client could not be found.");
        } else {
          setError(err.message || "Failed to load client record.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [clientId]);

  const handleUpdate = async (data: ClientUpdateInput) => {
    await api.updateClient(clientId, data);
    router.push(`/clients/${clientId}`);
  };

  if (isLoading) {
    return (
      <AppShell title="Edit Client">
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
          <span className="text-xs font-mono">Loading existing client fields from database...</span>
        </div>
      </AppShell>
    );
  }

  if (error || !client) {
    return (
      <AppShell title="Client Not Found">
        <div className="max-w-md mx-auto py-16 text-center space-y-4">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
          <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            {error || "Client record not found"}
          </h2>
          <Link href="/clients" className="inline-block">
            <span className="text-xs text-brand-500 hover:underline">
              Return to Client Directory
            </span>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`Edit ${client.company_name}`}>
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Cancel and return to client profile</span>
          </Link>
          <span className="text-[11px] font-mono text-zinc-400">
            ID: {client.id.slice(0, 8)}...
          </span>
        </div>

        {/* Edit Card */}
        <div className="rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] p-6 shadow-xs space-y-6">
          <div className="border-b border-zinc-100 dark:border-[#222630] pb-4">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-[#F9FAFB]">
                Edit Organization Details
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30">
                {client.status.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1">
              Update organization properties and contact designations for <strong className="font-mono text-zinc-700 dark:text-[#F9FAFB]">{client.company_name}</strong>.
            </p>
          </div>

          <ClientForm
            initialData={client}
            onSubmit={handleUpdate}
            onCancel={() => router.push(`/clients/${client.id}`)}
            submitLabel="Save Changes"
          />
        </div>
      </div>
    </AppShell>
  );
}
