"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Finding } from "@/types/finding";
import { Client } from "@/types/client";
import { FileCheck2, Loader2, ArrowRight } from "lucide-react";

interface ClientFindingsTabProps {
  client: Client;
}

export const ClientFindingsTab: React.FC<ClientFindingsTabProps> = ({ client }) => {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFindings = async () => {
      try {
        setLoading(true);
        // Fetch client's engagements first
        const engData = await api.getEngagements({ client_id: client.id, page_size: 100 });
        if (engData.items.length === 0) {
          setFindings([]);
          return;
        }

        const allFindings: Finding[] = [];
        for (const eng of engData.items) {
          const fData = await api.getFindings({ engagement_id: eng.id, page_size: 100 });
          allFindings.push(...fData.items);
        }
        setFindings(allFindings);
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    };
    fetchFindings();
  }, [client.id]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
            Vulnerability Findings ({findings.length})
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Active and resolved security findings discovered across all engagements for {client.company_name}.
          </p>
        </div>

        <Link
          href="/findings"
          className="text-xs text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1 font-medium"
        >
          <span>Findings Workspace</span>
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {loading && findings.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin mr-2 text-brand-500" />
          <span className="text-xs font-mono">Loading findings...</span>
        </div>
      ) : findings.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-zinc-300 dark:border-zinc-800 rounded-lg">
          <FileCheck2 className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
          <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">No findings recorded for this client</p>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Create an engagement or run a scan adapter to import findings.
          </p>
        </div>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900/60 shadow-xs">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-500">
                <th className="py-2.5 px-3 font-semibold">Severity</th>
                <th className="py-2.5 px-3 font-semibold">Vulnerability Title</th>
                <th className="py-2.5 px-3 font-semibold">Target Asset</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {findings.map((f) => (
                <tr key={f.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                        f.severity === "critical"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                          : f.severity === "high"
                          ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      }`}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100">
                    {f.title}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-500">
                    {f.asset_name || "System"}
                  </td>
                  <td className="py-2.5 px-3 capitalize text-zinc-600 dark:text-zinc-400">
                    {f.status.replace("_", " ")}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/findings/${f.id}`}
                      className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium"
                    >
                      Inspect &rarr;
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
