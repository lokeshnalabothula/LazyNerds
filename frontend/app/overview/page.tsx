"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { OverviewMetrics } from "@/types/overview";

interface ScanRowItem {
  id: string;
  target: string;
  icon: string;
  iconClass?: string;
  status: "Completed" | "Running" | "Queued";
  statusBadge: string;
  statusBadgeClass: string;
  findingsBadges?: Array<{ text: string; className: string }>;
  findingsText?: string;
  duration: string;
  timestamp: string;
  timestampClass?: string;
  isPulse?: boolean;
  rowClass?: string;
}

export default function OverviewPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=${encodeURIComponent("/overview")}`);
    }
  }, [user, authLoading, router]);

  // Load telemetry metrics
  const fetchTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getOverviewMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.warn("[FixOps Overview] Telemetry fetch fallback active:", err);
      // Fallback gracefully without breaking layout
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Global ⌘K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
      if (e.key === "Escape") {
        setSearchFocused(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Click outside to dismiss user dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#030407] flex items-center justify-center text-[#929AA6]">
        <div className="flex items-center gap-2 font-label-code-sm text-label-code-sm">
          <span className="w-2 h-2 rounded-full bg-[#B8D8F2] animate-pulse" />
          <span>AUTHENTICATING FIXOPS SESSION...</span>
        </div>
      </div>
    );
  }

  // Operator initials & full name
  const operatorName = user?.full_name?.trim() || "Security Operator";
  const operatorRole = (() => {
    if (!user?.role) return "Operator";
    const r = user.role.trim().toLowerCase();
    if (r === "founder") return "SecOps Lead";
    if (r === "employee") return "Security Engineer";
    if (r === "client") return "Client Operator";
    return user.role;
  })();
  const operatorInitials = operatorName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "SO";

  // Telemetry computations
  const clientsTotal = metrics?.clients_total ?? 14;
  const clientsActive = metrics?.clients_active ?? 12;
  const pendingTriageCount = (metrics?.critical_findings_open || 0) + (metrics?.high_findings_open || 0) || 5;
  const activeJobsCount = metrics?.active_assessments_total ?? 3;
  const slaBreachesCount = metrics?.recent_failures_total ?? 0;

  // Severity counts
  const critCount = metrics?.severity_distribution?.critical ?? 0;
  const highCount = metrics?.severity_distribution?.high ?? 2;
  const medCount = metrics?.severity_distribution?.medium ?? 5;
  const lowCount = metrics?.severity_distribution?.low ?? 7;
  const infoCount = metrics?.severity_distribution?.info ?? 12;
  const totalFindings = critCount + highCount + medCount + lowCount + infoCount || 26;

  // Width percentages for severity bars
  const critWidth = critCount > 0 ? Math.max(5, Math.round((critCount / totalFindings) * 100)) : 0;
  const highWidth = highCount > 0 ? Math.max(10, Math.round((highCount / totalFindings) * 100)) : 25;
  const medWidth = medCount > 0 ? Math.max(15, Math.round((medCount / totalFindings) * 100)) : 50;
  const lowWidth = lowCount > 0 ? Math.max(20, Math.round((lowCount / totalFindings) * 100)) : 70;
  const infoWidth = infoCount > 0 ? Math.max(25, Math.round((infoCount / totalFindings) * 100)) : 90;

  // Scans list (matching Stitch reference exactly)
  const recentScans: ScanRowItem[] = [
    {
      id: "scan-1",
      target: "api.acroba.internal",
      icon: "dns",
      status: "Completed",
      statusBadge: "Completed",
      statusBadgeClass: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
      findingsBadges: [
        { text: "1H", className: "bg-amber-500/10 border border-amber-500/20 text-amber-400" },
        { text: "3M", className: "bg-[#252B33] text-[#AEB8C5]" },
      ],
      duration: "4m 12s",
      timestamp: "18m ago",
    },
    {
      id: "scan-2",
      target: "auth.identity-sso.net",
      icon: "lan",
      iconClass: "text-[#B8D8F2]",
      status: "Running",
      statusBadge: "Running [72%]",
      statusBadgeClass: "bg-[#B8D8F2]/10 border border-[#B8D8F2]/30 text-[#B8D8F2]",
      findingsText: "1 finding",
      duration: "1m 45s",
      timestamp: "Active now",
      timestampClass: "text-[#B8D8F2]",
      isPulse: true,
      rowClass: "bg-[#12161C]/20",
    },
    {
      id: "scan-3",
      target: "198.51.100.0/24",
      icon: "hub",
      status: "Completed",
      statusBadge: "Completed",
      statusBadgeClass: "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
      findingsText: "0 findings",
      duration: "12m 04s",
      timestamp: "2h ago",
    },
    {
      id: "scan-4",
      target: "staging.novapay.com",
      icon: "cloud_sync",
      status: "Queued",
      statusBadge: "Queued",
      statusBadgeClass: "bg-[#252B33] text-[#929AA6]",
      findingsText: "Preflight check",
      duration: "--",
      timestamp: "Scheduled",
    },
  ];

  return (
    <div className="bg-[#030407] text-[#F2F4F7] font-body-md text-body-md antialiased min-h-screen selection:bg-[#B8D8F2]/20 selection:text-white relative overflow-x-hidden">
      {/* Top Viewport Laboratory Glow (Subtle downlight) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[340px] bg-gradient-to-b from-[#B8D8F2]/5 via-transparent to-transparent blur-3xl z-0"
      />

      {/* Header (h-14 / 56px) */}
      <header className="sticky top-0 z-40 h-14 bg-[#080A0E]/85 backdrop-blur-md border-b border-[#252B33] flex items-center justify-between px-6">
        {/* Left: Brand Shield & Wordmark */}
        <Link href="/overview" className="flex items-center gap-3 group focus-visible:outline-none">
          <div className="w-8 h-8 rounded bg-gradient-to-b from-[#E7ECF2] to-[#73869B] p-[1px] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
            <div className="w-full h-full bg-[#080A0E] rounded flex items-center justify-center">
              <span
                className="material-symbols-outlined text-[#E7ECF2] text-[18px]"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                security
              </span>
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="font-headline-sm text-headline-sm font-normal tracking-normal text-[#929AA6]">
              LAZY NERDS
            </span>
            <span className="font-headline-sm text-headline-sm font-bold tracking-wider text-[#F2F4F7]">
              FIXOPS
            </span>
          </div>
        </Link>

        {/* Center/Right: Launcher & Telemetry Controls */}
        <div className="flex items-center gap-4">
          {/* Cmd+K Command Pill */}
          <div className="relative">
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0D1015] border border-[#252B33] hover:border-[#AEB8C5]/40 transition-colors text-left group">
              <span className="material-symbols-outlined text-[#606975] text-[16px] group-hover:text-[#F2F4F7] transition-colors">
                search
              </span>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search targets, CVEs, commands..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                className="bg-transparent border-none outline-none font-body-sm text-body-sm text-[#F2F4F7] placeholder-[#929AA6] pr-4 w-48 sm:w-64"
              />
              <kbd className="font-label-code-sm text-label-code-sm px-1.5 py-0.5 rounded bg-[#16181e] text-[#AEB8C5] border border-[#252B33]">
                ⌘K
              </kbd>
            </div>

            {/* Quick search drop-down if active */}
            {searchFocused && (
              <div className="absolute top-full mt-1.5 left-0 w-full bg-[#0D1015] border border-[#252B33] rounded-lg shadow-2xl p-2 z-50">
                <div className="text-[11px] font-label-code-sm text-[#606975] px-2 py-1">QUICK ACTIONS</div>
                <Link
                  href="/audit"
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#AEB8C5] hover:text-[#FFFFFF] hover:bg-[#16181e]"
                >
                  <span className="material-symbols-outlined text-[14px]">radar</span>
                  <span>Start website scan</span>
                </Link>
                <Link
                  href="/findings"
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-[#AEB8C5] hover:text-[#FFFFFF] hover:bg-[#16181e]"
                >
                  <span className="material-symbols-outlined text-[14px]">security</span>
                  <span>View critical findings</span>
                </Link>
              </div>
            )}
          </div>

          {/* Real-time Status Badge */}
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#0D1015] border border-[#252B33]" />

          {/* Notification Bell */}
          <Link
            href="/radar"
            title="Notifications"
            className="relative w-8 h-8 rounded-lg flex items-center justify-center bg-[#0D1015] border border-[#252B33] hover:border-[#AEB8C5]/40 text-[#929AA6] hover:text-[#F2F4F7] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#B8D8F2]" />
          </Link>

          {/* Operator Lead Avatar & Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2 pl-2 border-l border-[#252B33] focus-visible:outline-none"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-b from-[#252B33] to-[#12161C] border border-[#AEB8C5]/30 flex items-center justify-center text-[#E7ECF2] font-label-code-sm text-label-code-sm font-semibold tracking-tight shadow-sm">
                {operatorInitials}
              </div>
              <div className="hidden md:flex flex-col text-left leading-none">
                <span className="font-body-sm text-body-sm text-[#F2F4F7] font-medium leading-none">
                  {operatorName}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-[#606975] leading-none mt-1">
                  {operatorRole}
                </span>
              </div>
              <span className="material-symbols-outlined text-[#606975] text-[16px]">expand_more</span>
            </button>

            {/* User Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#0D1015] border border-[#252B33] rounded-xl shadow-2xl p-1.5 z-50">
                <div className="px-3 py-2 border-b border-[#252B33] mb-1">
                  <div className="text-xs font-semibold text-[#F2F4F7]">{operatorName}</div>
                  <div className="text-[11px] font-label-code-sm text-[#606975] truncate">{user?.email}</div>
                </div>
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs text-[#AEB8C5] hover:text-[#FFFFFF] hover:bg-[#16181e] rounded"
                >
                  <span className="material-symbols-outlined text-[15px]">tune</span>
                  <span>Settings</span>
                </Link>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-[#16181e] rounded text-left"
                >
                  <span className="material-symbols-outlined text-[15px]">logout</span>
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 py-6 pb-40">
        {/* 1. Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-headline-lg text-headline-lg font-semibold tracking-tight text-[#F2F4F7]">
              Dashboard
            </h1>
          </div>
          {/* Primary Liquid-Metal Action Button */}
          <Link
            href="/audit"
            className="specular-button h-10 px-5 rounded-lg font-medium text-[#0A0F18] flex items-center justify-center gap-2 bg-gradient-to-b from-[#FFFFFF] via-[#E2E8F0] to-[#CBD5E1] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="font-body-md text-body-md font-semibold tracking-tight">Start scan</span>
            <span className="text-base leading-none">→</span>
          </Link>
        </div>

        {/* 2. Security Summary Row (Compact horizontal panel) */}
        <div className="mb-6 bg-[#0D1015] border border-[#252B33] rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-[#252B33] specular-top gap-y-4 lg:gap-y-0">
          {/* 1. Active Clients */}
          <div className="p-2 sm:px-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-caption-caps text-caption-caps text-[#606975]">ACTIVE CLIENTS</span>
                <span className="font-label-code-sm text-label-code-sm text-[#73869B]">{clientsTotal} TOTAL</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md font-semibold text-[#F2F4F7]">
                  {clientsActive}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-emerald-400">Active</span>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#F59E0B] mt-0.5 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-[#F59E0B]" />
                2 pending RoE renewal
              </span>
            </div>
            <Link
              href="/clients"
              className="mt-3 font-label-code-sm text-label-code-sm text-[#AEB8C5] hover:text-[#FFFFFF] transition-colors flex items-center gap-1 group"
            >
              <span>Manage Clients</span>
              <span className="material-symbols-outlined text-[13px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </Link>
          </div>

          {/* 2. Pending Triage / Tasks */}
          <div className="p-2 sm:px-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-caption-caps text-caption-caps text-[#606975]">PENDING TRIAGE</span>
                <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 font-label-code-sm text-label-code-sm">
                  Action Req
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md font-semibold text-[#F2F4F7]">
                  {pendingTriageCount}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-[#929AA6]">Tasks Pending</span>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] mt-0.5">
                2 High triage • 1 RoE sign-off • 2 scans
              </span>
            </div>
            <Link
              href="/findings"
              className="mt-3 font-label-code-sm text-label-code-sm text-[#AEB8C5] hover:text-[#FFFFFF] transition-colors flex items-center gap-1 group"
            >
              <span>Review Queue</span>
              <span className="material-symbols-outlined text-[13px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </Link>
          </div>

          {/* 3. Scan Operations / Scope */}
          <div className="p-2 sm:px-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-caption-caps text-caption-caps text-[#606975]">SCAN OPERATIONS</span>
                <span className="font-label-code-sm text-label-code-sm text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md font-semibold text-[#F2F4F7]">
                  {activeJobsCount}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-[#B8D8F2]">Active Jobs</span>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#73869B] mt-0.5">
                1 running (72%), 2 queued • 8 assets
              </span>
            </div>
            <Link
              href="/radar"
              className="mt-3 font-label-code-sm text-label-code-sm text-[#B8D8F2] hover:text-[#FFFFFF] transition-colors flex items-center gap-1 group"
            >
              <span>View Live Stream</span>
              <span className="material-symbols-outlined text-[13px] group-hover:translate-x-0.5 transition-transform">
                arrow_forward
              </span>
            </Link>
          </div>

          {/* 4. Critical Remediation SLA */}
          <div className="p-2 sm:px-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-caption-caps text-caption-caps text-[#606975]">REMEDIATION SLA</span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-label-code-sm text-label-code-sm">
                  Nominal
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-headline-md text-headline-md font-semibold text-[#F2F4F7]">
                  {slaBreachesCount}
                </span>
                <span className="font-label-code-sm text-label-code-sm text-[#10B981]/80">SLA Breaches</span>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] mt-0.5">
                Next SLA window: <span className="text-[#AEB8C5]">3h 45m</span>
              </span>
            </div>
            <span className="mt-3 font-label-code-sm text-label-code-sm text-emerald-400/90 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              All SLAs on track
            </span>
          </div>

          {/* 5. Workstation Shortcuts / Fast Actions */}
          <div className="p-2 sm:px-4 flex flex-col justify-between bg-[#080A0E]/60 rounded-lg lg:rounded-none">
            <div>
              <span className="font-caption-caps text-caption-caps text-[#606975] mb-2 block">QUICK TRIGGERS</span>
              <div className="flex flex-col gap-1.5">
                <Link
                  href="/findings?severity=high"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#16181e] border border-[#252B33] hover:border-[#AEB8C5]/50 hover:bg-[#12161C]/50 text-left transition-all group"
                >
                  <span className="font-label-code-sm text-label-code-sm text-[#E7ECF2] group-hover:text-[#FFFFFF]">
                    Triage Findings
                  </span>
                  <span className="font-label-code-sm text-label-code-sm text-[#F59E0B]">2 High</span>
                </Link>
                <Link
                  href="/engagements"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#16181e] border border-[#252B33] hover:border-[#AEB8C5]/50 hover:bg-[#12161C]/50 text-left transition-all group"
                >
                  <span className="font-label-code-sm text-label-code-sm text-[#E7ECF2] group-hover:text-[#FFFFFF]">
                    Approve Scope
                  </span>
                  <span className="font-label-code-sm text-label-code-sm text-[#AEB8C5]">1 RoE</span>
                </Link>
                <Link
                  href="/audit"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded bg-[#16181e] border border-[#252B33] hover:border-[#AEB8C5]/50 hover:bg-[#12161C]/50 text-left transition-all group"
                >
                  <span className="font-label-code-sm text-label-code-sm text-[#E7ECF2] group-hover:text-[#FFFFFF]">
                    Resume Scans
                  </span>
                  <span className="material-symbols-outlined text-[13px] text-[#B8D8F2]">play_arrow</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Two-Column Workstation Grid (60% / 40%) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
          {/* Left Column: Recent Scan Activity (7 cols ~ 60%) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#AEB8C5] text-[18px]">radar</span>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-[#F2F4F7]">Recent Scans</h2>
              </div>
              <Link
                className="font-label-code-sm text-label-code-sm text-[#AEB8C5] hover:text-[#FFFFFF] transition-colors flex items-center gap-1"
                href="/engagements"
              >
                View all (12)
                <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
              </Link>
            </div>

            {/* High-density Scan Table */}
            <div className="bg-[#0D1015] border border-[#252B33] rounded-xl overflow-hidden specular-top">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#252B33] bg-[#080A0E]/60 text-[#606975] font-caption-caps text-caption-caps">
                      <th className="py-2.5 px-4 font-medium">TARGET ASSET</th>
                      <th className="py-2.5 px-3 font-medium">STATUS</th>
                      <th className="py-2.5 px-3 font-medium">FINDINGS</th>
                      <th className="py-2.5 px-3 font-medium">DURATION</th>
                      <th className="py-2.5 px-4 font-medium text-right">TIMESTAMP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#252B33]/60 font-body-sm text-body-sm">
                    {recentScans.map((scan) => (
                      <tr
                        key={scan.id}
                        className={`hover:bg-[#12161C]/50 transition-colors group ${scan.rowClass || ""}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 font-label-code-sm text-label-code-sm text-[#F2F4F7]">
                            <span
                              className={`material-symbols-outlined text-[15px] ${
                                scan.iconClass || "text-[#606975] group-hover:text-[#B8D8F2] transition-colors"
                              }`}
                            >
                              {scan.icon}
                            </span>
                            <span>{scan.target}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-code-sm text-label-code-sm ${scan.statusBadgeClass}`}
                          >
                            {scan.isPulse && <span className="w-1.5 h-1.5 rounded-full bg-[#B8D8F2] animate-pulse" />}
                            {scan.statusBadge}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {scan.findingsBadges ? (
                            <div className="flex items-center gap-1 font-label-code-sm text-label-code-sm">
                              {scan.findingsBadges.map((badge, idx) => (
                                <span key={idx} className={`px-1.5 py-0.2 rounded ${badge.className}`}>
                                  {badge.text}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span
                              className={`font-label-code-sm text-label-code-sm ${
                                scan.status === "Running"
                                  ? "px-1.5 py-0.2 rounded bg-[#252B33] text-[#AEB8C5]"
                                  : "text-[#606975]"
                              }`}
                            >
                              {scan.findingsText}
                            </span>
                          )}
                        </td>
                        <td
                          className={`py-3 px-3 font-label-code-sm text-label-code-sm ${
                            scan.status === "Running" ? "text-[#B8D8F2]" : "text-[#929AA6]"
                          }`}
                        >
                          {scan.duration}
                        </td>
                        <td
                          className={`py-3 px-4 font-label-code-sm text-label-code-sm text-right ${
                            scan.timestampClass || "text-[#606975]"
                          }`}
                        >
                          {scan.timestamp}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Findings Distribution Matrix (5 cols ~ 40%) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#AEB8C5] text-[18px]">crisis_alert</span>
                <h2 className="font-headline-sm text-headline-sm font-semibold text-[#F2F4F7]">
                  Active Findings by Severity
                </h2>
              </div>
              <Link
                href="/findings"
                className="flex items-center gap-1 font-label-code-sm text-label-code-sm text-[#606975] bg-[#0D1015] border border-[#252B33] px-2 py-0.5 rounded hover:text-[#AEB8C5] transition-colors"
              >
                <span>Filter</span>
                <span className="material-symbols-outlined text-[13px]">tune</span>
              </Link>
            </div>

            {/* Distribution Bars Panel */}
            <div className="bg-[#0D1015] border border-[#252B33] rounded-xl p-4 flex flex-col gap-3 specular-top">
              {/* Critical */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-[#EF4444] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]/40" />
                    Critical
                  </span>
                  <span className="text-[#606975]">{critCount}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#16181e] overflow-hidden">
                  <div className="h-full bg-[#EF4444]/30 rounded-full" style={{ width: `${critWidth}%` }} />
                </div>
              </div>

              {/* High */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-[#F59E0B] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                    High
                  </span>
                  <span className="text-[#F2F4F7]">{highCount}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#16181e] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] rounded-full"
                    style={{ width: `${highWidth}%` }}
                  />
                </div>
              </div>

              {/* Medium */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-[#B8D8F2] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#73869B]" />
                    Medium
                  </span>
                  <span className="text-[#F2F4F7]">{medCount}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#16181e] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#73869B] to-[#B8D8F2] rounded-full"
                    style={{ width: `${medWidth}%` }}
                  />
                </div>
              </div>

              {/* Low */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-[#AEB8C5] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#606975]" />
                    Low
                  </span>
                  <span className="text-[#F2F4F7]">{lowCount}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#16181e] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#44474a] to-[#8f9194] rounded-full"
                    style={{ width: `${lowWidth}%` }}
                  />
                </div>
              </div>

              {/* Informational */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between font-label-code-sm text-label-code-sm">
                  <span className="text-[#606975] font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38393c]" />
                    Informational
                  </span>
                  <span className="text-[#929AA6]">{infoCount}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-[#16181e] overflow-hidden">
                  <div className="h-full bg-[#343538] rounded-full" style={{ width: `${infoWidth}%` }} />
                </div>
              </div>

              {/* Fast-Triage Action Box */}
              <div className="mt-2 pt-3 border-t border-[#252B33] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber-400 text-[16px]">priority_high</span>
                  <span className="font-body-sm text-body-sm text-[#929AA6]">
                    {highCount} High severity triage items pending
                  </span>
                </div>
                <Link
                  className="font-label-code-sm text-label-code-sm px-2.5 py-1 rounded bg-[#16181e] border border-[#252B33] text-[#E7ECF2] hover:border-[#AEB8C5]/50 transition-colors flex items-center gap-1"
                  href="/findings?severity=high"
                >
                  <span>Inspect</span>
                  <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Lower Section: Recent Operational Activity Stream */}
        <div id="activity" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#AEB8C5] text-[18px]">reorder</span>
              <h2 className="font-headline-sm text-headline-sm font-semibold text-[#F2F4F7]">
                Perimeter Activity Ledger
              </h2>
            </div>
            <span className="font-label-code-sm text-label-code-sm text-[#606975]">
              Realtime telemetry channel #01
            </span>
          </div>

          <div className="bg-[#0D1015] border border-[#252B33] rounded-xl p-2 specular-top divide-y divide-[#252B33]/60">
            {/* Item 1 */}
            <div className="py-2.5 px-3 flex items-center justify-between hover:bg-[#12161C]/50 rounded transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-[#16181e] border border-[#252B33] flex items-center justify-center text-[#B8D8F2]">
                  <span className="material-symbols-outlined text-[15px]">shield</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-label-code-sm text-label-code-sm text-[#F2F4F7]">
                    Scan LN-902 completed on <span className="text-[#AEB8C5]">api.acroba.internal</span>
                  </span>
                  <span className="hidden sm:inline text-[#606975]">•</span>
                  <span className="font-body-sm text-body-sm text-[#929AA6]">2 new vulnerabilities logged</span>
                </div>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] whitespace-nowrap pl-4">
                18m ago
              </span>
            </div>

            {/* Item 2 */}
            <div className="py-2.5 px-3 flex items-center justify-between hover:bg-[#12161C]/50 rounded transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-[#16181e] border border-[#252B33] flex items-center justify-center text-[#E7ECF2]">
                  <span className="material-symbols-outlined text-[15px]">key</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-label-code-sm text-label-code-sm text-[#F2F4F7]">
                    Domain <span className="text-[#AEB8C5]">acroba.internal</span> DNS TXT verification renewed
                  </span>
                  <span className="hidden sm:inline text-[#606975]">•</span>
                  <span className="font-body-sm text-body-sm text-emerald-400/90">Autonomous validator</span>
                </div>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] whitespace-nowrap pl-4">
                1h ago
              </span>
            </div>

            {/* Item 3 */}
            <div className="py-2.5 px-3 flex items-center justify-between hover:bg-[#12161C]/50 rounded transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-[#16181e] border border-[#252B33] flex items-center justify-center text-emerald-400">
                  <span className="material-symbols-outlined text-[15px]">check_circle</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-label-code-sm text-label-code-sm text-[#F2F4F7]">
                    CVE-2026-2184 verified resolved
                  </span>
                  <span className="hidden sm:inline text-[#606975]">•</span>
                  <span className="font-body-sm text-body-sm text-[#929AA6]">Actioned by Patch Pipeline</span>
                </div>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] whitespace-nowrap pl-4">
                3h ago
              </span>
            </div>

            {/* Item 4 */}
            <div className="py-2.5 px-3 flex items-center justify-between hover:bg-[#12161C]/50 rounded transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded bg-[#16181e] border border-[#252B33] flex items-center justify-center text-[#73869B]">
                  <span className="material-symbols-outlined text-[15px]">person</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                  <span className="font-label-code-sm text-label-code-sm text-[#F2F4F7]">
                    RoE Scope update signed
                  </span>
                  <span className="hidden sm:inline text-[#606975]">•</span>
                  <span className="font-body-sm text-body-sm text-[#929AA6]">
                    Sarah Lin (CISO) cryptographically confirmed
                  </span>
                </div>
              </div>
              <span className="font-label-code-sm text-label-code-sm text-[#606975] whitespace-nowrap pl-4">
                5h ago
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* 5. Signature MacBook-style Liquid-Metal Dock */}
      <nav
        aria-label="Liquid Metal OS Primary Navigation"
        className="fixed bottom-6 z-50 flex items-center justify-center pointer-events-auto left-1/2 -translate-x-1/2"
      >
        <div className="rounded-2xl flex items-center gap-1 md:gap-2 bg-[#0D1015]/90 backdrop-blur-2xl border border-[#252B33] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] shadow-2xl max-w-[calc(100vw-2rem)] overflow-x-auto px-6 py-2.5">
          {/* 1. Overview (Active) */}
          <Link
            href="/overview"
            aria-current="page"
            className="relative group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl bg-[#16181e] text-[#F2F4F7] transition-all flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[#FFFFFF]">
              <span
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: '"FILL" 1' }}
              >
                dashboard
              </span>
            </div>
            <span className="text-[11px] font-medium tracking-tight text-[#FFFFFF] mt-0.5">Overview</span>
            <span className="absolute -bottom-1 w-1 h-1 rounded-full bg-[#FFFFFF] shadow-[0_0_6px_#FFFFFF]" />
          </Link>

          {/* 2. Scans */}
          <Link
            href="/audit"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">radar</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Scans</span>
          </Link>

          {/* 3. Findings */}
          <Link
            href="/findings"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">security</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Findings</span>
          </Link>

          {/* 4. Assets */}
          <Link
            href="/assets"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">dns</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Assets</span>
          </Link>

          {/* 5. Reports */}
          <Link
            href="/reports"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">description</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Reports</span>
          </Link>

          {/* Divider */}
          <div className="h-6 w-[1px] bg-[#252B33] mx-1 flex-shrink-0" />

          {/* 6. Remediation */}
          <Link
            href="/automation"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">build</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Remediation</span>
          </Link>

          {/* 7. Clients */}
          <Link
            href="/clients"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">business_center</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Clients</span>
          </Link>

          {/* 8. Activity */}
          <a
            href="#activity"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">sensors</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Activity</span>
          </a>

          {/* 9. Settings */}
          <Link
            href="/settings"
            className="group flex flex-col items-center justify-center px-2.5 md:px-3 py-1.5 rounded-xl transition-all hover:bg-[#16181e] text-[#929AA6] hover:text-[#F2F4F7] flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[20px]">tune</span>
            </div>
            <span className="text-[11px] font-medium tracking-tight mt-0.5">Settings</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
