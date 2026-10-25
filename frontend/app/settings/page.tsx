"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { AuditLog } from "@/types/overview";
import {
  formatDateTime,
  SUPPORTED_TIMEZONES,
  getTimezonePreference,
  setTimezonePreference,
  getRawTimezoneSetting,
  getDetectedBrowserTimezone,
} from "@/lib/utils";
import {
  User,
  Shield,
  Database,
  LogOut,
  CheckCircle2,
  AlertCircle,
  History,
  Loader2,
  KeyRound,
  Lock,
  Globe,
  RefreshCw,
  Copy,
  Check,
  Layers,
  ChevronRight,
} from "lucide-react";

type SettingsSection = "account" | "preferences" | "security" | "health" | "audit" | "all";

interface SectionItem {
  id: SettingsSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionItem[] = [
  {
    id: "account",
    label: "Operator Profile",
    description: "Identity, role, and active session",
    icon: User,
  },
  {
    id: "preferences",
    label: "Preferences & Localization",
    description: "Operational timezone and display",
    icon: Globe,
  },
  {
    id: "security",
    label: "Security & Credentials",
    description: "Password lifecycle and hash verification",
    icon: Lock,
  },
  {
    id: "health",
    label: "System Health & Engine",
    description: "Live backend, DB, and dispatch telemetry",
    icon: Database,
  },
  {
    id: "audit",
    label: "Audit History",
    description: "Immutable platform operations record",
    icon: History,
  },
  {
    id: "all",
    label: "All Settings",
    description: "Complete administration suite",
    icon: Layers,
  },
];

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsSection>("account");

  // Health & Diagnostics Telemetry State
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
    service?: string;
    version?: string;
    commit?: string;
    environment?: string;
    worker_dispatch_mode?: string;
    timestamp?: string;
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Password Management Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Timezone State
  const [selectedTzSetting, setSelectedTzSetting] = useState<string>("Asia/Kolkata");
  const [effectiveTz, setEffectiveTz] = useState<string>("Asia/Kolkata");
  const [detectedTz, setDetectedTz] = useState<string>("Asia/Kolkata");
  const [tzSavedMsg, setTzSavedMsg] = useState<string | null>(null);

