import React from "react";
import Image from "next/image";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface AppLoaderProps {
  label?: string;
  subtext?: string;
  fullScreen?: boolean;
}

/**
 * Flagship Lazy Nerds FixOps Startup and Session Verification Loader.
 * Features the official nerd mascot emblem, electric-lime cyber scanner,
 * and dark charcoal technical aesthetic.
 */
export const FixOpsAppLoader: React.FC<AppLoaderProps> = ({
  label = "INITIALIZING FIXOPS",
  subtext = "Securing operational perimeters…",
  fullScreen = true,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`${
        fullScreen ? "fixed inset-0 min-h-screen" : "w-full py-16"
      } bg-zinc-950 flex flex-col items-center justify-center p-6 z-50 select-none text-center`}
    >
      <div className="flex flex-col items-center max-w-sm mx-auto space-y-6">
        {/* Official Brand Mascot with Electric-Lime Cyber Ring */}
        <div className="relative group">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-brand-500/20 via-brand-400/30 to-brand-500/20 blur-md opacity-75 animate-pulse" />
          <div className="relative h-20 w-20 rounded-2xl border border-brand-500/40 bg-zinc-900/90 p-2 shadow-2xl flex items-center justify-center overflow-hidden">
            <Image
              src="/brand/logo.png"
              alt="Lazy Nerds FixOps"
              width={72}
              height={72}
              priority
              className="object-contain rounded-xl"
            />
          </div>
        </div>

        {/* Branding & Status Info */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-mono font-bold tracking-widest text-zinc-100 uppercase">
            {label}
          </h2>
          <p className="text-[11px] font-mono text-zinc-400">
            {subtext}
          </p>
        </div>

        {/* Technical Electric-Lime Scan Progress Track */}
        <div className="w-44 h-1 rounded-full bg-zinc-900 overflow-hidden relative border border-zinc-800">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-brand-400 to-transparent w-20 animate-[slide_1.5s_infinite_linear]" />
        </div>
      </div>
    </div>
  );
};

/**
 * Inline section / card loading state for tabbed interfaces and panels.
 */
export const FixOpsInlineLoader: React.FC<{ label?: string }> = ({
  label = "Loading workspace data…",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-400"
    >
      <div className="relative h-10 w-10 rounded-lg border border-zinc-800 bg-zinc-900/80 p-1 flex items-center justify-center shadow-xs">
        <Image
          src="/brand/logo-icon.png"
          alt="FixOps"
          width={32}
          height={32}
          className="object-contain rounded"
        />
        <div className="absolute -inset-0.5 rounded-lg border border-brand-500/40 animate-ping opacity-25" />
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
    <div className="w-full divide-y divide-zinc-200 dark:divide-zinc-800 animate-pulse">
      {/* Skeleton Header */}
      <div className="bg-zinc-50 dark:bg-zinc-950/50 px-4 py-3 flex gap-4">
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 space-y-3"
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
    <div className="py-16 text-center space-y-3 px-4">
      <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
        <Icon className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <div className="pt-1">
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
    <div className="py-16 text-center space-y-3 px-4">
      <AlertCircle className="h-7 w-7 text-rose-500 mx-auto" />
      <p className="text-xs text-rose-500 font-medium max-w-md mx-auto">
        {message}
      </p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Request</span>
        </Button>
      )}
    </div>
  );
};
