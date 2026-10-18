"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextValue {
  toast: {
    success: (message: string, title?: string) => void;
    error: (message: string, title?: string) => void;
    info: (message: string, title?: string) => void;
    warning: (message: string, title?: string) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastType, message: string, title?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: ToastItem = { id, type, title, message };

      setToasts((prev) => [...prev.slice(-4), newToast]); // keep max 5 toasts

      // Auto dismiss after 4.5s
      setTimeout(() => {
        removeToast(id);
      }, 4500);
    },
    [removeToast]
  );

  const toastMethods = {
    success: (message: string, title?: string) => addToast("success", message, title),
    error: (message: string, title?: string) => addToast("error", message, title),
    info: (message: string, title?: string) => addToast("info", message, title),
    warning: (message: string, title?: string) => addToast("warning", message, title),
  };

  return (
    <ToastContext.Provider value={{ toast: toastMethods }}>
      {children}

      {/* Floating Toast Container */}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2",
              t.type === "success" &&
                "bg-zinc-900/95 border-emerald-500/30 text-zinc-100 dark:bg-zinc-950/95",
              t.type === "error" &&
                "bg-zinc-900/95 border-rose-500/30 text-zinc-100 dark:bg-zinc-950/95",
              t.type === "warning" &&
                "bg-zinc-900/95 border-amber-500/30 text-zinc-100 dark:bg-zinc-950/95",
              t.type === "info" &&
                "bg-zinc-900/95 border-blue-500/30 text-zinc-100 dark:bg-zinc-950/95"
            )}
          >
            <div className="shrink-0 mt-0.5">
              {t.type === "success" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
              {t.type === "error" && <AlertCircle className="h-4 w-4 text-rose-400" />}
              {t.type === "warning" && <AlertTriangle className="h-4 w-4 text-amber-400" />}
              {t.type === "info" && <Info className="h-4 w-4 text-blue-400" />}
            </div>

            <div className="flex-1 min-w-0 space-y-0.5">
              {t.title && (
                <p className="text-xs font-semibold tracking-tight text-zinc-100 font-mono">
                  {t.title}
                </p>
              )}
              <p className="text-xs text-zinc-300 leading-relaxed break-words">{t.message}</p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

const noop = () => {};
const fallbackToastContext: ToastContextValue = {
  toast: {
    success: noop,
    error: noop,
    info: noop,
    warning: noop,
  },
};

export function useToast() {
  const context = useContext(ToastContext);
  return context || fallbackToastContext;
}
