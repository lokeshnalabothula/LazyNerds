"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Client } from "@/types/client";
import { AlertTriangle } from "lucide-react";

interface ArchiveDialogProps {
  isOpen: boolean;
  client: Client | null;
  onClose: () => void;
  onConfirm: (client: Client) => Promise<void>;
}

export const ArchiveDialog: React.FC<ArchiveDialogProps> = ({
  isOpen,
  client,
  onClose,
  onConfirm,
}) => {
  const [isArchiving, setIsArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!client) return null;

  const handleConfirm = async () => {
    setIsArchiving(true);
    setError(null);
    try {
      await onConfirm(client);
      onClose();
    } catch (err: any) {
      setError(err.message || "Could not archive client. Please try again.");
    } finally {
      setIsArchiving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Archive Client Record"
      maxWidth="sm"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isArchiving}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            isLoading={isArchiving}
          >
            Archive Client
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-semibold block">Archive confirmation</span>
            <p>
              Are you sure you want to archive{" "}
              <strong className="text-zinc-900 dark:text-zinc-100 font-mono">
                {client.company_name}
              </strong>
              ?
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Archiving excludes this organization from active directory queries. All historical data, primary contact records, and future scope links will remain intact in PostgreSQL. You can restore this client at any time from the Archived filter.
        </p>

        {error && (
          <p className="text-xs font-medium text-rose-500 bg-rose-500/10 p-2 rounded border border-rose-500/20">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
};
