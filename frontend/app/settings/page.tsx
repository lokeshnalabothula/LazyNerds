"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { User, Shield, Database, LogOut, CheckCircle2, AlertCircle } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    database: string;
  } | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

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
    checkHealth();
  }, []);

  return (
    <AppShell title="Settings & System Status">
      <div className="max-w-3xl space-y-6">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Settings & Workspace Info
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Current authenticated account profile and backend infrastructure diagnostics.
          </p>
        </div>

        {/* User Account Card */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
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
                <span className="text-zinc-400 block text-[11px]">User Account ID</span>
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
              className="gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out of FixOps</span>
            </Button>
          </div>
        </div>

        {/* System & Database Diagnostics */}
        <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
            <Database className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Database & Infrastructure Diagnostics
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">Backend API Gateway</span>
              <Badge variant="active" size="sm">
                Operational (v1.0.0)
              </Badge>
            </div>

            <div className="flex items-center justify-between p-3 rounded bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
              <span className="text-zinc-600 dark:text-zinc-400">PostgreSQL Connection</span>
              {healthLoading ? (
                <span className="text-zinc-400 font-mono text-[11px]">Checking...</span>
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
              <span className="text-zinc-600 dark:text-zinc-400">Alembic Migrations</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 text-[11px]">
                001_initial_schema (Active)
              </span>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
