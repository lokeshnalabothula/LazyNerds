"use client";

import React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/**
 * Base neutral shimmer skeleton element.
 * Complies with strict reduced-motion preferences and matches dark cyber theme.
 */
export function Skeleton({ className = "", ...props }: SkeletonProps) {
  return (
    <div
      className={`bg-white/[0.06] dark:bg-[#1A1D24] animate-pulse motion-reduce:animate-none rounded ${className}`}
      {...props}
    />
  );
}

/**
 * Context-aware Skeleton for Security Operations Overview.
 * Exact dimensional matching for Header, SLA Alert Banner, 4 KPI Bento Cards,
 * and Telemetry + Queue findings panels. Eliminates layout shift completely.
 */
export function OverviewSkeleton() {
  return (
    <div className="w-full space-y-6 sm:space-y-8 animate-in fade-in duration-200">
      {/* 1. Header Bar Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-72 rounded-md" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-44 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* 2. Critical Alert Banner Skeleton */}
      <div className="rounded-lg border border-white/[0.08] bg-[#111318]/60 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-64 rounded" />
            <Skeleton className="h-3 w-80 rounded" />
          </div>
        </div>
        <Skeleton className="h-8 w-36 rounded" />
      </div>

      {/* 3. 4 KPI Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Active Engagements */}
        <div className="p-5 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </div>
          <Skeleton className="h-3 w-full rounded pt-2" />
        </div>

        {/* Card 2: Open Vulnerabilities */}
        <div className="p-5 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-36 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <div className="flex gap-1.5 pt-2">
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
            <Skeleton className="h-4 w-12 rounded" />
          </div>
        </div>

        {/* Card 3: Critical SLA Breaches */}
        <div className="p-5 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-8 w-12 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-3 w-36 rounded pt-2" />
        </div>

        {/* Card 4: MTTR Remediation */}
        <div className="p-5 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <Skeleton className="h-3 w-32 rounded pt-2" />
        </div>
      </div>

      {/* 4. Telemetry Charts & Queue Section Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
        <div className="p-6 rounded-lg border border-white/[0.08] bg-[#111318]/60 space-y-4">
          <Skeleton className="h-4 w-36 rounded" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded border border-white/[0.05] bg-white/[0.02] space-y-2">
                <Skeleton className="h-3.5 w-3/4 rounded" />
                <div className="flex justify-between">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Context-aware Skeleton for Client Management Directory.
 */
export function ClientsSkeleton() {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Cockpit Card Header */}
      <div className="rounded-2xl border border-white/10 bg-[#111318]/70 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3.5 w-72 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-80 rounded-xl" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Directory Table Skeleton */}
      <div className="rounded-2xl border border-white/10 bg-[#111318]/70 overflow-hidden divide-y divide-white/[0.06]">
        <div className="px-5 py-3.5 flex gap-4 bg-white/[0.02]">
          <Skeleton className="h-4 w-1/4 rounded" />
          <Skeleton className="h-4 w-1/5 rounded" />
          <Skeleton className="h-4 w-1/6 rounded" />
          <Skeleton className="h-4 w-1/6 rounded" />
          <Skeleton className="h-4 w-1/8 rounded" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 flex gap-4 items-center">
            <Skeleton className="h-4 w-1/4 rounded" />
            <Skeleton className="h-4 w-1/5 rounded" />
            <Skeleton className="h-4 w-1/6 rounded" />
            <Skeleton className="h-4 w-1/6 rounded" />
            <Skeleton className="h-4 w-1/8 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Context-aware Skeleton for Engagements Workspace.
 */
export function EngagementsSkeleton() {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Cockpit Card Header */}
      <div className="rounded-2xl border border-white/10 bg-[#111318]/70 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-52 rounded" />
            <Skeleton className="h-3.5 w-80 rounded" />
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-80 rounded-xl" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Engagements Rows */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-[#111318]/70 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-32 rounded" />
              <Skeleton className="h-3 w-40 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Context-aware Skeleton for Assessment & Findings Workspace.
 */
export function FindingsSkeleton() {
  return (
    <div className="w-full space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-56 rounded" />
          <Skeleton className="h-3.5 w-72 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Severity Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>

      {/* Search & Actions */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Findings List Skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-[#111318]/70 p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Skeleton className="w-2.5 h-2.5 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-64 rounded" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-32 rounded" />
                </div>
              </div>
            </div>
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Context-aware Skeleton for Client Registrations Queue.
 */
export function RegistrationsSkeleton() {
  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Cockpit Header Card */}
      <div className="rounded-xl border border-white/10 bg-[#111318]/90 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-3.5 w-72 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      {/* Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-80 rounded-xl" />
        <Skeleton className="h-9 w-44 rounded-lg" />
      </div>

      {/* Registration Cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-[#111318]/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-48 rounded" />
              <Skeleton className="h-5 w-24 rounded-full" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Skeleton className="h-3 w-28 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shell Skeleton for instant perceived loading without full-screen blocking overlay.
 */
export function AppShellSkeleton() {
  return (
    <div className="min-h-screen bg-[#07090E] telemetry-grid-bg flex flex-col text-[#e3e1e9] overflow-x-hidden">
      {/* Floating navigation placeholder */}
      <div className="w-full max-w-5xl mx-auto pt-4 px-4">
        <div className="h-14 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Skeleton className="w-7 h-7 rounded-md" />
            <Skeleton className="w-24 h-4 rounded" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-3 rounded" />
            <Skeleton className="w-16 h-3 rounded" />
            <Skeleton className="w-16 h-3 rounded" />
          </div>
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
      </div>

      {/* Main Content Skeleton Area */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 pt-6 pb-16">
        <OverviewSkeleton />
      </main>
    </div>
  );
}
