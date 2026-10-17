"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Clock,
  History,
  Loader2,
  KeyRound,
  Lock,
  Globe,
} from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Timezone Preference State
  const [selectedTzSetting, setSelectedTzSetting] = useState<string>("Asia/Kolkata");
  const [effectiveTz, setEffectiveTz] = useState<string>("Asia/Kolkata");
  const [detectedTz, setDetectedTz] = useState<string>("Asia/Kolkata");
  const [tzSavedMsg, setTzSavedMsg] = useState<string | null>(null);

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

  useEffect(() => {
    const checkHealth = async () => {
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
      try {
        setLoadingLogs(true);
        const res = await api.getAuditLogs(1);
        setAuditLogs(res.items);
      } catch {
        // Non-admins may not view audit logs
      } finally {
        setLoadingLogs(false);
      }
    };

    checkHealth();
    fetchAuditLogs();
  }, []);

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

  return (
    <AppShell title="Settings & Administration">
      <div className="max-w-4xl space-y-6 mx-auto">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
            Platform Settings & Administration
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            Authenticated operator profile, credential management, audit logging, and platform diagnostics.
          </p>
        </div>

        {/* User Account Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <User className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Authenticated Personnel
            </h2>
          </div>

          {user && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px]">Full Name</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {user.full_name}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 block text-[11px]">Account Email</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  {user.email}
                </span>
              </div>

              <div>
                <span className="text-zinc-400 block text-[11px]">Assigned Role</span>
                <Badge variant="active" size="sm" className="capitalize">
                  {user.role}
                </Badge>
              </div>

              <div>
                <span className="text-zinc-400 block text-[11px]">Operator ID</span>
                <span className="font-mono text-[11px] text-zinc-500 break-all select-all">
                  {user.id}
                </span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 min-h-[36px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out of Workspace</span>
            </Button>
          </div>
        </div>

        {/* Localization & Time Zone Preferences Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Globe className="h-4 w-4 text-brand-500" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Localization & Operational Time Zone
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Configure your preferred time zone for displaying assessment dates, audit logs, and security telemetry.
              </p>
            </div>
          </div>

          {tzSavedMsg && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{tzSavedMsg}</span>
            </div>
          )}

          <div className="space-y-4 max-w-md">
            <div>
              <label htmlFor="timezone-select" className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Active Time Zone Preference
              </label>
              <select
                id="timezone-select"
                value={selectedTzSetting}
                onChange={(e) => handleTimezoneChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-h-[38px] focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
              >
                {SUPPORTED_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.value === "auto" ? `Automatic (Detected: ${detectedTz})` : `${tz.label} [${tz.offset}]`}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-zinc-500">
                <span>Resolved Active Zone:</span>
                <span className="font-mono font-semibold text-brand-600 dark:text-brand-400">
                  {effectiveTz}
                </span>
              </div>
              <div className="flex justify-between items-center text-zinc-500">
                <span>Sample Live Timestamp:</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200" suppressHydrationWarning>
                  {formatDateTime(new Date().toISOString(), effectiveTz)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Password Management Card */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Lock className="h-4 w-4 text-brand-500" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Security & Credential Management
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Update your account password using strong cryptographic verification.
              </p>
            </div>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
            {passwordError && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                New Secure Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Minimum 10 characters"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Re-enter new password"
                className="w-full px-3 py-1.5 text-xs rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 min-h-[36px] focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <Button
              type="submit"
              size="sm"
              isLoading={passwordLoading}
              className="min-h-[36px]"
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              <span>Update Password</span>
            </Button>
          </form>
        </div>

        {/* System & Database Diagnostics */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Database className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Platform & Database Diagnostics
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Backend API Gateway</span>
              <Badge variant="active" size="sm">
                Operational (FixOps v2.0.0)
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Database Engine</span>
              {healthLoading ? (
                <span className="text-zinc-400 font-mono text-[11px]">Checking status…</span>
              ) : healthStatus?.database === "connected" ? (
                <Badge variant="active" size="sm">
                  Connected & Pooled
                </Badge>
              ) : (
                <Badge variant="danger" size="sm">
                  {healthStatus?.database || "Disconnected"}
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Schema Revision</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                003_complete_fixops_platform
              </span>
            </div>
          </div>
        </div>

        {/* Audit Log Trail */}
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-brand-500" />
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Security Audit Log Trail
              </h2>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">
              Immutable Operations Record
            </span>
          </div>

          {loadingLogs ? (
            <div className="py-8 text-center text-zinc-400 text-xs">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-brand-500" />
              <span>Loading audit trail…</span>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-400">
              No audit log entries available for this account.
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 sm:gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold font-mono text-[11px] text-zinc-900 dark:text-zinc-100">
                        {log.action}
                      </span>
                      <span className="text-[10px] text-zinc-400 font-mono truncate">
                        {log.user_email}
                      </span>
                    </div>
                    <p className="text-zinc-500 dark:text-zinc-400 text-[11px] mt-0.5 break-words">
                      {log.details || `Operation on ${log.resource_type}:${log.resource_id}`}
                    </p>
                  </div>
                  <div className="text-left sm:text-right text-[10px] text-zinc-400 font-mono shrink-0">
                    {formatDateTime(log.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
