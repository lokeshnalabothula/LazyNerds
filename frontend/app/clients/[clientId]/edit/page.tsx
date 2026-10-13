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
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Cancel and return to profile</span>
          </Link>
        </div>

        {/* Edit Card */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-6">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Edit Organization Details
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Modify client properties for <strong className="font-mono">{client.company_name}</strong>. Modifications are saved transactionally.
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
