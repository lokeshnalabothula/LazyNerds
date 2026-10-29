"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { OverviewMetrics } from "@/types/overview";

interface QueueFinding {
  id: string;
  title: string;
  identifier: string;
  targetAsset: string;
  targetIcon: string;
  cvss: string;
  cvssScore: number;
  clientScope: string;
  slaRemaining: string;
  slaDeadline: string;
  status: string;
  statusType: "remediation" | "awaiting_retest";
}

const INITIAL_QUEUE_FINDINGS: QueueFinding[] = [
  {
    id: "LN-2024-884",
    title: "SSH Backdoor Vulnerability",
    identifier: "CVE-2024-3094",
    targetAsset: "bastion-01.acmefin.internal",
    targetIcon: "terminal",
    cvss: "CVSS 10.0",
    cvssScore: 10.0,
    clientScope: "Acme Fintech",
    slaRemaining: "4h remaining",
    slaDeadline: "18:00 UTC Today",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-889",
    title: "Microsoft Outlook RCE via Preview Pane",
    identifier: "CVE-2024-21413",
    targetAsset: "corp-mail.fintech.io",
    targetIcon: "cloud",
    cvss: "CVSS 9.8",
    cvssScore: 9.8,
    clientScope: "Meridian Global",
    slaRemaining: "12h remaining",
    slaDeadline: "02:30 UTC Tomorrow",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-891",
    title: "JWT Secret Key Brute-force Weak Entropy",
    identifier: "CWE-326 · SEC-891",
    targetAsset: "api.v1.identity-prod",
    targetIcon: "api",
    cvss: "CVSS 8.4",
    cvssScore: 8.4,
    clientScope: "Nova Pay",
    slaRemaining: "28h remaining",
    slaDeadline: "18:00 UTC Wed",
    status: "In Remediation",
    statusType: "remediation",
  },
  {
    id: "LN-2024-742",
    title: "Broken Object Level Authorization (BOLA)",
    identifier: "API1:2023 · SEC-742",
    targetAsset: "/v2/accounts/{id}/transfers",
    targetIcon: "route",
    cvss: "CVSS 8.1",
    cvssScore: 8.1,
    clientScope: "Acme Fintech",
    slaRemaining: "36h remaining",
    slaDeadline: "02:00 UTC Thu",
    status: "Awaiting Retest",
    statusType: "awaiting_retest",
  },
];

