"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertCircle, Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "primary" | "warning";
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm Action",
  cancelLabel = "Cancel",
  variant = "primary",
  loading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={loading ? () => {} : onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {variant === "destructive" && (
              <div className="h-8 w-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center">
                <AlertCircle className="h-4 w-4" />
              </div>
            )}
            {variant === "warning" && (
              <div className="h-8 w-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4" />
              </div>
            )}
            {variant === "primary" && (
              <div className="h-8 w-8 rounded-lg bg-[#F5C518]/15 border border-[#F5C518]/30 text-[#DDAA07] dark:text-[#FFD84D] flex items-center justify-center">
                <Info className="h-4 w-4" />
              </div>
            )}
          </div>
          <p className="text-xs text-zinc-600 dark:text-[#9CA3AF] leading-relaxed pt-1">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-[#222630]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "danger" : "primary"}
            size="sm"
            onClick={onConfirm}
            disabled={loading}
            className="text-xs"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
            <span>{confirmLabel}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
