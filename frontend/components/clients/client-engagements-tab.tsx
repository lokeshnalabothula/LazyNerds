"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  Engagement,
  ENGAGEMENT_STATUS_CONFIG,
  AUTHORIZATION_STATUS_CONFIG,
  EngagementStatus,
  AuthorizationStatus,
} from "@/types/engagement";
import { Client } from "@/types/client";
import { formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Layers,
  Calendar,
  Shield,
  ExternalLink,
  Edit2,
  AlertCircle,
  Loader2,
  User,
} from "lucide-react";

interface ClientEngagementsTabProps {
  client: Client;
}

export const ClientEngagementsTab: React.FC<ClientEngagementsTabProps> = ({ client }) => {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientEngagements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getEngagements({
        client_id: client.id,
        page_size: 50,
        sort_by: "created_at",
        sort_order: "desc",
      });
      setEngagements(res.items);
    } catch (err: any) {
      setError(err.message || "Failed to load engagements for this client.");
    } finally {
      setIsLoading(false);
    }
  }, [client.id]);

  useEffect(() => {
    fetchClientEngagements();
  }, [fetchClientEngagements]);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Layers className="h-4 w-4 text-brand-500" />
            Security Engagements ({engagements.length})
          </h3>
          <p className="text-xs text-zinc-500">
            Penetration tests, security audits, and compliance assessments scoped for {client.company_name}.
          </p>
        </div>

        {client.status === "active" ? (
          <Link href={`/engagements/new?client_id=${client.id}`}>
            <Button variant="primary" size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              <span>New Engagement</span>
            </Button>
          </Link>
        ) : (
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded">
            Client is archived
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchClientEngagements()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin text-brand-500" />
          <span className="text-xs font-mono">Loading client engagements...</span>
        </div>
      ) : engagements.length === 0 ? (
        <div className="py-12 px-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg space-y-3 bg-white/50 dark:bg-zinc-900/30">
          <Layers className="h-8 w-8 mx-auto text-zinc-400 opacity-60" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No security engagements found
            </p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              There are no security assessments currently configured for {client.company_name}.
            </p>
          </div>
          {client.status === "active" && (
            <Link href={`/engagements/new?client_id=${client.id}`}>
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Launch First Engagement
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {engagements.map((eng) => {
            const statusCfg =
              ENGAGEMENT_STATUS_CONFIG[eng.status as EngagementStatus] ||
              ENGAGEMENT_STATUS_CONFIG.draft;
            const authCfg =
              AUTHORIZATION_STATUS_CONFIG[eng.authorization_status as AuthorizationStatus] ||
              AUTHORIZATION_STATUS_CONFIG.not_confirmed;

            return (
              <div
                key={eng.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-3 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Link
                      href={`/engagements/${eng.id}`}
                      className="text-sm font-bold text-zinc-900 dark:text-zinc-100 hover:text-brand-500 line-clamp-1"
                    >
                      {eng.name}
                    </Link>
                    <p className="text-xs text-zinc-500 font-medium">
                      {eng.assessment_type}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${statusCfg.badgeClass} shrink-0`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dotClass}`} />
                    {statusCfg.label}
                  </span>
                </div>

                <div className="pt-1">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border ${authCfg.badgeClass}`}
                  >
                    <Shield className="h-3 w-3 shrink-0" />
                    {authCfg.label}
                  </span>
                </div>

                <div className="space-y-1 text-xs text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                    <span className="font-mono text-[11px]">
                      {eng.start_date ? formatDate(eng.start_date) : "Start unset"} →{" "}
                      {eng.due_date ? formatDate(eng.due_date) : "Due unset"}
                    </span>
                  </div>
                  {eng.assigned_to && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                      <span className="truncate text-[11px] font-mono text-zinc-600 dark:text-zinc-400">
                        {eng.assigned_to}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <Link
                    href={`/engagements/${eng.id}`}
                    className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline inline-flex items-center gap-1"
                  >
                    <span>View details</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>

                  <Link href={`/engagements/${eng.id}/edit`}>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
