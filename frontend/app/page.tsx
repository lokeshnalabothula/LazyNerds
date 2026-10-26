"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ThinkingOrb } from "@/components/stitch/ThinkingOrb";
import { BorderBeam } from "@/components/stitch/BorderBeam";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Terminal,
  ArrowRight,
  CheckCircle2,
  FileCode2,
  BarChart3,
  ExternalLink,
  Activity,
  Layers,
  Cpu,
  Server,
  FileText,
  Menu,
  X,
  ChevronRight,
  Database,
  Eye,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function HomePage() {
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#07090E] text-zinc-100 selection:bg-[#F5C518]/20 selection:text-[#F5C518] flex flex-col font-sans">
      {/* --------------------------------------------------------------------- */}
      {/* Navigation Header                                                     */}
      {/* --------------------------------------------------------------------- */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[#07090E]/90 border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand Wordmark & Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-gradient-to-br from-[#FFD84D]/20 via-[#F5C518]/10 to-transparent border border-[#F5C518]/30 flex items-center justify-center text-[#F5C518] shadow-sm group-hover:border-[#F5C518]/60 transition-colors">
              <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="font-bold tracking-tight text-xs sm:text-base text-zinc-100 font-mono">
                Lazy Nerds
              </span>
              <span className="text-[8px] sm:text-[9px] font-mono uppercase px-1 sm:px-1.5 py-0.5 rounded border border-[#F5C518]/40 bg-[#F5C518]/10 text-[#F5C518] tracking-widest font-semibold">
                FIXOPS
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav
            aria-label="Primary Navigation"
            className="hidden lg:flex items-center gap-7 text-xs font-mono text-zinc-400"
          >
            <a
              href="#capabilities"
              className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:text-[#F5C518]"
            >
              Capabilities
            </a>
            <a
              href="#methodology"
              className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:text-[#F5C518]"
            >
              Methodology
            </a>
            <a
              href="#architecture"
              className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:text-[#F5C518]"
            >
              Architecture
            </a>
            <Link
              href="/privacy"
              className="hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:text-[#F5C518]"
            >
              Governance
            </Link>
          </nav>

          {/* Header Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {user ? (
              <Link
                href="/overview"
                className="inline-flex items-center justify-center font-mono font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.15] bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-8 px-2.5 sm:px-3 text-xs gap-1.5 select-none cursor-pointer"
              >
                <span>Open Console</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="hidden sm:inline-flex items-center justify-center font-mono font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.10] bg-white/[0.02] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-8 px-3 text-xs gap-1.5 select-none cursor-pointer"
                >
                  <span>Request Access</span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center font-mono font-medium rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.15] bg-white/[0.02] text-zinc-300 hover:text-white hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-8 px-2.5 sm:px-3 text-xs gap-1.5 select-none cursor-pointer"
                >
                  <span className="hidden sm:inline">Portal </span>
                  <span>Sign In</span>
                  <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-0.5 sm:ml-1" />
                </Link>
              </>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] text-zinc-400 hover:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-b border-white/[0.08] bg-[#090C12]/95 backdrop-blur-xl px-4 py-4 space-y-3">
            <nav className="flex flex-col space-y-2 text-xs font-mono text-zinc-300">
              <a
                href="#capabilities"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Capabilities
              </a>
              <a
                href="#methodology"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Methodology
              </a>
              <a
                href="#architecture"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Architecture
              </a>
              <Link
                href="/privacy"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Privacy & Governance
              </Link>
              <Link
                href="/terms"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-colors"
              >
                Terms of Service
              </Link>
            </nav>
            {!user && (
              <div className="pt-2 border-t border-white/[0.06] flex flex-col gap-2">
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center font-mono font-medium rounded-lg transition-all duration-150 border border-white/[0.10] bg-white/[0.02] text-slate-300 hover:text-white hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-8 px-3 text-xs gap-1.5 select-none cursor-pointer"
                >
                  <span>Request Organization Access</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </header>

      {/* --------------------------------------------------------------------- */}
      {/* Main Page Content                                                     */}
      {/* --------------------------------------------------------------------- */}
      <main className="flex-1">
        {/* ------------------------------------------------------------------- */}
        {/* Hero Section                                                        */}
        {/* ------------------------------------------------------------------- */}
        <section className="relative overflow-hidden pt-12 pb-16 sm:pt-20 sm:pb-24 lg:pt-28 lg:pb-32 border-b border-white/[0.06]">
          {/* Subtle Ambient Radial Highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#F5C518]/[0.04] blur-[120px] pointer-events-none rounded-full" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              {/* ThinkingOrb Floating Cognitive Construct (Stitch) */}
              <div className="flex flex-col items-center mb-1">
                <ThinkingOrb size="lg" state="searching" showBadge label="COGNITIVE COCKPIT // ZERO-TRUST DEFENSE" />
              </div>

              {/* Eyebrow Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#00f0ff]/30 bg-[#00f0ff]/[0.06] text-[#00f0ff] text-[11px] font-mono uppercase tracking-wider">
                <Activity className="h-3 w-3 animate-pulse" />
                <span>OPERATIONAL PLATFORM v1.0.0 • VERIFIABLE ROE FENCES</span>
              </div>

              {/* Dominant Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight font-mono">
                Precision Penetration Testing & Vulnerability Operations
              </h1>

              {/* Subheading */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto">
                Lazy Nerds FixOps pairs rigorous security assessments with verifiable Rules of Engagement, containerized scanner orchestration, and structured remediation workflows for modern engineering teams.
              </p>

              {/* Primary Call to Action Area (Single Prominent Primary Action Rule) */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href={user ? "/overview" : "/login"}
                  className="w-full sm:w-auto inline-flex items-center justify-center font-mono font-extrabold text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] gloss-yellow-btn text-[#090A0D] active:scale-[0.98] shadow-lg shadow-[#F5C518]/15 h-10 px-5 gap-2 select-none cursor-pointer"
                >
                  <span>{user ? "Open FixOps Console" : "Launch FixOps Portal"}</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
                <a
                  href="#capabilities"
                  className="w-full sm:w-auto inline-flex items-center justify-center font-mono font-medium text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.10] bg-white/[0.02] text-slate-300 hover:text-[#F9FAFB] hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-10 px-5 gap-2 select-none cursor-pointer"
                >
                  <span>Explore Platform Capabilities</span>
                  <ChevronRight className="h-4 w-4 ml-1" />
                </a>
              </div>
            </div>

            {/* Grounded Technical Invariant Chips (Truthful & Verified Features) */}
            <div className="mt-14 sm:mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm space-y-1.5">
                <div className="flex items-center gap-2 text-[#F5C518] font-mono text-xs font-semibold uppercase">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Verifiable RoE Fencing</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Explicit legal authorization states (draft, pending, confirmed) strictly enforced before scan dispatch.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm space-y-1.5">
                <div className="flex items-center gap-2 text-[#F5C518] font-mono text-xs font-semibold uppercase">
                  <Terminal className="h-4 w-4 shrink-0" />
                  <span>Containerized Sandboxing</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated security tools execute in isolated Docker workers with dropped privileges and bounded leases.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm space-y-1.5">
                <div className="flex items-center gap-2 text-[#F5C518] font-mono text-xs font-semibold uppercase">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span>Multi-Layer SSRF Defense</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Destination validation unconditionally blocking cloud metadata (169.254.169.254) and internal infrastructure.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm space-y-1.5">
                <div className="flex items-center gap-2 text-[#F5C518] font-mono text-xs font-semibold uppercase">
                  <FileCode2 className="h-4 w-4 shrink-0" />
                  <span>Traceable Remediation</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  CVSS v3.1 severity triage, CWE mapping, and reproducible proof-of-concept evidence for every finding.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Core Capabilities Section                                          */}
        {/* ------------------------------------------------------------------- */}
        <section id="capabilities" className="py-16 sm:py-24 border-b border-white/[0.06] relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12 sm:mb-16 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-[#F5C518] tracking-widest font-semibold">
                <Cpu className="h-3.5 w-3.5" />
                <span>ENGINEERING CAPABILITIES</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-mono">
                Built for High-Assurance Security Workflows
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Six integrated operational subsystems engineered to identify genuine vulnerabilities, challenge unverified assumptions, and drive verifiable remediation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
              {/* Card 1: Engagements & RoE */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Rules of Engagement Fencing
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Security assessments are never initiated without explicit stakeholder authorization. FixOps locks engagement parameters and validates client ownership before scanning.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Verified state machine & lock boundaries</span>
                </div>
              </div>

              {/* Card 2: Containerized Worker Execution */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <Terminal className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Containerized Scanner Orchestration
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated security tools run inside isolated Docker worker containers with dropped capabilities (`--cap-drop ALL`), strict memory limits, and atomic worker leases.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Nuclei engine with SARIF 2.1.0 ingestion</span>
                </div>
              </div>

              {/* Card 3: Multi-Layer SSRF Defense */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <Lock className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Kernel-Level SSRF Protection
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Destination validation blocks probes against AWS/GCP/Azure instance metadata endpoints (`169.254.169.254`), private RFC 1918 subnets, and sensitive internal ports.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Fail-closed lab enforcement in production</span>
                </div>
              </div>

              {/* Card 4: Actionable Findings Dossiers */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <FileCode2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Reproducible Findings Dossiers
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Every vulnerability is cataloged with verified CVSS v3.1 vector calculations, CWE taxonomies, step-by-step reproduction evidence, and concrete remediation advice.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Clean scannable dossiers with zero table occlusion</span>
                </div>
              </div>

              {/* Card 5: Remediation Lifecycle Tracking */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Remediation SLA & Verification
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Track vulnerability status through open, in-progress, remediated, accepted risk, and verified fixed states. Automated scheduler rules send timely follow-up reminders.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Event-driven webhooks & email alerts</span>
                </div>
              </div>

              {/* Card 6: Multi-Tenant Stakeholder Console */}
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent backdrop-blur-md space-y-3 hover:border-[#F5C518]/30 transition-colors">
                <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[#F5C518]">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-white font-mono">
                  Executive Reports & Role Scoping
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Multi-tenant isolation strictly restricts client stakeholders to their organization scope. Executive reports compile risk posture and remediation progress into clean deliverables.
                </p>
                <div className="pt-2 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                  <Check className="h-3 w-3 text-[#F5C518]" />
                  <span>Role-based tenant isolation (founder, employee, client)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Assessment Methodology Section                                      */}
        {/* ------------------------------------------------------------------- */}
        <section id="methodology" className="py-16 sm:py-24 border-b border-white/[0.06] bg-white/[0.01]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12 sm:mb-16 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-[#F5C518] tracking-widest font-semibold">
                <Layers className="h-3.5 w-3.5" />
                <span>OPERATIONAL METHODOLOGY</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-mono">
                Verified 4-Stage Security Lifecycle
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                From initial client onboarding to cryptographic deliverables, every step is bound by explicit operational rules.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 01 */}
              <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#090C12] space-y-3 relative">
                <div className="text-2xl font-mono font-extrabold text-[#F5C518]/80">01</div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Scope Definition & RoE
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Clients and engagements are configured with explicit in-scope assets. Target URLs undergo SSRF destination validation and RoE certification before test creation.
                </p>
              </div>

              {/* Step 02 */}
              <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#090C12] space-y-3 relative">
                <div className="text-2xl font-mono font-extrabold text-[#F5C518]/80">02</div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Isolated Probe Execution
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Automated security tools are dispatched to decoupled worker nodes. Jobs run inside sandboxed Docker containers with bounded lease timeouts and capability shedding.
                </p>
              </div>

              {/* Step 03 */}
              <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#090C12] space-y-3 relative">
                <div className="text-2xl font-mono font-extrabold text-[#F5C518]/80">03</div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Normalization & Evidence
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Raw SARIF and JSON security outputs are parsed into normalized vulnerability findings with CVSS severity calculations, affected assets, and actionable evidence.
                </p>
              </div>

              {/* Step 04 */}
              <div className="p-5 rounded-2xl border border-white/[0.08] bg-[#090C12] space-y-3 relative">
                <div className="text-2xl font-mono font-extrabold text-[#F5C518]/80">04</div>
                <h3 className="text-sm font-bold text-white font-mono">
                  Remediation & Sign-Off
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Engineering teams apply mitigations while security personnel perform verification scans. Terminal engagements are locked against tampering, producing final audit reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Architecture & Truthful Disclosures Section                         */}
        {/* ------------------------------------------------------------------- */}
        <section id="architecture" className="py-16 sm:py-24 border-b border-white/[0.06]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mb-12 sm:mb-16 space-y-3">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono uppercase text-[#F5C518] tracking-widest font-semibold">
                <Server className="h-3.5 w-3.5" />
                <span>SYSTEM ARCHITECTURE</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-mono">
                Engineering Integrity & Transparency
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Lazy Nerds maintains strict operational boundaries: zero fabricated customer testimonials, zero simulated claims without benchmark provenance, and zero bypass of security controls.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-white font-mono text-sm font-semibold">
                  <Database className="h-4 w-4 text-[#F5C518]" />
                  <span>Modern Core Stack</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Next.js 15 App Router frontend paired with asynchronous FastAPI, SQLAlchemy 2.0 ORM, and PostgreSQL 16 Lakebase with pooled connections and Alembic migration tracking.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-white font-mono text-sm font-semibold">
                  <Eye className="h-4 w-4 text-[#F5C518]" />
                  <span>Truthful Provenance</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Live findings are strictly separated from offline simulations using explicit `[LAB BENCHMARK]` provenance tags. We never fabricate exploits or simulate scan completions.
                </p>
              </div>

              <div className="p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-white font-mono text-sm font-semibold">
                  <Lock className="h-4 w-4 text-[#F5C518]" />
                  <span>Role-Based Tenant Guard</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enforces server-side privilege boundaries across administrative founders, security consultants, and client viewers. Tenant isolation is enforced across database queries and role-based access checks.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------- */}
        {/* Call to Action Section                                              */}
        {/* ------------------------------------------------------------------- */}
        <section className="py-16 sm:py-20 relative overflow-hidden">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white font-mono">
              Ready to Inspect Your Attack Surface?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Sign in to the FixOps security operations console or submit an authorized registration request for your organization.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={user ? "/overview" : "/login"}
                className="w-full sm:w-auto inline-flex items-center justify-center font-mono font-medium text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.2] bg-white/[0.02] text-zinc-200 hover:text-[#F9FAFB] hover:bg-white/[0.08] hover:border-[#F5C518]/40 shadow-xs h-10 px-5 gap-2 select-none cursor-pointer"
              >
                <span>{user ? "Open FixOps Console" : "Launch FixOps Portal"}</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Link>
              {!user && (
                <Link
                  href="/register"
                  className="w-full sm:w-auto inline-flex items-center justify-center font-mono font-medium text-sm rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] border border-white/[0.10] bg-white/[0.02] text-slate-300 hover:text-[#F9FAFB] hover:bg-white/[0.06] hover:border-[#F5C518]/40 shadow-xs h-10 px-5 gap-2 select-none cursor-pointer"
                >
                  <span>Request Organization Access</span>
                </Link>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------------------- */}
      {/* Footer                                                                */}
      {/* --------------------------------------------------------------------- */}
      <footer className="border-t border-white/[0.08] bg-[#05070B] py-12 px-4 sm:px-6 lg:px-8 text-xs font-mono text-zinc-400">
        <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center text-[#F5C518]">
                <Shield className="h-3.5 w-3.5" />
              </div>
              <span className="font-bold tracking-tight text-zinc-200">Lazy Nerds FixOps</span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Continuous cybersecurity management, authorized assessment operations, and verified vulnerability remediation.
            </p>
          </div>

          {/* Operational Links */}
          <div className="space-y-2.5">
            <h4 className="text-zinc-200 font-semibold uppercase tracking-wider text-[11px]">Operations</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <Link href="/login" className="hover:text-[#F5C518] transition-colors">
                  Client Portal Sign In
                </Link>
              </li>
              <li>
                <Link href="/overview" className="hover:text-[#F5C518] transition-colors">
                  Overview Cockpit
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-[#F5C518] transition-colors">
                  Organization Registration
                </Link>
              </li>
              <li>
                <Link href="/register/status" className="hover:text-[#F5C518] transition-colors">
                  Registration Status Tracker
                </Link>
              </li>
            </ul>
          </div>

          {/* Security Architecture Links */}
          <div className="space-y-2.5">
            <h4 className="text-zinc-200 font-semibold uppercase tracking-wider text-[11px]">Framework</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <a href="#capabilities" className="hover:text-[#F5C518] transition-colors">
                  Rules of Engagement
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-[#F5C518] transition-colors">
                  SSRF Protection Matrix
                </a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-[#F5C518] transition-colors">
                  Docker Scanner Workers
                </a>
              </li>
              <li>
                <a href="#methodology" className="hover:text-[#F5C518] transition-colors">
                  Remediation Lifecycle
                </a>
              </li>
            </ul>
          </div>

          {/* Governance & Compliance */}
          <div className="space-y-2.5">
            <h4 className="text-zinc-200 font-semibold uppercase tracking-wider text-[11px]">Governance</h4>
            <ul className="space-y-1.5 text-[11px]">
              <li>
                <Link href="/privacy" className="hover:text-[#F5C518] transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#F5C518] transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <a href="/api/v1/health" target="_blank" rel="noreferrer" className="hover:text-[#F5C518] transition-colors inline-flex items-center gap-1">
                  <span>API Operational Health</span>
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Corporate Disclosure Banner */}
        <div className="pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500">
          <p>© 2026 Lazy Nerds. All rights reserved. FixOps Client Manager.</p>
          <p className="text-[10px] text-zinc-600">
            Legal parameters marked with brackets in governance docs await corporate counsel review.
          </p>
        </div>
      </footer>
    </div>
  );
}