export default function OverviewPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();

  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "Q3">("7D");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Authentication gate
  useEffect(() => {
    if (!authLoading && !user) {
      router.push(`/login?redirect=${encodeURIComponent("/overview")}`);
    }
  }, [user, authLoading, router]);

  // Telemetry API query
  const fetchTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getOverviewMetrics();
      setMetrics(data);
    } catch (err: any) {
      console.warn("[FixOps Overview] Realtime telemetry fallback active:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Global keyboard shortcuts (⌘K for search, ⌘N for new finding, ⌘S for new scope, ⌘R for report)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;
      if (isCmd && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (isCmd && e.key.toLowerCase() === "n") {
        e.preventDefault();
        router.push("/findings");
      } else if (isCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        router.push("/clients");
      } else if (isCmd && e.key.toLowerCase() === "r") {
        e.preventDefault();
        router.push("/reports");
      } else if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMobileSidebarOpen(false);
        setScanModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Outside click handler for user menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Toast feedback auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleSyncRemediation = async () => {
    setSyncing(true);
    try {
      await fetchTelemetry();
      setToastMessage("Remediation telemetry synchronized successfully.");
    } catch {
      setToastMessage("Remediation sync completed (telemetry current).");
    } finally {
      setSyncing(false);
    }
  };

  const handleExportSummary = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      activeEngagements: metrics?.engagements_active ?? 8,
      openVulnerabilities: metrics?.findings_open ?? 42,
      criticalFindingsBreached: 2,
      mttrDays: 3.8,
      status: "OPTIMAL",
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fixops-executive-summary-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToastMessage("Executive Summary report downloaded.");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center text-text-muted">
        <div className="flex items-center gap-2 font-code-sm text-code-sm">
          <span className="w-2 h-2 rounded-full bg-primary-container animate-pulse" />
          <span>AUTHENTICATING FIXOPS CONSOLE SESSION...</span>
        </div>
      </div>
    );
  }

  // Operator metadata with neutral fallbacks
  const operatorName = user?.full_name?.trim() || "Security Operator";
  const operatorRole = (() => {
    if (!user?.role) return "SecOps Lead";
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
    .slice(0, 2)
    .toUpperCase() || "SO";

  // Filtered queue findings
  const filteredFindings = INITIAL_QUEUE_FINDINGS.filter((f) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.title.toLowerCase().includes(q) ||
      f.identifier.toLowerCase().includes(q) ||
      f.targetAsset.toLowerCase().includes(q) ||
      f.clientScope.toLowerCase().includes(q)
    );
  });

  return (
    <div className="bg-surface-container-lowest text-text-primary antialiased min-h-screen flex selection:bg-primary-container selection:text-on-primary-container overflow-x-hidden font-body-base text-body-base">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2.5 rounded bg-surface border border-primary-container/40 text-text-primary text-xs font-code-sm flex items-center gap-2 shadow-2xl backdrop-blur animate-in fade-in slide-in-from-top-2">
          <span className="w-2 h-2 rounded-full bg-primary-container" />
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-text-muted hover:text-text-primary"
            aria-label="Dismiss toast"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ========================================================================= */}
      {/* SIDEBAR NAVIGATION (Strict compliance to Google Stitch SecOps reference) */}
      {/* ========================================================================= */}
      <aside
        className={`fixed top-0 left-0 h-screen border-r border-border-subtle bg-surface z-50 flex flex-col justify-between py-space-md select-none transition-all duration-200 ${
          sidebarCollapsed ? "w-20" : "w-64"
        } ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        {/* Brand Anchor & Header */}
        <div className="px-space-md">
          <div className="flex items-center gap-space-sm px-space-xs pb-space-md border-b border-border-subtle">
            <Link
              href="/overview"
              className="w-8 h-8 rounded bg-surface-subtle border border-border-strong flex items-center justify-center text-primary-container shrink-0 hover:border-primary-container/50 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]" data-icon="shield">
                shield
              </span>
            </Link>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-headline-md font-headline-md tracking-wider text-text-primary">
                    FIXOPS
                  </span>
                  <span className="px-1 py-0.5 rounded text-[9px] font-label-caps font-bold bg-primary-container/15 text-primary-container border border-primary-container/30">
                    v2.4
                  </span>
                </div>
                <span className="text-caption font-caption text-text-muted truncate">
                  Lazy Nerds SecOps
                </span>
              </div>
            )}
          </div>

          {/* Navigation Tab Cluster (Exact Stitch Labels & Hierarchy) */}
          <nav className="mt-space-md space-y-1">
            {/* 1. Dashboard (Active) */}
            <Link
              href="/overview"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } px-space-md py-space-sm text-text-primary bg-surface-subtle border-l-2 border-primary-container font-body-bold text-body-bold transition-all duration-150 ease-in-out cursor-pointer group rounded-r`}
              title="Dashboard"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-primary-container text-[18px]" data-icon="dashboard">
                  dashboard
                </span>
                {!sidebarCollapsed && <span>Dashboard</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary-container animate-pulse" />
              )}
            </Link>

            {/* 2. Clients */}
            <Link
              href="/clients"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Clients"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="domain">
                domain
              </span>
              {!sidebarCollapsed && <span>Clients</span>}
            </Link>

            {/* 3. Registrations */}
            <Link
              href="/registrations"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Registrations"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[18px]" data-icon="verified_user">
                  verified_user
                </span>
                {!sidebarCollapsed && <span>Registrations</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-label-caps bg-surface-elevated text-text-muted border border-border-subtle">
                  LOCKED
                </span>
              )}
            </Link>

            {/* 4. Engagements */}
            <Link
              href="/engagements"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Engagements"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="handshake">
                handshake
              </span>
              {!sidebarCollapsed && <span>Engagements</span>}
            </Link>

            {/* 5. Assets */}
            <Link
              href="/assets"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Assets"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="dns">
                dns
              </span>
              {!sidebarCollapsed && <span>Assets</span>}
            </Link>

            {/* 6. Findings */}
            <Link
              href="/findings"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "justify-between"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Findings"
            >
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[18px]" data-icon="security">
                  security
                </span>
                {!sidebarCollapsed && <span>Findings</span>}
              </div>
              {!sidebarCollapsed && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-label-caps font-bold bg-severity-critical-bg text-severity-critical border border-severity-critical-border">
                  {metrics?.findings_open ?? 14}
                </span>
              )}
            </Link>

            {/* 7. Automation */}
            <Link
              href="/automation"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Automation"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="smart_toy">
                smart_toy
              </span>
              {!sidebarCollapsed && <span>Automation</span>}
            </Link>

            {/* 8. Reports */}
            <Link
              href="/reports"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Reports"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="description">
                description
              </span>
              {!sidebarCollapsed && <span>Reports</span>}
            </Link>

            {/* 9. Settings */}
            <Link
              href="/settings"
              className={`flex items-center ${
                sidebarCollapsed ? "justify-center" : "gap-space-sm"
              } px-space-md py-space-sm text-text-secondary hover:text-text-primary hover:bg-surface-subtle font-body-medium text-body-medium transition-colors duration-150 cursor-pointer rounded`}
              title="Settings"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="settings">
                settings
              </span>
              {!sidebarCollapsed && <span>Settings</span>}
            </Link>
          </nav>
        </div>

        {/* Sidebar Bottom Container */}
        <div className="px-space-md space-y-3">
          {/* Collapse Trigger CTA */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center gap-space-xs py-1.5 rounded text-caption font-caption text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors duration-150 border border-transparent hover:border-border-subtle"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              data-icon={sidebarCollapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            >
              {sidebarCollapsed ? "keyboard_double_arrow_right" : "keyboard_double_arrow_left"}
            </span>
            {!sidebarCollapsed && <span>Collapse Sidebar</span>}
          </button>

          {/* User Metadata / Operator Pill */}
          <div
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="p-2.5 rounded bg-surface-subtle border border-border-subtle flex items-center gap-2.5 cursor-pointer hover:border-border-strong transition-all relative"
            title="Operator Session Details"
          >
            <div className="w-8 h-8 rounded bg-surface-elevated border border-border-strong flex items-center justify-center text-primary-container shrink-0">
              <span className="material-symbols-outlined text-[18px]" data-icon="badge">
                badge
              </span>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-body-bold font-body-bold text-text-primary truncate leading-tight">
                    {operatorName}
                  </div>
                  <div className="text-caption font-caption text-text-muted truncate">
                    {operatorRole}
                  </div>
                </div>
                <div
                  className="flex items-center gap-1 text-[11px] font-code-sm text-status-remediated shrink-0"
                  title="Session Active"
                >
                  <span
                    className="material-symbols-outlined text-[10px] text-status-remediated fill-current animate-pulse"
                    data-icon="fiber_manual_record"
                  >
                    fiber_manual_record
                  </span>
                </div>
              </>
            )}

            {/* Operator Dropdown Menu */}
            {userMenuOpen && (
              <div
                ref={userMenuRef}
                className="absolute bottom-14 left-0 w-60 rounded bg-surface border border-border-strong p-2 shadow-2xl z-50 specular-elevated"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1.5 border-b border-border-subtle mb-1">
                  <div className="text-xs font-bold text-text-primary truncate">{operatorName}</div>
                  <div className="text-[11px] text-text-muted font-code-sm truncate">{user?.email || "operator@fixops.local"}</div>
                </div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <span className="material-symbols-outlined text-[16px]">tune</span>
                  <span>Console Preferences</span>
                </Link>
                <button
                  onClick={async () => {
                    setUserMenuOpen(false);
                    await logout();
                    router.push("/login");
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-severity-critical hover:bg-severity-critical-bg transition-colors mt-1"
                >
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  <span>End Session / Log out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* MAIN APP WRAPPER: TopNavBar & Executive Dashboard Canvas                 */}
      {/* ========================================================================= */}
      <div
        className={`flex-1 flex flex-col min-w-0 bg-surface-container-lowest transition-all duration-200 ${
          sidebarCollapsed ? "lg:ml-20" : "lg:ml-64"
        }`}
      >
        {/* ======================================================================= */}
        {/* STICKY TOP NAVBAR (Exact Stitch strings & command shortcut)             */}
        {/* ======================================================================= */}
        <header className="w-full h-14 px-space-lg flex items-center justify-between sticky top-0 z-40 bg-surface border-b border-border-subtle backdrop-blur">
          {/* Left: Mobile Toggle, Breadcrumb & Monospace Search */}
          <div className="flex items-center gap-space-md lg:gap-space-lg">
            <button
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              className="lg:hidden w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
              aria-label="Toggle navigation drawer"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>

            <div className="flex items-center gap-2 text-body-medium font-body-medium text-text-secondary">
              <span className="text-text-muted font-code-sm hidden sm:inline">CONSOLE</span>
              <span className="text-text-muted hidden sm:inline">/</span>
              <span className="text-text-primary font-body-bold text-body-bold">Operations Overview</span>
            </div>

            <div className="h-4 w-px bg-border-subtle hidden md:block" />

            {/* Monospace Search Bar with ⌘K keyboard shortcut */}
            <div className="relative flex items-center hidden sm:flex">
              <span
                className="material-symbols-outlined absolute left-2.5 text-text-muted text-[17px] pointer-events-none"
                data-icon="search"
              >
                search
              </span>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-12 w-64 md:w-72 rounded bg-surface-subtle border border-border-subtle text-body-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary-container focus:border-primary-container text-xs transition-all"
                placeholder="Search findings, scopes, CVEs..."
                type="text"
              />
              <div className="absolute right-2 px-1 py-0.5 rounded bg-surface border border-border-strong text-[10px] font-code-sm text-text-muted pointer-events-none">
                ⌘K
              </div>
            </div>
          </div>

          {/* Right: SOC Status, Actions & CTAs */}
          <div className="flex items-center gap-space-sm sm:gap-space-md">
            {/* SOC Prod Status */}
            <div className="hidden xl:flex items-center gap-3 pr-2 border-r border-border-subtle">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface-subtle border border-border-subtle">
                <span className="w-2 h-2 rounded-full bg-status-remediated" />
                <span className="text-caption font-code-sm text-text-secondary">SOC Prod (UTC)</span>
              </div>
              <span className="text-caption font-code-sm text-status-remediated">SLA: Optimal</span>
            </div>

            {/* Trailing Icon Actions */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setToastMessage("Interactive SecOps Terminal attached: Ready for input.")}
                className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors duration-150"
                title="Terminal"
              >
                <span className="material-symbols-outlined text-[18px]" data-icon="terminal">
                  terminal
                </span>
              </button>
              <button
                onClick={() => setToastMessage("2 High-severity alerts require attention in Remediation Queue.")}
                className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors duration-150 relative"
                title="Notifications"
              >
                <span className="material-symbols-outlined text-[18px]" data-icon="notifications">
                  notifications
                </span>
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-severity-critical" />
              </button>
              <Link
                href="/reports"
                className="w-8 h-8 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors duration-150"
                title="Help & Reference"
              >
                <span className="material-symbols-outlined text-[18px]" data-icon="help_outline">
                  help_outline
                </span>
              </Link>
            </div>

            <div className="h-4 w-px bg-border-subtle hidden sm:block" />

            {/* Secondary & Primary Button Triggers */}
            <div className="flex items-center gap-2">
              {/* Secondary CTA: Rescan Scope */}
              <button
                onClick={() => {
                  setToastMessage("Rescan scope dispatched to pipeline worker.");
                  fetchTelemetry();
                }}
                className="hidden md:flex h-8 px-3 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle hover:border-border-strong text-caption font-body-bold text-text-primary transition-all duration-150 items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[15px]" data-icon="refresh">
                  refresh
                </span>
                <span>Rescan Scope</span>
              </button>

              {/* Primary CTA: Deploy Fix & Start scan action */}
              <button
                onClick={() => setScanModalOpen(true)}
                className="h-8 px-3.5 rounded btn-cyber-primary specular-button text-caption font-body-bold text-surface-container-lowest flex items-center gap-1.5 transition-all duration-150 cursor-pointer"
                title="Deploy Fix / Start scan"
              >
                <span className="material-symbols-outlined text-[16px] text-surface-container-lowest" data-icon="bolt">
                  bolt
                </span>
                <span>Deploy Fix</span>
              </button>
            </div>

            {/* Profile Avatar Indicator */}
            <div
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="w-8 h-8 rounded-full bg-surface-subtle border border-primary-container/40 p-0.5 flex items-center justify-center text-xs font-bold text-primary-container cursor-pointer select-none"
              title={`Logged in as ${operatorName} (${operatorRole})`}
            >
              {operatorInitials}
            </div>
          </div>
        </header>

        {/* ======================================================================= */}
        {/* MAIN CONTENT VIEWPORT: Executive Command Center                         */}
        {/* ======================================================================= */}
        <main className="flex-1 p-space-md sm:p-space-lg lg:p-space-xl max-w-7xl w-full mx-auto space-y-space-xl">
          {/* 1. HEADER BAR: Title, Subtitle & Action Bar */}
          <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border-b border-border-subtle pb-space-lg">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-display-lg font-display-lg text-text-primary tracking-tight">
                  Security Operations Overview
                </h1>
                <span className="px-2 py-0.5 rounded text-label-caps font-label-caps bg-surface-subtle text-primary-container border border-border-subtle">
                  LIVE TELEMETRY
                </span>
              </div>
              <p className="text-body-medium font-body-medium text-text-secondary mt-1">
                Continuous vulnerability remediation posture & active engagement scope
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-space-sm">
              {/* Timeframe Segmented Selector */}
              <div className="flex items-center bg-surface p-0.5 rounded border border-border-subtle text-xs font-code-sm">
                <button
                  onClick={() => setTimeframe("7D")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    timeframe === "7D"
                      ? "bg-surface-subtle text-text-primary border border-border-strong font-medium"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => setTimeframe("30D")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    timeframe === "30D"
                      ? "bg-surface-subtle text-text-primary border border-border-strong font-medium"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  30D
                </button>
                <button
                  onClick={() => setTimeframe("Q3")}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    timeframe === "Q3"
                      ? "bg-surface-subtle text-text-primary border border-border-strong font-medium"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  Q3
                </button>
              </div>

              {/* Export Summary CTA */}
              <button
                onClick={handleExportSummary}
                className="h-9 px-3 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle text-body-medium font-body-medium text-text-primary flex items-center gap-1.5 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]" data-icon="file_download">
                  file_download
                </span>
                <span>Export Executive Summary</span>
              </button>

              {/* Primary Remediation Sync Button */}
              <button
                onClick={handleSyncRemediation}
                disabled={syncing}
                className="h-9 px-4 rounded btn-cyber-primary text-body-bold font-body-bold text-surface-container-lowest flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                <span
                  className={`material-symbols-outlined text-[17px] text-surface-container-lowest ${
                    syncing ? "animate-spin" : ""
                  }`}
                  data-icon="sync"
                >
                  sync
                </span>
                <span>{syncing ? "Syncing..." : "Run Remediation Sync"}</span>
              </button>
            </div>
          </section>

          {/* 2. CRITICAL OPERATIONAL ALERTS BANNER */}
          <section className="rounded-lg bg-surface border border-severity-critical-border p-space-md flex flex-col md:flex-row md:items-center justify-between gap-space-md specular-card relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-severity-critical" />
            <div className="flex items-center gap-space-md">
              <div className="w-9 h-9 rounded bg-severity-critical-bg border border-severity-critical-border flex items-center justify-center text-severity-critical shrink-0">
                <span className="material-symbols-outlined text-[20px]" data-icon="warning">
                  warning
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-body-bold font-body-bold text-text-primary">
                    2 Critical Findings breach 48h Remediation SLA
                  </span>
                  <span className="text-xs px-1.5 py-0.5 rounded font-code-sm bg-severity-critical-bg text-severity-critical font-bold">
                    CRITICAL ESCALATION
                  </span>
                </div>
                <p className="text-caption font-caption text-text-secondary mt-0.5">
                  Client <span className="font-code-sm text-text-primary font-medium">Acme Fintech (Core API)</span> — Immediate mitigation required before contractual audit cutoff.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end md:self-center shrink-0">
              <Link
                href="/findings"
                className="px-3 py-1.5 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle text-xs font-code-sm text-text-primary flex items-center gap-1.5 transition-colors"
              >
                <span>Inspect Finding #LN-2024-884</span>
                <span className="material-symbols-outlined text-[14px]" data-icon="open_in_new">
                  open_in_new
                </span>
              </Link>
              <button
                onClick={() => setToastMessage("Senior Security Engineer paged for immediate remediation.")}
                className="px-3 py-1.5 rounded bg-severity-critical-bg hover:bg-severity-critical/20 text-severity-critical border border-severity-critical-border text-xs font-body-bold transition-colors"
              >
                Reassign Engineer
              </button>
            </div>
          </section>

          {/* 3. EXECUTIVE SECURITY KPI CARDS (4 Grid Bento) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-lg">
            {/* Card 1: Active Engagements */}
            <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-caption font-label-caps text-text-muted">ACTIVE ENGAGEMENTS</span>
                <span className="material-symbols-outlined text-text-muted text-[18px]" data-icon="handshake">
                  handshake
                </span>
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-metric-stat font-metric-stat text-text-primary">
                    {metrics?.engagements_active ?? 8}
                  </span>
                  <span className="text-caption font-caption text-text-muted">Authorized</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border-subtle text-[11px] font-code-sm text-text-secondary truncate">
                3 Web App · 2 Cloud · 3 Mobile API
              </div>
            </div>

            {/* Card 2: Open Vulnerabilities */}
            <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-caption font-label-caps text-text-muted">OPEN VULNERABILITIES</span>
                <span className="material-symbols-outlined text-severity-critical text-[18px]" data-icon="bug_report">
                  bug_report
                </span>
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-metric-stat font-metric-stat text-text-primary">
                    {metrics?.findings_open ?? 42}
                  </span>
                  <span className="text-caption font-caption text-text-muted">Total Unresolved</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border-subtle flex items-center gap-1.5 overflow-x-auto text-[10px] font-label-caps font-bold">
                <span className="px-1.5 py-0.5 rounded bg-severity-critical-bg text-severity-critical border border-severity-critical-border">
                  4 Crit
                </span>
                <span className="px-1.5 py-0.5 rounded bg-severity-high-bg text-severity-high border border-severity-high-border">
                  11 High
                </span>
                <span className="px-1.5 py-0.5 rounded bg-severity-medium-bg text-severity-medium border border-severity-medium-border">
                  18 Med
                </span>
                <span className="px-1.5 py-0.5 rounded bg-severity-low-bg text-severity-low border border-severity-low-border">
                  9 Low
                </span>
              </div>
            </div>

            {/* Card 3: Mean Time to Remediate (MTTR) */}
            <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-caption font-label-caps text-text-muted">MEAN TIME TO REMEDIATE</span>
                <span className="material-symbols-outlined text-status-remediated text-[18px]" data-icon="timelapse">
                  timelapse
                </span>
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-metric-stat font-metric-stat text-text-primary">3.8</span>
                  <span className="text-caption font-caption text-text-muted">Days MTTR</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-code-sm">
                <span className="text-text-muted">Target: &lt; 5.0 Days</span>
                <span className="text-status-remediated font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-status-remediated" />
                  Optimal
                </span>
              </div>
            </div>

            {/* Card 4: Awaiting Verification */}
            <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-caption font-label-caps text-text-muted">AWAITING VERIFICATION</span>
                <span className="material-symbols-outlined text-primary-container text-[18px]" data-icon="flaky">
                  flaky
                </span>
              </div>
              <div className="my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-metric-stat font-metric-stat text-primary-container">9</span>
                  <span className="text-caption font-caption text-text-muted">Patches Ready</span>
                </div>
              </div>
              <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-[11px] font-code-sm text-text-secondary">
                <span>Ready for SecOps retest</span>
                <span className="text-text-muted">42m ago</span>
              </div>
            </div>
          </section>

          {/* 4. TWO-COLUMN OPERATIONS LAYOUT (65% / 35%) */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-space-xl items-start">
            {/* =================================================================== */}
            {/* LEFT COLUMN (65% width / 8 cols): High Priority Remediation Queue   */}
            {/* =================================================================== */}
            <div className="lg:col-span-8 space-y-space-lg">
              <div className="rounded-lg bg-surface border border-border-subtle specular-card overflow-hidden">
                {/* Table Action Header */}
                <div className="p-space-lg border-b border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-elevated">
                  <div>
                    <h2 className="text-headline-sm font-headline-sm text-text-primary">
                      High Priority Remediation Queue
                    </h2>
                    <p className="text-caption font-caption text-text-secondary mt-0.5">
                      Critical & High security findings requiring active intervention
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 text-xs font-code-sm text-text-muted bg-surface-subtle px-2.5 py-1 rounded border border-border-subtle">
                      <span>FILTER:</span>
                      <span className="text-text-primary">SLA &lt; 24h</span>
                    </div>
                    <button
                      onClick={() => setToastMessage("Filter applied: Findings breaching SLA within 24 hours.")}
                      className="w-7 h-7 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors"
                      title="Toggle Filter"
                    >
                      <span className="material-symbols-outlined text-[16px]" data-icon="filter_list">
                        filter_list
                      </span>
                    </button>
                  </div>
                </div>

                {/* Dense Technical Remediation Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-subtle text-[11px] font-label-caps text-text-muted">
                        <th className="py-2.5 px-4 font-bold">FINDING TITLE & IDENTIFIER</th>
                        <th className="py-2.5 px-3 font-bold">TARGET ASSET</th>
                        <th className="py-2.5 px-3 font-bold">SEVERITY</th>
                        <th className="py-2.5 px-3 font-bold">CLIENT SCOPE</th>
                        <th className="py-2.5 px-3 font-bold">SLA DEADLINE</th>
                        <th className="py-2.5 px-3 font-bold">STATUS</th>
                        <th className="py-2.5 px-3 text-right font-bold">ACTION</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle text-xs font-body-base">
                      {filteredFindings.map((finding) => (
                        <tr key={finding.id} className="hover:bg-surface-subtle transition-colors group">
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="text-body-bold font-body-bold text-text-primary group-hover:text-primary transition-colors">
                                {finding.title}
                              </span>
                              <span
                                className={`text-[11px] font-code-sm ${
                                  finding.cvssScore >= 9.0 ? "text-severity-critical" : "text-severity-high"
                                }`}
                              >
                                {finding.identifier}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 font-code-sm text-text-secondary bg-surface-elevated px-2 py-0.5 rounded border border-border-subtle w-fit">
                              <span className="material-symbols-outlined text-[13px] text-text-muted" data-icon={finding.targetIcon}>
                                {finding.targetIcon}
                              </span>
                              <span>{finding.targetAsset}</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-label-caps ${
                                finding.cvssScore >= 9.0
                                  ? "bg-severity-critical-bg text-severity-critical border border-severity-critical-border"
                                  : "bg-severity-high-bg text-severity-high border border-severity-high-border"
                              }`}
                            >
                              {finding.cvssScore === 10.0 && (
                                <span className="w-1.5 h-1.5 rounded-full bg-severity-critical animate-pulse" />
                              )}
                              {finding.cvss}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-body-medium text-text-secondary">{finding.clientScope}</span>
                          </td>
                          <td className="py-3 px-3 font-code-sm">
                            <div
                              className={`font-bold ${
                                finding.slaRemaining.includes("4h")
                                  ? "text-severity-critical"
                                  : finding.slaRemaining.includes("12h")
                                  ? "text-severity-high"
                                  : "text-text-primary"
                              }`}
                            >
                              {finding.slaRemaining}
                            </div>
                            <div className="text-[10px] text-text-muted">{finding.slaDeadline}</div>
                          </td>
                          <td className="py-3 px-3">
                            {finding.statusType === "awaiting_retest" ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-code-sm bg-status-remediated-bg text-status-remediated border border-status-remediated-border flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-status-remediated" />
                                {finding.status}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-code-sm bg-surface-elevated text-severity-high border border-border-strong flex items-center gap-1 w-fit">
                                <span className="w-1.5 h-1.5 rounded-full bg-severity-high" />
                                {finding.status}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setToastMessage(`Navigating to finding ${finding.id}...`);
                                router.push("/findings");
                              }}
                              className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-surface-highlight transition-colors"
                              title="Inspect Finding Details"
                            >
                              <span className="material-symbols-outlined text-[18px]" data-icon="more_vert">
                                more_vert
                              </span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Pagination / Quick Summary */}
                <div className="py-2.5 px-4 bg-surface-subtle border-t border-border-subtle flex items-center justify-between text-caption font-code-sm text-text-muted">
                  <span>Showing {filteredFindings.length} of 14 Critical/High Findings</span>
                  <Link
                    href="/findings"
                    className="text-primary-container hover:underline flex items-center gap-1 font-body-medium"
                  >
                    <span>View Full Findings Inventory</span>
                    <span className="material-symbols-outlined text-[14px]" data-icon="arrow_forward">
                      arrow_forward
                    </span>
                  </Link>
                </div>
              </div>

              {/* Secondary Metric Sub-Panel: Asset Attack Surface Density */}
              <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card">
                <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary-container text-[18px]" data-icon="radar">
                      radar
                    </span>
                    <span className="text-body-bold font-body-bold text-text-primary">
                      Engagement Attack Surface Coverage
                    </span>
                  </div>
                  <span className="text-[11px] font-code-sm text-text-muted">142 Host Endpoints Monitored</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                  <div className="p-3 rounded bg-surface-subtle border border-border-subtle">
                    <div className="text-caption font-label-caps text-text-muted">CLOUD INFRASTRUCTURE</div>
                    <div className="text-headline-sm font-code-sm text-text-primary mt-1">98.4% Posture</div>
                    <div className="w-full bg-surface h-1.5 rounded mt-2 overflow-hidden">
                      <div className="bg-status-remediated h-full" style={{ width: "98.4%" }} />
                    </div>
                  </div>
                  <div className="p-3 rounded bg-surface-subtle border border-border-subtle">
                    <div className="text-caption font-label-caps text-text-muted">PUBLIC APIS & GW</div>
                    <div className="text-headline-sm font-code-sm text-severity-high mt-1">84.2% Posture</div>
                    <div className="w-full bg-surface h-1.5 rounded mt-2 overflow-hidden">
                      <div className="bg-severity-high h-full" style={{ width: "84.2%" }} />
                    </div>
                  </div>
                  <div className="p-3 rounded bg-surface-subtle border border-border-subtle">
                    <div className="text-caption font-label-caps text-text-muted">INTERNAL BASTIONS</div>
                    <div className="text-headline-sm font-code-sm text-severity-critical mt-1">71.0% Posture</div>
                    <div className="w-full bg-surface h-1.5 rounded mt-2 overflow-hidden">
                      <div className="bg-severity-critical h-full" style={{ width: "71.0%" }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* =================================================================== */}
            {/* RIGHT COLUMN (35% width / 4 cols): Posture Meters & Audit Stream    */}
            {/* =================================================================== */}
            <div className="lg:col-span-4 space-y-space-lg">
              {/* 1. Severity Breakdown & Posture Meter */}
              <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card">
                <div className="flex items-center justify-between pb-space-sm border-b border-border-subtle">
                  <h3 className="text-headline-sm font-headline-sm text-text-primary">Severity Breakdown</h3>
                  <span className="text-caption font-code-sm text-text-muted">56 Total Tracked</span>
                </div>

                {/* Segmented Multi-Color Distribution Bar */}
                <div className="mt-space-md">
                  <div className="h-2 w-full rounded flex overflow-hidden gap-0.5 bg-surface-container-low">
                    <div className="bg-severity-critical h-full" style={{ width: "7.1%" }} title="Critical (4)" />
                    <div className="bg-severity-high h-full" style={{ width: "19.6%" }} title="High (11)" />
                    <div className="bg-severity-medium h-full" style={{ width: "32.1%" }} title="Medium (18)" />
                    <div className="bg-severity-low h-full" style={{ width: "16.1%" }} title="Low (9)" />
                    <div className="bg-status-remediated h-full" style={{ width: "25.1%" }} title="Remediated (14)" />
                  </div>

                  {/* Legend & Granular Counts */}
                  <div className="mt-4 space-y-2.5 text-xs font-code-sm">
                    {/* Critical */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-severity-critical" />
                        <span className="text-text-primary">Critical (CVSS 9.0 - 10.0)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-bold">4</span>
                        <span className="text-text-muted text-[11px]">(7.1%)</span>
                      </div>
                    </div>
                    {/* High */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-severity-high" />
                        <span className="text-text-primary">High (CVSS 7.0 - 8.9)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-bold">11</span>
                        <span className="text-text-muted text-[11px]">(19.6%)</span>
                      </div>
                    </div>
                    {/* Medium */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-severity-medium" />
                        <span className="text-text-primary">Medium (CVSS 4.0 - 6.9)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-bold">18</span>
                        <span className="text-text-muted text-[11px]">(32.1%)</span>
                      </div>
                    </div>
                    {/* Low */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-severity-low" />
                        <span className="text-text-primary">Low (CVSS 0.1 - 3.9)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-text-primary font-bold">9</span>
                        <span className="text-text-muted text-[11px]">(16.1%)</span>
                      </div>
                    </div>
                    {/* Remediated & Verified */}
                    <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm bg-status-remediated" />
                        <span className="text-status-remediated font-medium">Verified Remediated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-status-remediated font-bold">14</span>
                        <span className="text-text-muted text-[11px]">(25.1%)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Live Remediation & Chronological Audit Stream */}
              <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card">
                <div className="flex items-center justify-between pb-space-sm border-b border-border-subtle">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[17px] text-primary-container" data-icon="history">
                      history
                    </span>
                    <h3 className="text-headline-sm font-headline-sm text-text-primary">Live Remediation & Audit</h3>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-status-remediated animate-ping" />
                </div>

                {/* Chronological Event Feed */}
                <div className="mt-space-md space-y-4 relative before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border-subtle">
                  {/* Event 1: Patch Verified */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-status-remediated-bg border border-status-remediated-border flex items-center justify-center text-status-remediated shrink-0 z-10">
                      <span className="material-symbols-outlined text-[13px]" data-icon="check_circle">
                        check_circle
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body-base text-text-primary leading-snug">
                        Security patch verified fixed:{" "}
                        <span className="font-code-sm text-status-remediated">SQL Injection on Auth Gateway</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-caption text-text-muted">
                        <span>Sarah Chen (SecOps)</span>
                        <span>·</span>
                        <span>18m ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Event 2: New Finding Imported */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-surface-subtle border border-border-strong flex items-center justify-center text-severity-high shrink-0 z-10">
                      <span className="material-symbols-outlined text-[13px]" data-icon="sync_alt">
                        sync_alt
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body-base text-text-primary leading-snug">
                        New finding imported from Burp Enterprise:{" "}
                        <span className="font-code-sm text-text-secondary">Stored XSS on Profile Settings</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-caption text-text-muted">
                        <span>Scanner Engine #2</span>
                        <span>·</span>
                        <span>1h ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Event 3: Client Sign-off */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-surface-subtle border border-border-strong flex items-center justify-center text-primary-container shrink-0 z-10">
                      <span className="material-symbols-outlined text-[13px]" data-icon="draw">
                        draw
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body-base text-text-primary leading-snug">
                        Client <span className="font-bold text-text-primary">Meridian Corp</span> signed off on Penetration Testing Rules of Engagement
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-caption text-text-muted">
                        <span>Portal Audit Contract</span>
                        <span>·</span>
                        <span>3h ago</span>
                      </div>
                    </div>
                  </div>

                  {/* Event 4: Automated Retest */}
                  <div className="flex items-start gap-3 relative">
                    <div className="w-6 h-6 rounded-full bg-surface-subtle border border-border-strong flex items-center justify-center text-text-secondary shrink-0 z-10">
                      <span className="material-symbols-outlined text-[13px]" data-icon="smart_toy">
                        smart_toy
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-body-base text-text-primary leading-snug">
                        Automated retest triggered for 3 assets following CI/CD webhook dispatch
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-caption text-text-muted">
                        <span>FixOps Pipeline Agent</span>
                        <span>·</span>
                        <span>4h ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Quick Operations Shortcuts Panel */}
              <div className="p-space-lg rounded-lg bg-surface border border-border-subtle specular-card">
                <h3 className="text-headline-sm font-headline-sm text-text-primary pb-3 border-b border-border-subtle">
                  Operations Shortcuts
                </h3>
                <div className="mt-3 space-y-2">
                  <button
                    onClick={() => router.push("/findings")}
                    className="w-full h-9 px-3 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle flex items-center justify-between text-body-medium font-body-medium text-text-primary transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-primary-container" data-icon="add_circle">
                        add_circle
                      </span>
                      <span>Add New Finding</span>
                    </div>
                    <span className="text-caption font-code-sm text-text-muted group-hover:text-text-primary">⌘N</span>
                  </button>

                  <button
                    onClick={() => router.push("/clients")}
                    className="w-full h-9 px-3 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle flex items-center justify-between text-body-medium font-body-medium text-text-primary transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-text-secondary" data-icon="domain_add">
                        domain_add
                      </span>
                      <span>Register New Scope</span>
                    </div>
                    <span className="text-caption font-code-sm text-text-muted group-hover:text-text-primary">⌘S</span>
                  </button>

                  <button
                    onClick={() => router.push("/reports")}
                    className="w-full h-9 px-3 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle flex items-center justify-between text-body-medium font-body-medium text-text-primary transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[17px] text-text-secondary" data-icon="summarize">
                        summarize
                      </span>
                      <span>Generate Audit Report</span>
                    </div>
                    <span className="text-caption font-code-sm text-text-muted group-hover:text-text-primary">⌘R</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* System Diagnostic Terminal Strip */}
          <footer className="pt-space-md border-t border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-2 text-caption font-code-sm text-text-muted">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-status-remediated">
                <span className="w-1.5 h-1.5 rounded-full bg-status-remediated" />
                ALL SUBSYSTEMS NOMINAL
              </span>
              <span>·</span>
              <span>SCAN ENGINE LATENCY: 24ms</span>
              <span>·</span>
              <span>INGEST QUEUE: 0 PENDING</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Lazy Nerds FixOps Security Console</span>
              <span>·</span>
              <span>Build e971bc3</span>
            </div>
          </footer>
        </main>
      </div>

      {/* Deploy Fix & Scan Dispatch Modal */}
      {scanModalOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-lg bg-surface border border-border-strong p-6 shadow-2xl specular-elevated">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary-container text-[20px]">bolt</span>
                <h3 className="text-headline-sm font-headline-sm text-text-primary">Deploy Remediation Patch</h3>
              </div>
              <button
                onClick={() => setScanModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <div className="mt-4 space-y-3 text-xs">
              <p className="text-text-secondary leading-relaxed">
                Dispatch automated verification scan and stage automated hotfix for active high-priority findings.
              </p>
              <div className="p-3 rounded bg-surface-subtle border border-border-subtle space-y-2">
                <div className="flex justify-between font-code-sm">
                  <span className="text-text-muted">Target Host:</span>
                  <span className="text-text-primary font-bold">bastion-01.acmefin.internal</span>
                </div>
                <div className="flex justify-between font-code-sm">
                  <span className="text-text-muted">Fix Script:</span>
                  <span className="text-status-remediated">fixops-patch-ssh-3094.sh</span>
                </div>
                <div className="flex justify-between font-code-sm">
                  <span className="text-text-muted">Verification Mode:</span>
                  <span className="text-primary-container">Start scan & verify fix</span>
                </div>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-2">
              <button
                onClick={() => setScanModalOpen(false)}
                className="px-3 py-1.5 rounded bg-surface-subtle hover:bg-surface-highlight border border-border-subtle text-xs text-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setScanModalOpen(false);
                  setToastMessage("Remediation patch deployed and verification scan started.");
                }}
                className="px-4 py-1.5 rounded btn-cyber-primary text-xs font-bold text-surface-container-lowest flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">send</span>
                <span>Confirm & Start scan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
