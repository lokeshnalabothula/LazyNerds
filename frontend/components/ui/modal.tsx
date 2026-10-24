"use client";

import React, { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const widthClasses = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity"
    >
      <div
        ref={modalRef}
        className={cn(
          "w-full rounded-xl border border-zinc-200 dark:border-[#222630] bg-white dark:bg-[#111318] shadow-2xl overflow-hidden transition-all flex flex-col max-h-[90vh]",
          widthClasses[maxWidth]
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-[#222630] px-4 sm:px-6 py-4 shrink-0">
          <div className="min-w-0 pr-2">
            <h2 id="modal-title" className="text-sm sm:text-base font-semibold text-zinc-900 dark:text-[#F9FAFB] truncate tracking-tight">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-zinc-500 dark:text-[#9CA3AF] mt-0.5 break-words">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-zinc-400 hover:text-zinc-700 dark:text-[#9CA3AF] dark:hover:text-[#F9FAFB] hover:bg-zinc-100 dark:hover:bg-[#161920] transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 overflow-y-auto flex-1 text-xs">
          {children}
        </div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-zinc-200 dark:border-[#222630] bg-zinc-50 dark:bg-[#161920]/80 px-4 sm:px-6 py-3.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
