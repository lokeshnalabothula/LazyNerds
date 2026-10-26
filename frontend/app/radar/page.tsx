"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThinkingOrb } from "@/components/stitch/ThinkingOrb";
import { useToast } from "@/components/ui/toast";
import {
  Radar,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  Terminal,
  Crosshair,
  Lock,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
  Download,
  AlertTriangle,
} from "lucide-react";

export default function RadarWorkspacePage() {
  const { toast } = useToast();
  const [activeBlip, setActiveBlip] = useState<string | null>("INTRUSION_01");
  const [isQuarantining, setIsQuarantining] = useState(false);
  const [quarantinedNodes, setQuarantinedNodes] = useState<string[]>([]);

  const handleQuarantine = (nodeId: string) => {
    setIsQuarantining(true);
    setTimeout(() => {
      setQuarantinedNodes((prev) => [...prev, nodeId]);
      setIsQuarantining(false);
      toast.success(`Autonomous vector ${nodeId} successfully quarantined.`);
    }, 600);
  };

  return (
    <AppShell title="Orbital Defense Radar">
      <div className="space-y-6 max-w-[1720px] mx-auto pb-16">
        {/* ================= HERO SECTION: ORBITAL RADAR TELEMETRY CANVAS ================= */}
        <section className="relative rounded-2xl border border-white/[0.08] bg-[#0d0e13]/85 backdrop-blur-2xl overflow-hidden p-4 md:p-6 shadow-[0_0_50px_rgba(0,0,0,0.7)]">
          {/* Background Hairline Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#00f0ff_1px,transparent_1px)] [background-size:24px_24px]" />

          {/* Section Top Header & Coordinates */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/[0.06] relative z-10">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-xl bg-[#00f0ff]/10 border border-[#00f0ff]/30 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]">
                <Radar className="h-6 w-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#dbfcff]">
                    Orbital Defense Radar Workspace
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/40 uppercase tracking-wider">
                    GEO-SYNC · 35,786 KM
                  </span>
                </div>
                <p className="text-xs font-mono text-[#849495] mt-0.5">
                  AZIMUTH: 312.44° · ELEVATION: +48.19° · TARGET LOCK: 07 ANOMALIES INTERCEPTED
                </p>
              </div>
            </div>

            {/* Radar Mode Selector & ThinkingOrb Widget */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* ThinkingOrb: size sm, state='searching' */}
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[#161920]/80 border border-white/[0.08]">
                <ThinkingOrb state="searching" size="sm" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono font-bold text-[#00f0ff] uppercase tracking-wider">
                      THINKING_ORB
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-ping" />
                  </div>
                  <div className="text-xs font-mono font-semibold text-white">
                    state: &apos;searching&apos;
                  </div>
                  <div className="text-[10px] font-mono text-[#849495]">Cognitive: 8.94 GHz</div>
                </div>
              </div>

              {/* Resolution Controls */}
              <div className="hidden sm:flex flex-col gap-0.5 text-right font-mono">
                <div className="text-[10px] font-bold text-[#849495] uppercase tracking-wider">
                  FREQUENCY BAND
                </div>
                <div className="text-xs font-bold text-[#00f0ff]">Q-BAND · 42.5 GHz</div>
              </div>
            </div>
          </div>

          {/* Radar Display Layout: Split into Visual Radar + Waterfall Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5 relative z-10">
            {/* LEFT / CENTER: Interactive SVG Orbital Radar Canvas (8 Cols) */}
            <div className="lg:col-span-8 relative aspect-square sm:aspect-[16/10] max-h-[520px] rounded-xl bg-[#090a0f]/95 border border-white/[0.08] flex items-center justify-center overflow-hidden shadow-inner">
              {/* Coordinate HUD Marks */}
              <div className="absolute top-3 left-3 text-[10px] font-mono text-[#849495]">
                SECTOR: 09-ALPHA // ORBIT_NORTH
              </div>
              <div className="absolute top-3 right-3 text-[10px] font-mono text-[#00f0ff]/80">
                LATENCY: 142µs [NOMINAL]
              </div>
              <div className="absolute bottom-3 left-3 text-[10px] font-mono text-[#849495]">
                EPHEMERIS: SGP4_REV9982
              </div>
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-zinc-300">RADAR SYNC: 100%</span>
              </div>

              {/* Crosshairs Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-full h-px bg-white/[0.04]" />
                <div className="h-full w-px bg-white/[0.04] absolute" />
              </div>

              {/* SVG RADAR CANVAS */}
              <svg className="w-full h-full max-w-[500px] max-h-[500px] select-none" viewBox="0 0 600 600">
                {/* Radial Grid Concentric Rings */}
                <circle cx="300" cy="300" fill="none" opacity="0.3" r="260" stroke="#3b494b" strokeDasharray="4 4" strokeWidth="1" />
                <circle cx="300" cy="300" fill="none" opacity="0.4" r="200" stroke="#3b494b" strokeWidth="1" />
                <circle cx="300" cy="300" fill="none" opacity="0.5" r="140" stroke="#3b494b" strokeDasharray="2 2" strokeWidth="1" />
                <circle cx="300" cy="300" fill="none" opacity="0.3" r="80" stroke="#00f0ff" strokeWidth="1" />
                <circle cx="300" cy="300" fill="#00f0ff" fillOpacity="0.1" r="20" stroke="#00f0ff" strokeWidth="1.5" />

                {/* Orbital Ring Labels */}
                <text fill="#849495" fontFamily="JetBrains Mono, monospace" fontSize="9" x="305" y="105">R-35000 KM</text>
                <text fill="#849495" fontFamily="JetBrains Mono, monospace" fontSize="9" x="305" y="165">R-24000 KM</text>
                <text fill="#849495" fontFamily="JetBrains Mono, monospace" fontSize="9" x="305" y="225">R-12000 KM</text>

                {/* Radial Angle Lines */}
                <line opacity="0.25" stroke="#3b494b" strokeDasharray="2 4" strokeWidth="0.75" x1="116" x2="484" y1="116" y2="484" />
                <line opacity="0.25" stroke="#3b494b" strokeDasharray="2 4" strokeWidth="0.75" x1="484" x2="116" y1="116" y2="484" />

                {/* Active Sweeper Arm (Conic sector) */}
                <g className="radar-sweep-anim">
                  <defs>
                    <radialGradient cx="50%" cy="50%" id="sweeperGrad" r="50%">
                      <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#00f0ff" stopOpacity="0" />
                    </radialGradient>
                  </defs>
                  <path d="M 300 300 L 300 40 A 260 260 0 0 1 484 116 Z" fill="url(#sweeperGrad)" opacity="0.4" />
                  <line filter="drop-shadow(0 0 6px #00f0ff)" stroke="#00f0ff" strokeWidth="2" x1="300" x2="484" y1="300" y2="116" />
                </g>

                {/* Intercepted Attack Nodes (Target Blips) */}
                {/* Target Alpha: Critical Inbound */}
                <g
                  className="cursor-pointer group"
                  transform="translate(390, 190)"
                  onClick={() => setActiveBlip("INTRUSION_01")}
                >
                  <circle className="animate-ping" cx="0" cy="0" fill="#ff2e54" fillOpacity="0.2" r="14" />
                  <circle cx="0" cy="0" fill="#ff2e54" r="5" stroke="#ffffff" strokeWidth="1.5" />
                  <rect fill="#121318" height="20" rx="3" stroke="#ff2e54" strokeWidth="1" width="80" x="10" y="-14" />
                  <text fill="#ffb4ab" fontFamily="JetBrains Mono, monospace" fontSize="9" fontWeight="bold" x="14" y="-1">
                    ! INTRUSION_01
                  </text>
                </g>

                {/* Target Beta: Vector Probe */}
                <g
                  className="cursor-pointer group"
                  transform="translate(190, 160)"
                  onClick={() => setActiveBlip("SYN_FLOOD")}
                >
                  <circle cx="0" cy="0" fill="#00f0ff" r="4" stroke="#ffffff" strokeWidth="1" />
                  <line stroke="#00f0ff" strokeDasharray="2 2" strokeWidth="1" x1="0" x2="-20" y1="0" y2="-20" />
                  <rect fill="#121318" height="16" rx="2" stroke="#00f0ff" strokeWidth="0.8" width="65" x="-88" y="-32" />
                  <text fill="#00f0ff" fontFamily="JetBrains Mono, monospace" fontSize="8" x="-82" y="-20">
                    SYN_FLOOD
                  </text>
                </g>

                {/* Target Gamma: Neutralized Node */}
                <g
                  className="cursor-pointer group"
                  transform="translate(240, 410)"
                  onClick={() => setActiveBlip("ISOLATED_NODE_72")}
                >
                  <circle cx="0" cy="0" fill="#6366f1" r="4" />
                  <circle cx="0" cy="0" fill="none" r="8" stroke="#6366f1" strokeWidth="0.75" />
                  <text fill="#b9cacb" fontFamily="JetBrains Mono, monospace" fontSize="8" x="12" y="4">
                    ISOLATED:NODE-72
                  </text>
                </g>

                {/* Target Delta: Deep Space Drift */}
                <g
                  className="cursor-pointer group"
                  transform="translate(440, 360)"
                  onClick={() => setActiveBlip("PQC_DRIFT")}
                >
                  <circle cx="0" cy="0" fill="#ffb800" r="3.5" />
                  <text fill="#ffb800" fontFamily="JetBrains Mono, monospace" fontSize="8" x="8" y="3">
                    PQC_DRIFT_0.03%
                  </text>
                </g>

                {/* Earth Core Station Anchor */}
                <circle cx="300" cy="300" fill="#090a0f" r="10" stroke="#00f0ff" strokeWidth="2" />
                <circle cx="300" cy="300" fill="#00f0ff" r="3" />
              </svg>

              {/* Floating Threat Telemetry Pill */}
              <div className="absolute top-4 right-4 bg-[#111318]/90 border border-white/[0.08] p-3 rounded-xl backdrop-blur-md hidden sm:block shadow-xl">
                <div className="flex items-center justify-between gap-4 text-[10px] font-mono text-[#849495] font-bold">
                  <span>INTERCEPT CONE</span>
                  <span className="text-[#00f0ff]">AZ 148°</span>
                </div>
                <div className="text-xs font-mono text-white font-bold mt-0.5">8 ACTIVE CARRIERS</div>
                <div className="w-32 h-1.5 bg-[#161920] rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#00f0ff] to-[#6366f1] w-[78%]" />
                </div>
              </div>
            </div>

            {/* RIGHT: Packet Stream Waterfall & Live Node Intelligence (4 Cols) */}
            <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
              {/* Packet Stream Waterfall Container */}
              <div className="rounded-xl bg-[#090a0f]/95 border border-white/[0.08] p-4 flex-1 flex flex-col">
                <div className="flex items-center justify-between pb-2 border-b border-white/[0.06] mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
                    <span className="text-[10px] font-mono font-bold text-white uppercase tracking-wider">
                      PACKET STREAM WATERFALL
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#00f0ff] font-bold">2.84 Gbps</span>
                </div>

                {/* Real-time Packet Waterfall Visualization */}
                <div className="font-mono text-xs space-y-1.5 overflow-hidden flex-1 select-none">
                  <div className="flex items-center justify-between bg-[#161920]/60 px-2.5 py-1.5 rounded-lg border border-white/[0.04]">
                    <span className="text-[#00f0ff] font-bold">0x7F2A:KYB</span>
                    <span className="text-zinc-300 truncate px-1 text-[11px]">DIR_INGRESS &gt;&gt; N9_CORE</span>
                    <span className="text-emerald-400 font-bold text-[11px]">0.03ms</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px]">
                    <span className="text-rose-400 font-bold">0xAA41:ANOM</span>
                    <span className="text-zinc-400 truncate px-1">SIGNATURE_MISMATCH</span>
                    <span className="text-rose-400 font-bold">DROP</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#161920]/60 px-2.5 py-1.5 rounded-lg border border-white/[0.04] text-[11px]">
                    <span className="text-[#00f0ff] font-bold">0x889B:AUTH</span>
                    <span className="text-zinc-300 truncate px-1">TOKEN_ROTATION_KYB1024</span>
                    <span className="text-emerald-400 font-bold">OK</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px]">
                    <span className="text-[#c0c1ff] font-bold">0x3310:TELEM</span>
                    <span className="text-zinc-400 truncate px-1">ORBITAL_EPHEMERIS_BC</span>
                    <span className="text-zinc-400">ACK</span>
                  </div>
                  <div className="flex items-center justify-between bg-[#161920]/60 px-2.5 py-1.5 rounded-lg border border-white/[0.04] text-[11px]">
                    <span className="text-rose-400 font-bold">0xEF90:FORGE</span>
                    <span className="text-zinc-300 truncate px-1">MEM_OVERFLOW_ATTEMPT</span>
                    <span className="text-rose-400 font-bold">QUAR</span>
                  </div>
                  <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px]">
                    <span className="text-[#00f0ff] font-bold">0x5501:SYN</span>
                    <span className="text-zinc-400 truncate px-1">QUANTUM_ENTROPY_REPL</span>
                    <span className="text-emerald-400 font-bold">SYNC</span>
                  </div>
                </div>

                {/* Waterfall Footer Rate */}
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-[#849495]">
                  <span>BUFFER: 4.2 MB / 16.0 MB</span>
                  <span className="text-[#00f0ff] font-bold">DROP RATE: 0.0001%</span>
                </div>
              </div>

              {/* Intercept Action Command Box */}
              <div className="rounded-xl bg-[#090a0f]/95 border border-white/[0.08] p-4 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-[#849495] uppercase tracking-wider">
                    AUTONOMOUS COUNTER-VECTOR
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono font-bold border border-emerald-500/30">
                    ARMED
                  </span>
                </div>
                <div className="text-xs text-zinc-300 leading-relaxed">
                  Target <span className="font-mono font-bold text-[#00f0ff]">#INTRUSION_01</span> has breached perimeter band R-24000. Autonomous micro-quarantine ready for immediate dispatch.
                </div>
                <div className="pt-1 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isQuarantining || quarantinedNodes.includes("INTRUSION_01")}
                    onClick={() => handleQuarantine("INTRUSION_01")}
                    className="flex-1 text-xs h-9 bg-[#00f0ff]/15 hover:bg-[#00f0ff]/25 text-[#00f0ff] border-[#00f0ff]/50 font-bold"
                  >
                    {quarantinedNodes.includes("INTRUSION_01") ? "Node Isolated" : "Isolate Node"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toast.info("Volatile cache scrub completed across cluster sector 09.")}
                    className="text-xs h-9 px-3 text-zinc-300 border-white/10"
                  >
                    Purge Cache
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================= METRIC STRIPS WITH GLOWING SEGMENT PROGRESS BARS ================= */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Metric 1: Intercept Latency (142µs) */}
          <div className="rounded-xl bg-[#0d0e13]/85 border border-white/[0.08] p-4 relative overflow-hidden backdrop-blur-xl hover:border-[#00f0ff]/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#849495] uppercase tracking-wider">
                INTERCEPT LATENCY
              </span>
              <Activity className="h-4 w-4 text-[#00f0ff]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#dbfcff]">142µs</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">-18µs delta</span>
            </div>
            <div className="mt-3 flex gap-1 items-center">
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff]/40" />
              <div className="h-1.5 flex-1 rounded-sm bg-white/10" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-[#849495]">
              <span>SLA: &lt;250µs</span>
              <span className="text-[#00f0ff] font-bold">PEAK: 198µs</span>
            </div>
          </div>

          {/* Metric 2: Memory Boundary Pressure (18.4%) */}
          <div className="rounded-xl bg-[#0d0e13]/85 border border-white/[0.08] p-4 relative overflow-hidden backdrop-blur-xl hover:border-[#c0c1ff]/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#849495] uppercase tracking-wider">
                MEMORY BOUNDARY PRESSURE
              </span>
              <Cpu className="h-4 w-4 text-[#c0c1ff]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-white">18.4%</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">STABLE</span>
            </div>
            <div className="mt-3 flex gap-1 items-center">
              <div className="h-1.5 flex-1 rounded-sm bg-[#6366f1] shadow-[0_0_8px_#6366f1]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#6366f1]/50" />
              <div className="h-1.5 flex-1 rounded-sm bg-white/10" />
              <div className="h-1.5 flex-1 rounded-sm bg-white/10" />
              <div className="h-1.5 flex-1 rounded-sm bg-white/10" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-[#849495]">
              <span>LIMIT: 95.0%</span>
              <span className="text-[#c0c1ff] font-bold">ALLOC: 24.8 GB</span>
            </div>
          </div>

          {/* Metric 3: Global PQC Entropy (100% Kyber-1024) */}
          <div className="rounded-xl bg-[#0d0e13]/85 border border-white/[0.08] p-4 relative overflow-hidden backdrop-blur-xl hover:border-emerald-500/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#849495] uppercase tracking-wider">
                GLOBAL PQC ENTROPY
              </span>
              <Lock className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-emerald-400">100%</span>
              <span className="text-xs font-mono text-[#dbfcff]">Kyber-1024</span>
            </div>
            <div className="mt-3 flex gap-1 items-center">
              <div className="h-1.5 flex-1 rounded-sm bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <div className="h-1.5 flex-1 rounded-sm bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <div className="h-1.5 flex-1 rounded-sm bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <div className="h-1.5 flex-1 rounded-sm bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <div className="h-1.5 flex-1 rounded-sm bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-[#849495]">
              <span>FIPS 203 COMPLIANT</span>
              <span className="text-emerald-400 font-bold">UNCOMPROMISED</span>
            </div>
          </div>

          {/* Metric 4: Synthesis Throughput (1.74T Syn/sec) */}
          <div className="rounded-xl bg-[#0d0e13]/85 border border-white/[0.08] p-4 relative overflow-hidden backdrop-blur-xl hover:border-[#00f0ff]/40 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-[#849495] uppercase tracking-wider">
                SYNTHESIS THROUGHPUT
              </span>
              <Zap className="h-4 w-4 text-[#00f0ff]" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-[#dbfcff]">1.74T</span>
              <span className="text-xs font-mono text-[#849495]">Syn/sec</span>
            </div>
            <div className="mt-3 flex gap-1 items-center">
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#00f0ff] shadow-[0_0_8px_#00f0ff]" />
              <div className="h-1.5 flex-1 rounded-sm bg-[#6366f1]" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] font-mono text-[#849495]">
              <span>CLUSTER CORE: 128x</span>
              <span className="text-[#00f0ff] font-bold">+14.2% OVERFLOW</span>
            </div>
          </div>
        </section>

        {/* ================= SCANNABLE LIVE TELEMETRY EVENT TABLE ================= */}
        <section className="rounded-2xl border border-white/[0.08] bg-[#0d0e13]/85 backdrop-blur-2xl overflow-hidden shadow-2xl">
          {/* Table Control Toolbar */}
          <div className="p-4 border-b border-white/[0.06] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Crosshair className="h-5 w-5 text-[#00f0ff]" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Live Intercept &amp; Autonomous Event Stream
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/[0.05] text-[#849495] border border-white/10 uppercase">
                STREAM: ACTIVE-SYNC
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 bg-[#161920] px-3 py-1.5 rounded-lg border border-white/[0.08] text-xs font-mono text-[#849495]">
                <Filter className="h-3.5 w-3.5" />
                <span>Filter: All Threats</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Raw vector telemetry exported in hex buffer format.")}
                className="text-xs h-8 px-3 gap-1.5 text-zinc-300 border-white/10"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Hex</span>
              </Button>
            </div>
          </div>

          {/* Dense Telemetry Event Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#090a0f]/80 text-[10px] font-mono text-[#849495] uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">TIMESTAMP (UTC)</th>
                  <th className="py-3 px-4">EVENT ID / SIGNATURE</th>
                  <th className="py-3 px-4">SOURCE AGENT</th>
                  <th className="py-3 px-4">PACKET HEX PREVIEW</th>
                  <th className="py-3 px-4">SEVERITY</th>
                  <th className="py-3 px-4 text-right">INSTANT ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs font-mono">
                {/* Event 1 */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#849495]">14:02:18.9912</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="font-bold text-rose-400">SIG-KYB-FORGE</span>
                      <span className="text-[#849495] text-[10px]">[GEO-09]</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#dbfcff]">AGENT_AEGIS_09.v4</td>
                  <td className="py-3 px-4">
                    <span className="bg-[#161920] px-2 py-0.5 rounded border border-white/[0.08] text-[#00f0ff] text-[11px]">
                      4B 79 62 65 72 2D 31 30 32 34 00 FF
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950/40 text-rose-400 border border-rose-800/40 uppercase">
                      CRITICAL
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleQuarantine("SIG-KYB-FORGE")}
                      disabled={quarantinedNodes.includes("SIG-KYB-FORGE")}
                      className="text-[10px] h-7 px-2.5 font-bold uppercase tracking-wider"
                    >
                      {quarantinedNodes.includes("SIG-KYB-FORGE") ? "Quarantined" : "Quarantine"}
                    </Button>
                  </td>
                </tr>

                {/* Event 2 */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#849495]">14:02:17.4810</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="font-semibold text-white">SYN_OVERFLOW_FLOOD</span>
                      <span className="text-[#849495] text-[10px]">[SAT-04]</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#dbfcff]">AGENT_SENTINEL_22</td>
                  <td className="py-3 px-4">
                    <span className="bg-[#161920] px-2 py-0.5 rounded border border-white/[0.08] text-zinc-300 text-[11px]">
                      7F AA 01 9B 42 E0 11 02 A4 F3 99 C1
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 uppercase">
                      ELEVATED
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleQuarantine("SYN_OVERFLOW_FLOOD")}
                      disabled={quarantinedNodes.includes("SYN_OVERFLOW_FLOOD")}
                      className="text-[10px] h-7 px-2.5 text-zinc-300 border-white/10 uppercase"
                    >
                      {quarantinedNodes.includes("SYN_OVERFLOW_FLOOD") ? "Quarantined" : "Quarantine"}
                    </Button>
                  </td>
                </tr>

                {/* Event 3 */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#849495]">14:02:16.8903</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-semibold text-white">PQC_HANDSHAKE_VALID</span>
                      <span className="text-[#849495] text-[10px]">[GATE-01]</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#dbfcff]">AGENT_ORBITAL_CORE</td>
                  <td className="py-3 px-4">
                    <span className="bg-[#161920] px-2 py-0.5 rounded border border-white/[0.08] text-emerald-400 text-[11px]">
                      00 12 34 56 78 9A BC DE F0 11 22 33
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 uppercase">
                      NOMINAL
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-[10px] text-[#849495] font-bold uppercase">
                    BYPASSED
                  </td>
                </tr>

                {/* Event 4 */}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-[#849495]">14:02:15.1198</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#00f0ff]" />
                      <span className="font-semibold text-white">EPHEMERIS_DRIFT_COMP</span>
                      <span className="text-[#849495] text-[10px]">[NAV-L2]</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-[#dbfcff]">AGENT_TELEM_DRIFT</td>
                  <td className="py-3 px-4">
                    <span className="bg-[#161920] px-2 py-0.5 rounded border border-white/[0.08] text-zinc-300 text-[11px]">
                      53 47 50 34 5F 52 45 56 39 39 38 32
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#00f0ff]/10 text-[#00f0ff] border border-[#00f0ff]/30 uppercase">
                      RESOLVED
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-[10px] text-[#00f0ff] font-bold uppercase">
                    AUTO-FIX
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-3.5 border-t border-white/[0.06] bg-[#090a0f]/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-[#849495]">
            <div className="flex items-center gap-3">
              <span>Showing 4 of 1,842 intercepted vectors</span>
              <span className="w-1 h-1 rounded-full bg-[#849495]" />
              <span className="text-[#00f0ff] font-bold">Ingress: 41.2 KB/s</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="text-[10px] uppercase font-bold tracking-wider">GEO-SYNC ORBIT ACTIVE</span>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
