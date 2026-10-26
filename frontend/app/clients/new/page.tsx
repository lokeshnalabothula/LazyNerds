"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ClientWizard } from "@/components/clients/client-wizard";
import { api } from "@/lib/api";
import { ClientCreateInput, Client } from "@/types/client";
import {
  ShieldAlert,
  Search,
  Plus,
  Network,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ArrowRight,
  ShieldCheck,
  Radio,
  FileCheck2,
  Building,
} from "lucide-react";

export default function NewClientPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login?redirect=%2Fclients%2Fnew");
    }
  }, [user, loading, router]);

  useEffect(() => {
    api.getClients({ page: 1, page_size: 5 })
      .then((res) => {
        if (res && res.items) setClients(res.items);
      })
      .catch(() => {
        // Fallback to sample data for underlay
      });
  }, []);

  const handleCreate = async (data: ClientCreateInput) => {
    const created = await api.createClient(data);
    router.push(`/clients/${created.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07080b] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div data-loading-state="complete" className="min-h-screen bg-[#07080b] text-[#F1F5F9] relative overflow-hidden font-sans">
      {/* Monochromatic Ambient Glow Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent blur-[140px] rounded-full" />
        <div className="absolute top-1/4 -left-48 w-[500px] h-[500px] bg-white/[0.025] blur-[130px] rounded-full" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[400px] bg-white/[0.02] blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />
      </div>

      {/* UNDERLAY: FULL FIXOPS CLIENT DIRECTORY WORKSPACE */}
      <div
        aria-hidden="true"
        className="min-h-screen w-full flex flex-col pointer-events-none select-none filter blur-[2px] opacity-70 transition-all relative z-10"
      >
        {/* Top App Navigation Bar */}
        <header className="w-full bg-[#11141A]/90 border-b border-[#232833] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00D2D3]/20 border border-[#00D2D3]/40 flex items-center justify-center">
                <ShieldCheck className="text-[#00D2D3] h-4 w-4" />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] font-semibold text-[#F1F5F9] tracking-tight flex items-center gap-1.5">
                  FixOps{" "}
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-[#181C24] border border-[#232833] text-[#00D2D3]">
                    SEC-OPS OS
                  </span>
                </span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-1 text-[13px] text-zinc-400 pl-4 border-l border-[#232833]">
              <span className="px-3 py-1.5 rounded-md bg-[#181C24] text-[#F1F5F9] font-medium flex items-center gap-1.5 border border-[#232833]">
                <Building className="h-4 w-4 text-[#00D2D3]" /> Client Directory
              </span>
              <span className="px-3 py-1.5 rounded-md hover:text-[#F1F5F9] transition-colors flex items-center gap-1.5">
                <Radio className="h-4 w-4" /> Active Telemetry
              </span>
              <span className="px-3 py-1.5 rounded-md hover:text-[#F1F5F9] transition-colors flex items-center gap-1.5">
                <FileCheck2 className="h-4 w-4" /> RoE Contracts
              </span>
              <span className="px-3 py-1.5 rounded-md hover:text-[#F1F5F9] transition-colors flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4" /> Threat Scope
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 font-mono text-emerald-400 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Daemon Cluster Online
            </div>
            <div className="w-8 h-8 rounded-full bg-[#202530] border border-[#2E3544] flex items-center justify-center text-zinc-300 font-mono text-[12px] font-semibold">
              {user?.full_name ? user.full_name.slice(0, 2).toUpperCase() : "LN"}
            </div>
          </div>
        </header>

        {/* Sub-Header Workspace Overview */}
        <div className="px-8 py-6 border-b border-[#232833] bg-[#11141A]/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-zinc-500 font-mono text-[12px] mb-1">
              <span>TENANT WORKSPACE</span>
              <span>/</span>
              <span className="text-zinc-400">ENTERPRISE CLIENTS</span>
            </div>
            <h2 className="text-2xl font-bold text-[#F1F5F9] tracking-tight flex items-center gap-3">
              Client Directory &amp; Scoping Registry
              <span className="px-2 py-0.5 rounded-md bg-[#00D2D3]/10 text-[#00D2D3] border border-[#00D2D3]/20 text-[12px] font-mono">
                {clients.length > 0 ? `${clients.length} Accounts` : "18 Accounts"}
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-zinc-500 h-4 w-4" />
              <div className="bg-[#0A0C10] border border-[#2E3544] rounded-lg pl-9 pr-4 py-2 font-mono text-[13px] text-zinc-500 w-64">
                Filter entities, ASN, CIDR...
              </div>
            </div>
            <div className="px-4 py-2 rounded-lg bg-[#00D2D3] text-[#0A0C10] font-semibold flex items-center gap-2 text-[14px]">
              <Plus className="h-4 w-4" /> Register Client
            </div>
          </div>
        </div>

        {/* Metric Badges */}
        <div className="px-8 py-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#11141A] border border-[#232833]">
            <div className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Active Targets</span>
              <Network className="text-[#00D2D3] h-4 w-4" />
            </div>
            <div className="text-[28px] font-bold text-[#F1F5F9] font-mono">1,482</div>
            <div className="text-[12px] text-emerald-400 flex items-center gap-1 mt-1 font-mono">
              +38 assets this week
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#11141A] border border-[#232833]">
            <div className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Boundaries Signed</span>
              <CheckCircle2 className="text-emerald-400 h-4 w-4" />
            </div>
            <div className="text-[28px] font-bold text-[#F1F5F9] font-mono">94.8%</div>
            <div className="text-[12px] text-zinc-400 mt-1 font-mono">16/18 RoE ratified</div>
          </div>

          <div className="p-4 rounded-xl bg-[#11141A] border border-[#232833]">
            <div className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Critical Vulnerabilities</span>
              <AlertTriangle className="text-[#F43F5E] h-4 w-4" />
            </div>
            <div className="text-[28px] font-bold text-[#F43F5E] font-mono">07</div>
            <div className="text-[12px] text-zinc-400 mt-1 font-mono">Under remediation SLA</div>
          </div>

          <div className="p-4 rounded-xl bg-[#11141A] border border-[#232833]">
            <div className="text-zinc-500 font-mono text-[11px] uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Assigned SecOps Nodes</span>
              <Cpu className="text-amber-400 h-4 w-4" />
            </div>
            <div className="text-[28px] font-bold text-[#F1F5F9] font-mono">42</div>
            <div className="text-[12px] text-zinc-400 mt-1 font-mono">3 Regions (US-East, EU, AP)</div>
          </div>
        </div>

        {/* Enterprise Directory Table View Underlay */}
        <div className="px-8 pb-10 flex-1">
          <div className="rounded-xl border border-[#232833] bg-[#11141A] overflow-hidden shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#232833] bg-[#181C24]/70 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-5">Enterprise Client</th>
                  <th className="py-3 px-4">Entity ID</th>
                  <th className="py-3 px-4">Status &amp; RoE</th>
                  <th className="py-3 px-4">Target Boundaries</th>
                  <th className="py-3 px-4">Primary Contact</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232833]/70 font-mono text-[12px] text-zinc-400">
                <tr className="hover:bg-[#181C24]/40 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#00D2D3]/10 border border-[#00D2D3]/30 flex items-center justify-center text-[#00D2D3] font-bold text-[14px]">
                        AC
                      </div>
                      <div>
                        <div className="font-semibold text-[#F1F5F9] text-[14px] font-sans">
                          Acroba Cloud Infrastructure
                        </div>
                        <div className="text-[12px] text-zinc-500 font-sans">
                          Cloud Hyperscaler &amp; Managed VPC
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">US-DE-99410</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Verified &amp; Monitored
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">24 Assets • 4 CIDR Subnets</td>
                  <td className="py-4 px-4">ciso@acroba-cloud.internal</td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#00D2D3] flex items-center justify-end gap-1">
                      Inspect Scope <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-[#181C24]/40 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-[14px]">
                        NP
                      </div>
                      <div>
                        <div className="font-semibold text-[#F1F5F9] text-[14px] font-sans">
                          Nova Pay Global
                        </div>
                        <div className="text-[12px] text-zinc-500 font-sans">
                          Fintech Settlement Rail &amp; Card Gateway
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">EU-IR-40119</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> RoE Pending Review
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">12 Hostnames • 1 ASN</td>
                  <td className="py-4 px-4">security-lead@novapay.io</td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#00D2D3] flex items-center justify-end gap-1">
                      Inspect Scope <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-[#181C24]/40 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-[14px]">
                        AF
                      </div>
                      <div>
                        <div className="font-semibold text-[#F1F5F9] text-[14px] font-sans">
                          Acme Financial Institutional
                        </div>
                        <div className="text-[12px] text-zinc-500 font-sans">
                          High-Frequency Custodial Services
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">US-NY-77281</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> RoE Ratified
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">82 Assets • 6 Cloud Projects</td>
                  <td className="py-4 px-4">ops-soc@acmefin.com</td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#00D2D3] flex items-center justify-end gap-1">
                      Inspect Scope <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>

                <tr className="hover:bg-[#181C24]/40 transition-colors">
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-[14px]">
                        HX
                      </div>
                      <div>
                        <div className="font-semibold text-[#F1F5F9] text-[14px] font-sans">
                          Helix Genomics Health Systems
                        </div>
                        <div className="text-[12px] text-zinc-500 font-sans">
                          HIPAA Regulated Biotech Infrastructure
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">US-MA-51002</td>
                  <td className="py-4 px-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Continuous Audit
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[#F1F5F9]">19 Assets • FHIR Endpoints</td>
                  <td className="py-4 px-4">compliance@helixgen.med</td>
                  <td className="py-4 px-4 text-right">
                    <span className="text-[#00D2D3] flex items-center justify-end gap-1">
                      Inspect Scope <ArrowRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SUBTLE DARK GLASS OVERLAY (STITCH SPEC: bg-[#07080b]/75 backdrop-blur-[10px]) */}
      <div
        onClick={() => router.push("/clients")}
        className="fixed inset-0 z-40 bg-[#07080b]/75 backdrop-blur-[10px] transition-all cursor-pointer"
      />

      {/* CENTERED LIQUID GLASS SCOPING MODAL (EXACT STITCH ADD CLIENT SCREEN) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto pointer-events-auto">
        <ClientWizard
          onSubmit={handleCreate}
          onCancel={() => router.push("/clients")}
          submitLabel="Confirm & Register Client"
        />
      </div>
    </div>
  );
}
