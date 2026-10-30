"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { Domain, DomainRegenerateResponse, DomainVerificationResult } from "@/types/domain";
import {
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";

interface DomainDnsInstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  domain: Domain | null;
  activeToken?: string | null;
  onVerified?: (result: DomainVerificationResult) => void;
  onRegenerated?: (response: DomainRegenerateResponse) => void;
}

export const DomainDnsInstructionsModal: React.FC<DomainDnsInstructionsModalProps> = ({
  isOpen,
  onClose,
  domain,
  activeToken,
  onVerified,
  onRegenerated,
}) => {
  const { toast } = useToast();
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  if (!domain) return null;

  const currentToken = tokenOverride || activeToken || null;
  const recordHost = "_lazynerds-verification";
  const recordFqdn = `_lazynerds-verification.${domain.normalized_domain}`;
  const recordValue = currentToken ? `lazynerds-verification=${currentToken}` : null;

  const copyToClipboard = async (text: string, type: "host" | "full" | "value") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "host") {
        setCopiedHost(true);
        setTimeout(() => setCopiedHost(false), 2000);
      } else if (type === "full") {
        setCopiedFull(true);
        setTimeout(() => setCopiedFull(false), 2000);
      } else {
        setCopiedValue(true);
        setTimeout(() => setCopiedValue(false), 2000);
      }
      toast.success("DNS record entry copied.", "Copied to Clipboard");
    } catch {
      toast.error("Please manually copy the text.", "Copy Failed");
    }
  };

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      setVerificationError(null);
      const result = await api.verifyDomain(domain.id);
      if (result.verified && result.domain.verification_status === "verified") {
        toast.success(
          `Ownership of ${domain.normalized_domain} has been cryptographically confirmed.`,
          "Domain Verified Successfully"
        );
        if (onVerified) onVerified(result);
        onClose();
      } else {
        const errorDetail = result.message || result.domain.failure_reason || "Verification failed. DNS TXT record not found or mismatched.";
        setVerificationError(errorDetail);
        toast.error(errorDetail, "Verification Not Complete");
        if (onVerified) onVerified(result);
      }
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "DNS verification check failed.";
      setVerificationError(msg);
      toast.error(msg, "Verification Error");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsRegenerating(true);
      setVerificationError(null);
      const res = await api.regenerateDomainChallenge(domain.id);
      setTokenOverride(res.token);
      toast.success(
        "A new verification token has been created with a fresh 24-hour expiration window.",
        "Challenge Regenerated"
      );
      if (onRegenerated) onRegenerated(res);
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "Failed to regenerate verification challenge.";
      toast.error(msg, "Regeneration Failed");
    } finally {
      setIsRegenerating(false);
    }
  };

  const isExpired = domain.challenge_expires_at
    ? new Date(domain.challenge_expires_at).getTime() < Date.now()
    : false;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`DNS TXT Setup: ${domain.normalized_domain}`}
      description="Configure your DNS provider with the following TXT record to prove domain ownership."
      maxWidth="lg"
    >
      <div className="space-y-4">
        {domain.verification_status === "verified" && (
          <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>This domain has been successfully verified. No further DNS action is required.</span>
          </div>
        )}

        {isExpired && domain.verification_status !== "verified" && (
          <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-950/20 text-xs text-amber-300 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>This challenge expired. Generate a new token to continue.</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs h-7 px-2.5"
            >
              {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Regenerate
            </Button>
          </div>
        )}

        {verificationError && (
          <div className="p-3 rounded-lg border border-rose-500/20 bg-rose-950/20 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold">DNS Check Failed</span>
              <p className="text-[11px] text-rose-200/80">{verificationError}</p>
            </div>
          </div>
        )}

        {/* DNS Record Specs Table */}
        <div className="rounded-lg border border-white/10 bg-[#07090e] p-4 space-y-3.5">
          {/* Record Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs">
            <span className="text-white/50 font-medium">Record Type</span>
            <div className="md:col-span-2 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-white/[0.08] text-white font-mono font-semibold">
                TXT
              </span>
              <span className="text-white/40 text-[11px]">(Text Record)</span>
            </div>
          </div>

          {/* Record Host / Subdomain */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
            <span className="text-white/50 font-medium">Host / Name</span>
            <div className="md:col-span-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-white/10 font-mono text-cyan-300 break-all select-all">
                {recordHost}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(recordHost, "host")}
                className="shrink-0 h-8 px-2.5 border-white/15 text-white/80 hover:bg-white/[0.08]"
                title="Copy host name"
              >
                {copiedHost ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1 text-[11px]">{copiedHost ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          {/* Fully Qualified Domain Name (FQDN) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
            <span className="text-white/50 font-medium">Full Name (FQDN)</span>
            <div className="md:col-span-2 flex items-center gap-2">
              <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-white/10 font-mono text-white/90 break-all select-all">
                {recordFqdn}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyToClipboard(recordFqdn, "full")}
                className="shrink-0 h-8 px-2.5 border-white/15 text-white/80 hover:bg-white/[0.08]"
                title="Copy full record name"
              >
                {copiedFull ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="ml-1 text-[11px]">{copiedFull ? "Copied" : "Copy"}</span>
              </Button>
            </div>
          </div>

          {/* Record Value */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
            <span className="text-white/50 font-medium">Value / Content</span>
            <div className="md:col-span-2">
              {recordValue ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-cyan-500/30 font-mono text-cyan-200 break-all select-all font-semibold">
                    {recordValue}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(recordValue, "value")}
                    className="shrink-0 h-8 px-2.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                    title="Copy record value"
                  >
                    {copiedValue ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="ml-1 text-[11px]">{copiedValue ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between p-2.5 rounded bg-black/40 border border-white/10">
                  <span className="font-mono text-white/50 text-[11px]">
                    lazynerds-verification=&lt;token&gt;
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleRegenerate}
                    disabled={isRegenerating}
                    className="text-xs h-7 px-2.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                  >
                    {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                    Reveal Fresh Token
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* TTL */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
            <span className="text-white/50 font-medium">TTL</span>
            <div className="md:col-span-2">
              <span className="text-white/70 font-mono text-xs">
                300 seconds (or DNS provider default / Auto)
              </span>
            </div>
          </div>
        </div>

        {/* Info tips */}
        <div className="p-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-[11px] text-white/60 space-y-1.5">
          <div className="font-medium text-white/80 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> DNS Propagation Notice
          </div>
          <p>
            Most DNS providers (Cloudflare, Route 53, Google Cloud DNS) propagate TXT records within 1–2 minutes, but some registrars may take up to 15–30 minutes. If verification fails initially, please wait a moment and retry.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.08]">
          <Button
            type="button"
            variant="outline"
            onClick={handleRegenerate}
            disabled={isRegenerating || isVerifying}
            className="w-full sm:w-auto border-white/15 text-white/80 hover:bg-white/[0.06] text-xs"
          >
            {isRegenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Regenerate Token
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isVerifying}
              className="border-white/15 text-white/80 hover:bg-white/[0.06]"
            >
              Close
            </Button>
            {domain.verification_status !== "verified" && (
              <Button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying || isExpired}
                className="bg-white text-slate-900 hover:bg-slate-200 font-semibold px-4"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Querying DNS...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-1.5" />
                    Verify Domain Now
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