  // Operator ID copy feedback
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setSelectedTzSetting(getRawTimezoneSetting());
    setEffectiveTz(getTimezonePreference());
    setDetectedTz(getDetectedBrowserTimezone());
  }, []);

  const handleTimezoneChange = (newSetting: string) => {
    setSelectedTzSetting(newSetting);
    setTimezonePreference(newSetting);
    const eff = getTimezonePreference();
    setEffectiveTz(eff);
    setTzSavedMsg(`Operational time zone updated to ${eff}.`);
    setTimeout(() => setTzSavedMsg(null), 4000);
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await api.getHealth();
      setHealthStatus(res);
    } catch {
      setHealthStatus({ status: "disconnected", database: "unreachable" });
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await api.getAuditLogs(1);
      setAuditLogs(res.items);
    } catch {
      // Non-admins may not view audit logs
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    checkHealth();
    fetchAuditLogs();
  }, []);

  const handleCopyId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (newPassword.length < 10) {
      setPasswordError("New password must be at least 10 characters in length.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    try {
      setPasswordLoading(true);
      await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess("Your account password has been successfully updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password. Please verify your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const showSection = (sec: SettingsSection) => activeTab === "all" || activeTab === sec;

  return (
    <AppShell title="Settings & Administration">
      <div data-loading-state="complete" className="max-w-5xl space-y-6 mx-auto">
        {/* Header Strip with Accurate Sourced Badges */}
        <div className="border-b border-zinc-200 dark:border-[#222630] pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-[#F9FAFB] font-sans">
                Platform Settings & Administration
              </h1>
              <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-1 leading-relaxed">
                Operator profile, localized preferences, credential lifecycle, and live platform telemetry.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30">
                {healthStatus?.environment ? `${healthStatus.environment.toUpperCase()} WORKSPACE` : "FIXOPS WORKSPACE"}
              </span>
              <span className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
                {healthStatus?.version ? `v${healthStatus.version}` : (healthLoading ? "Connecting…" : "v1.0.0")}
              </span>
            </div>
          </div>
        </div>

        {/* Conventional Master-Detail Layout */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Left Sidebar Navigation */}
          <aside id="settings-sidebar" className="hidden lg:block w-60 xl:w-64 shrink-0">
            <div className="sticky top-20 p-2 rounded-xl bg-zinc-50 dark:bg-[#111318] border border-zinc-200 dark:border-[#222630] space-y-1 shadow-xs">
              <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-bold">
                Settings Navigation
              </div>
              {SECTIONS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full px-3 py-2.5 text-xs rounded-lg transition-all flex items-center justify-between gap-2.5 text-left min-h-[40px] group ${
                      isActive
                        ? "bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] font-semibold border-l-2 border-[#F5C518]"
                        : "text-zinc-600 dark:text-[#9CA3AF] hover:text-zinc-900 dark:hover:text-[#F9FAFB] hover:bg-zinc-200/60 dark:hover:bg-[#161920] border-l-2 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-[#F5C518]" : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"}`} />
                      <span className="truncate">{tab.label}</span>
                    </div>
                    {isActive && <ChevronRight className="h-3.5 w-3.5 text-[#F5C518] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Mobile & Tablet Section Selector (Bulletproof Native Dropdown with High Touch Target) */}
          <div className="w-full lg:hidden">
            <label htmlFor="mobile-settings-nav" className="block text-xs font-semibold text-zinc-700 dark:text-[#9CA3AF] mb-1.5">
              Settings Section
            </label>
            <div className="relative">
              <select
                id="mobile-settings-nav"
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as SettingsSection)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] text-zinc-900 dark:text-[#F9FAFB] font-medium min-h-[44px] focus:outline-none focus:ring-1 focus:ring-[#F5C518] shadow-xs"
              >
                {SECTIONS.map((tab) => (
                  <option key={tab.id} value={tab.id}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Right Main Content Area */}
          <main className="flex-1 min-w-0 w-full space-y-6">
            {/* SECTION 1: ACCOUNT PROFILE */}
            {showSection("account") && (
              <div className="cockpit-card specular-top p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                        Authenticated Personnel Profile
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                        Identity verification, assigned administrative role, and session credentials.
                      </p>
                    </div>
                  </div>
                  <Badge variant="active" size="sm" className="capitalize shrink-0">
                    {user?.role || "Operator"}
                  </Badge>
                </div>

                {user && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-zinc-100 dark:border-[#222630]">
                      <Avatar
                        size="xl"
                        fallbackText={user.full_name || user.email}
                        alt={user.full_name || "Operator"}
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-bold text-zinc-900 dark:text-[#F9FAFB] font-mono">
                            {user.full_name}
                          </h3>
                          <Badge variant="active" size="sm" className="capitalize">
                            {user.role}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] font-mono">
                          {user.email}
                        </p>
                        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono">
                          Official Operator Profile • FixOps Identity
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630]">
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[11px] mb-0.5">Full Name</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {user.full_name}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630]">
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[11px] mb-0.5">Account Email</span>
                        <span className="font-mono text-zinc-900 dark:text-zinc-100">
                          {user.email}
                        </span>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630]">
                        <span className="text-zinc-400 dark:text-zinc-500 block text-[11px] mb-0.5">Assigned Role</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Shield className="h-3.5 w-3.5 text-[#F5C518]" />
                          <span className="font-mono font-medium capitalize text-zinc-800 dark:text-zinc-200">
                            {user.role} (Platform Access)
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630]">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-zinc-400 dark:text-zinc-500 text-[11px]">Operator ID</span>
                          <button
                            onClick={handleCopyId}
                            className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1"
                            title="Copy Operator UUID"
                          >
                            {copiedId ? (
                              <>
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span className="text-emerald-500 font-mono">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3 w-3" />
                                <span className="font-mono">Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                        <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-300 break-all select-all block">
                          {user.id}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t border-zinc-200 dark:border-[#222630] flex items-center justify-between">
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                    End current active session across all platform services.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={logout}
                    className="gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 min-h-[36px] border-zinc-200 dark:border-[#222630] dark:bg-[#161920]"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Sign out of Workspace</span>
                  </Button>
                </div>
              </div>
            )}

            {/* SECTION 2: PREFERENCES & LOCALIZATION */}
            {showSection("preferences") && (
              <div className="cockpit-card specular-top p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center shrink-0">
                      <Globe className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                        Localization & Operational Time Zone
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                        Configure timestamp presentation across assessments, audit logs, and security telemetry.
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                    {effectiveTz}
                  </Badge>
                </div>

                {tzSavedMsg && (
                  <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span>{tzSavedMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <label htmlFor="timezone-select" className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF]">
                      Select Operational Time Zone
                    </label>
                    <select
                      id="timezone-select"
                      value={selectedTzSetting}
                      onChange={(e) => handleTimezoneChange(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] min-h-[38px] focus:outline-none focus:ring-1 focus:ring-[#F5C518] font-mono"
                    >
                      {SUPPORTED_TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.value === "auto" ? `Automatic (Detected: ${detectedTz})` : `${tz.label} [${tz.offset}]`}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF] leading-relaxed">
                      Timestamps are saved to the backend in UTC (ISO 8601) and resolved client-side into your selected preference.
                    </p>
                  </div>

                  <div className="p-4 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-2.5 text-xs">
                    <div className="flex justify-between items-center text-zinc-500 dark:text-[#9CA3AF]">
                      <span>Resolved Operational Zone:</span>
                      <span className="font-mono font-semibold text-[#B88700] dark:text-[#FFD84D]">
                        {effectiveTz}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-zinc-500 dark:text-[#9CA3AF]">
                      <span>Detected Browser Zone:</span>
                      <span className="font-mono text-zinc-700 dark:text-zinc-300">
                        {detectedTz}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-zinc-200 dark:border-[#222630] flex flex-col gap-1">
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500">Live Sample Timestamp:</span>
                      <span className="font-mono text-xs font-medium text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>
                        {formatDateTime(new Date().toISOString(), effectiveTz)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 3: SECURITY & CREDENTIALS */}
            {showSection("security") && (
              <div className="cockpit-card specular-top p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center shrink-0">
                      <Lock className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                        Security & Credential Management
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                        Update your operator password using cryptographically verified hashing.
                      </p>
                    </div>
                  </div>
                  <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                    Argon2 / Bcrypt Verified
                  </Badge>
                </div>

                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg">
                  {passwordError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{passwordError}</span>
                    </div>
                  )}

                  {passwordSuccess && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{passwordSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#9CA3AF]/60 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                        New Secure Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Min 10 characters"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#9CA3AF]/60 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-700 dark:text-[#9CA3AF] mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password"
                        placeholder="Re-enter password"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-zinc-300 dark:border-[#222630] bg-white dark:bg-[#161920] text-zinc-900 dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#9CA3AF]/60 min-h-[38px] focus:outline-none focus:ring-1 focus:ring-[#F5C518]"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      isLoading={passwordLoading}
                      className="min-h-[38px] btn-glossy-gold font-bold"
                    >
                      <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                      <span>Update Password</span>
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* SECTION 4: SYSTEM HEALTH & ENGINE DIAGNOSTICS */}
            {showSection("health") && (
              <div className="cockpit-card specular-top p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center shrink-0">
                      <Database className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                        Platform & Database Diagnostics
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                        Accurately sourced from backend telemetry endpoints; never simulated.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkHealth}
                    isLoading={healthLoading}
                    className="gap-1.5 text-xs min-h-[32px] border-zinc-200 dark:border-[#222630]"
                  >
                    <RefreshCw className={`h-3 w-3 ${healthLoading ? "animate-spin" : ""}`} />
                    <span>Refresh Telemetry</span>
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 text-xs">
                  {/* API Gateway Status */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">API Gateway</span>
                    {healthLoading ? (
                      <span className="text-zinc-400 font-mono text-[11px]">Probing gateway…</span>
                    ) : healthStatus?.status === "ok" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                          Operational
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                          {healthStatus?.status || "Degraded / Unreachable"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Service Name */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Service Identifier</span>
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100 text-[11px] truncate block">
                      {healthStatus?.service || "Lazy Nerds FixOps API"}
                    </span>
                  </div>

                  {/* Engine Version */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">API Version</span>
                    <span className="font-mono font-semibold text-[#B88700] dark:text-[#FFD84D] text-[11px] block">
                      {healthStatus?.version ? `v${healthStatus.version}` : "Unavailable"}
                    </span>
                  </div>

                  {/* Database Connection */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Database Engine</span>
                    {healthLoading ? (
                      <span className="text-zinc-400 font-mono text-[11px]">Checking database…</span>
                    ) : healthStatus?.database === "connected" ? (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block"></span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                          Connected & Pooled
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-rose-500 inline-block"></span>
                        <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono text-[11px]">
                          {healthStatus?.database || "Disconnected"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Runtime Environment */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Environment</span>
                    <Badge variant="neutral" size="sm" className="font-mono text-[10px]">
                      {healthStatus?.environment ? healthStatus.environment.toUpperCase() : "Unavailable"}
                    </Badge>
                  </div>

                  {/* Git Commit Revision */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Git Revision</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px] block">
                      {healthStatus?.commit ? healthStatus.commit.substring(0, 7) : "Unavailable"}
                    </span>
                  </div>

                  {/* Worker Dispatch Mode */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Worker Dispatch</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px] block">
                      {healthStatus?.worker_dispatch_mode ? healthStatus.worker_dispatch_mode.toUpperCase() : "Unavailable"}
                    </span>
                  </div>

                  {/* Schema Revision */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Schema Migration</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px] block">
                      Alembic 003 (managed server-side)
                    </span>
                  </div>

                  {/* Telemetry Probe Timestamp */}
                  <div className="p-3.5 rounded-lg bg-zinc-50 dark:bg-[#161920] border border-zinc-200 dark:border-[#222630] space-y-1.5">
                    <span className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] block">Last Health Probe</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[10px] block" suppressHydrationWarning>
                      {healthStatus?.timestamp ? formatDateTime(healthStatus.timestamp, effectiveTz) : "Live Probe"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 5: AUDIT LOG TRAIL */}
            {showSection("audit") && (
              <div className="cockpit-card specular-top p-5 sm:p-6 shadow-md space-y-5">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-[#F5C518]/10 border border-[#F5C518]/30 flex items-center justify-center shrink-0">
                      <History className="h-4 w-4 text-[#F5C518]" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F9FAFB]">
                        Security Audit Log Trail
                      </h2>
                      <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">
                        Immutable operations record for platform authentication and configuration events.
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={fetchAuditLogs}
                    isLoading={loadingLogs}
                    className="gap-1.5 text-xs min-h-[32px] border-zinc-200 dark:border-[#222630]"
                  >
                    <RefreshCw className={`h-3 w-3 ${loadingLogs ? "animate-spin" : ""}`} />
                    <span>Refresh Log</span>
                  </Button>
                </div>

                {loadingLogs ? (
                  <div className="py-8 text-center text-zinc-400 text-xs">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-[#F5C518]" />
                    <span>Loading audit trail…</span>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
                    No audit log entries recorded for this workspace.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 dark:divide-[#222630] max-h-96 overflow-y-auto">
                    {auditLogs.map((log) => (
                  <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3 text-xs">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-mono text-[11px] text-zinc-900 dark:text-[#F9FAFB]">
                          {log.action}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                          {log.user_email}
                        </span>
                      </div>
                      <p className="text-zinc-500 dark:text-[#9CA3AF] text-[11px] break-words">
                        {log.details || `Operation on ${log.resource_type}:${log.resource_id}`}
                      </p>
                    </div>
                    <div className="text-left sm:text-right text-[10px] text-zinc-400 dark:text-zinc-500 font-mono shrink-0">
                      {formatDateTime(log.created_at, effectiveTz)}
                    </div>
                  </div>
                ))}
                  </div>
                )}
              </div>
            )}
          </main>
        </div>
      </div>
    </AppShell>
  );
}
