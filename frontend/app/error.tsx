"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log unexpected errors for telemetry
    console.error("FixOps Runtime Application Error:", error);

    // If this is a chunk load failure from a new deployment, auto-reload once to refresh bundles
    const isChunkFailure =
      error.message?.includes("Loading chunk") ||
      error.message?.includes("ChunkLoadError") ||
      error.name === "ChunkLoadError";

    if (isChunkFailure && typeof window !== "undefined") {
      const storageKey = "fixops_chunk_reload";
      const lastReload = sessionStorage.getItem(storageKey);
      if (!lastReload || Date.now() - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(storageKey, Date.now().toString());
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-[#030407] text-[#e2e8f0] flex flex-col items-center justify-center p-6 selection:bg-[#7bd0ff]/20">
      <div className="w-full max-w-md p-8 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl shadow-2xl text-center space-y-6">
        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/15 mx-auto flex items-center justify-center text-white/80">
          <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-medium tracking-tight text-white">System Calibration Notice</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            The application encountered a transient client update state. Refreshing your session will resolve any pending bundle mismatches.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="flex-1 px-4 py-2.5 rounded-full bg-white text-slate-900 font-medium text-xs tracking-wider uppercase hover:bg-slate-200 transition-all cursor-pointer shadow-lg"
          >
            Refresh Interface
          </button>
          <Link
            href="/"
            className="flex-1 px-4 py-2.5 rounded-full border border-white/20 bg-white/[0.04] text-white/80 font-medium text-xs tracking-wider uppercase hover:bg-white/[0.08] hover:text-white transition-all text-center flex items-center justify-center"
          >
            Return Home
          </Link>
        </div>

        {error?.digest && (
          <p className="text-[10px] font-mono text-white/30 pt-1">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
