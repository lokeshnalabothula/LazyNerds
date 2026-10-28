"use client";

import React, { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("FixOps Global App Error:", error);
    const isChunkFailure =
      error.message?.includes("Loading chunk") ||
      error.message?.includes("ChunkLoadError") ||
      error.name === "ChunkLoadError";

    if (isChunkFailure && typeof window !== "undefined") {
      const storageKey = "fixops_global_chunk_reload";
      const lastReload = sessionStorage.getItem(storageKey);
      if (!lastReload || Date.now() - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(storageKey, Date.now().toString());
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#030407] text-[#e2e8f0] flex flex-col items-center justify-center p-6 font-sans">
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
            <h2 className="text-xl font-medium tracking-tight text-white">Application Synchronization</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              A bundle update occurred. Please reload to load the latest application assets.
            </p>
          </div>

          <button
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.reload();
              } else {
                reset();
              }
            }}
            className="w-full px-5 py-2.5 rounded-full bg-white text-slate-900 font-medium text-xs tracking-wider uppercase hover:bg-slate-200 transition-all cursor-pointer shadow-lg"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}
