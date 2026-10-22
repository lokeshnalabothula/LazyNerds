"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, RefreshCw, LogIn, ShieldAlert } from "lucide-react";
import { Button } from "./button";

interface AppLoaderProps {
  label?: string;
  subtext?: string;
  fullScreen?: boolean;
  onRetry?: () => void;
}

/**
 * Flagship Lazy Nerds FixOps Fullscreen Application & Session Verification Loader.
 * Features the official latest operator profile emblem with subtle yellow specular glow,
 * responsive safe-area viewport container, reduced-motion compliance,
 * and automatic deadlock recovery if backend initialization is delayed.
 */
export const FixOpsAppLoader: React.FC<AppLoaderProps> = ({
  label = "INITIALIZING FIXOPS",
  subtext = "Securing operational perimeters…",
  fullScreen = true,
  onRetry,
}) => {
  const [isDelayed, setIsDelayed] = useState(false);
  const [profileImgError, setProfileImgError] = useState(false);

  useEffect(() => {
    // Safety watchdog: If loading screen remains mounted > 7 seconds, display recovery controls
    const timer = setTimeout(() => {
      setIsDelayed(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, []);

  const handleManualReload = () => {
    if (onRetry) {
      onRetry();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={
        fullScreen
          ? "fixed inset-0 w-screen h-screen min-h-[100dvh] max-h-[100dvh] z-[9999] overflow-hidden overscroll-none select-none bg-[#0B0C0E] flex flex-col items-center justify-center px-4 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] text-center"
          : "w-full py-16 flex flex-col items-center justify-center p-6 select-none text-center bg-[#0B0C0E]"
      }
    >
      <div className="flex flex-col items-center max-w-sm mx-auto space-y-6">
        {/* Operator Profile Picture with Glossy Amber/Yellow Cyber Scanner Ring */}
        <div className="relative group">
          <div className="absolute -inset-1.5 rounded-2xl bg-gradient-to-r from-[#F5C518]/30 via-[#FFD84D]/40 to-[#F5C518]/30 blur-md opacity-80 animate-pulse motion-reduce:animate-none" />
          <div className="relative h-24 w-24 rounded-2xl border-2 border-[#F5C518]/50 bg-[#111318] shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.15)] flex items-center justify-center overflow-hidden">
            {!profileImgError ? (
              <Image
                src="/profile.png"
                alt="Lazy Nerds FixOps Operator Profile"
                width={96}
                height={96}
                priority
                onError={() => setProfileImgError(true)}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-[#1B1E24] text-[#FFD84D] font-mono text-xl font-bold">
                LN
              </div>
            )}
          </div>
        </div>

        {/* Branding Wordmark & Operational Status */}
        <div className="space-y-2">
          <div className="h-6 w-36 relative mx-auto opacity-95">
            <Image
              src="/title-sm.png"
              alt="Lazy Nerds"
              fill
              sizes="144px"
              priority
              className="object-contain"
            />
          </div>
          <h2 className="text-xs font-mono font-bold tracking-widest text-zinc-100 uppercase">
            {label}
          </h2>
          <p className="text-[11px] font-mono text-zinc-400 max-w-xs leading-relaxed">
            {subtext}
          </p>
        </div>

        {/* Technical Cyber Scan Progress Track */}
        <div className="w-48 h-1 rounded-full bg-[#16181F] overflow-hidden relative border border-[#262A32] shadow-inner">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-[#F5C518] to-transparent w-24 animate-[slide_1.5s_infinite_linear] motion-reduce:animate-none" />
        </div>

        {/* Deadlock / Delay Recovery State */}
        {isDelayed && (
          <div className="pt-2 space-y-3 animate-in fade-in duration-300">
            <p className="text-[11px] text-zinc-400 font-mono max-w-xs leading-relaxed">
              Initialization is taking longer than expected. The serverless instance may be waking from idle.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={handleManualReload}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono transition-colors border border-zinc-700"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Retry Connection</span>
              </button>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#F5C518]/20 hover:bg-[#F5C518]/30 text-[#FFD84D] text-xs font-mono transition-colors border border-[#F5C518]/40"
              >
                <LogIn className="h-3 w-3" />
                <span>Go to Sign In</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Inline section / card loading state for tabbed interfaces and panels.
 */
export const FixOpsInlineLoader: React.FC<{ label?: string }> = ({
  label = "Loading workspace telemetry…",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400"
    >
      <div className="relative h-10 w-10 rounded-lg border border-[#F5C518]/30 bg-[#111318] flex items-center justify-center shadow-xs overflow-hidden">
        <Image
          src="/brand/logo-icon.png"
          alt="FixOps"
          width={40}
          height={40}
          className="object-cover w-full h-full"
        />
        <div className="absolute -inset-0.5 rounded-lg border border-[#F5C518]/40 animate-ping opacity-25 motion-reduce:animate-none" />
      </div>
      <span className="text-xs font-mono text-zinc-400">{label}</span>
    </div>
  );
};

/**
 * Reusable table skeleton to eliminate visual layout shifts during data queries.
 */
export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 5,
}) => {
  return (
    <div className="w-full divide-y divide-zinc-200 dark:divide-zinc-800 animate-pulse motion-reduce:animate-none rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden bg-white dark:bg-[#111318]">
      {/* Skeleton Header */}
      <div className="bg-zinc-50 dark:bg-zinc-950/60 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className={`h-3 bg-zinc-200 dark:bg-zinc-800 rounded ${
              i === 0 ? "w-1/4" : "w-1/6"
            }`}
          />
        ))}
      </div>
      {/* Skeleton Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3.5 flex gap-4 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className={`h-3.5 bg-zinc-100 dark:bg-zinc-800/60 rounded ${
                c === 0 ? "w-1/4" : c === 1 ? "w-1/5" : "w-1/6"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Reusable card grid skeleton for Card View layouts.
 */
export const CardGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse motion-reduce:animate-none">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111318] space-y-3 shadow-xs"
        >
          <div className="flex justify-between items-center">
            <div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
            <div className="h-4 w-16 bg-zinc-100 dark:bg-zinc-800/80 rounded" />
          </div>
          <div className="space-y-1.5 pt-2">
            <div className="h-3 w-3/4 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
            <div className="h-3 w-1/2 bg-zinc-100 dark:bg-zinc-800/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Reusable empty state component with brand aesthetic.
 */
export const EmptyState: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ icon: Icon, title, description, actionLabel, onAction }) => {
  return (
    <div className="py-16 text-center space-y-3 px-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-[#111318]/50">
      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-[#1B1E24] border border-[#F5C518]/20 flex items-center justify-center mx-auto text-[#FFD84D]">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 font-mono">
          {title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-2">
          <Button size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};

/**
 * Reusable error and recovery state with retry capability.
 */
export const ErrorState: React.FC<{
  message: string;
  onRetry?: () => void;
}> = ({ message, onRetry }) => {
  return (
    <div className="py-16 text-center space-y-3 px-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
      <ShieldAlert className="h-7 w-7 text-rose-500 mx-auto" />
      <p className="text-xs text-rose-500 font-medium max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Request</span>
        </Button>
      )}
    </div>
  );
};
