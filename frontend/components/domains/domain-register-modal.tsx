"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/api";
import { DomainCreateResponse } from "@/types/domain";
import {
  Globe,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Info,
} from "lucide-react";

interface DomainRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDomainRegistered: (response: DomainCreateResponse) => void;
  clientId?: string;
}

export const DomainRegisterModal: React.FC<DomainRegisterModalProps> = ({
  isOpen,
  onClose,
  onDomainRegistered,
  clientId,
}) => {
  const { toast } = useToast();
  const [domainInput, setDomainInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdResult, setCreatedResult] = useState<DomainCreateResponse | null>(null);

  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  const resetState = () => {
    setDomainInput("");
    setError(null);
    setLoading(false);
    setCreatedResult(null);
    setCopiedHost(false);
    setCopiedValue(false);
    setCopiedFull(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validateInput = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return "Domain name is required.";
    if (trimmed.includes("://") || trimmed.startsWith("http:") || trimmed.startsWith("https:")) {
      return "Do not include http:// or https:// schemes. Enter only the domain name (e.g. example.com).";
    }
    if (trimmed.includes("/") || trimmed.includes("?") || trimmed.includes("#")) {
      return "Paths and query parameters are not allowed.";
    }
    if (trimmed.includes(":")) {
      return "Port numbers are not allowed.";
    }
    if (trimmed.includes("@")) {
      return "Email addresses are not allowed.";
    }
    if (!trimmed.includes(".")) {
      return "Domain must include at least a domain name and a top-level domain (e.g. example.com).";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateInput(domainInput);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await api.createDomain({
        domain: domainInput.trim(),
        client_id: clientId,
      });
      setCreatedResult(res);
      onDomainRegistered(res);
      toast.success(
        `DNS TXT challenge generated for ${res.domain.normalized_domain}.`,
        "Domain Challenge Created"
      );
    } catch (err: any) {
      const msg = err.data?.detail || err.message || "Failed to register domain.";
      setError(msg);
      toast.error(msg, "Registration Failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, type: "host" | "value" | "full") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "host") {
        setCopiedHost(true);
        setTimeout(() => setCopiedHost(false), 2000);
      } else if (type === "value") {
        setCopiedValue(true);
        setTimeout(() => setCopiedValue(false), 2000);
      } else {
        setCopiedFull(true);
        setTimeout(() => setCopiedFull(false), 2000);
      }
      toast.success("DNS record parameter copied.", "Copied to Clipboard");
    } catch {
      toast.error("Please manually copy the text.", "Copy Failed");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={createdResult ? "DNS TXT Configuration Instructions" : "Register Domain for Verification"}
      description={
        createdResult
          ? `Add the following TXT record to your DNS provider for ${createdResult.domain.normalized_domain}.`
          : "Prove administrative control of your domain by generating a unique DNS TXT ownership challenge."
      }
      maxWidth="lg"
    >
      {!createdResult ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/70 mb-1.5">
              Domain Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Input
                type="text"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. acme-corp.com or api.acme-corp.com"
                className="pl-9 font-mono text-sm bg-white/[0.03] border-white/10 text-white placeholder-white/30 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/40"
                disabled={loading}
                autoFocus
              />
              <Globe className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                <span>✕</span> {error}
              </p>
            )}
            <p className="text-[11px] text-white/40 mt-2">
              Enter the exact fully qualified domain or subdomain. Do not include <code className="text-white/60">https://</code> or path suffixes.
            </p>
          </div>

          <div className="p-3.5 rounded-lg border border-cyan-500/20 bg-cyan-950/15 text-[12px] text-cyan-200/80 space-y-1">
            <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Method A: DNS TXT Verification
            </div>
            <p>
              A high-entropy token will be generated. You will be asked to create a DNS TXT record at{" "}
              <code className="text-cyan-100 font-mono">_lazynerds-verification.&lt;domain&gt;</code> to prove domain control.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="border-white/15 text-white/80 hover:bg-white/[0.06]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !domainInput.trim()}
              className="bg-white text-slate-900 hover:bg-slate-200 font-semibold px-4"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating Challenge...
                </>
              ) : (
                <>
                  Generate Verification Challenge
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-950/20 text-xs text-emerald-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Challenge generated successfully. Add this DNS record to your DNS provider.</span>
          </div>

          {/* DNS Record Table Display */}
          <div className="rounded-lg border border-white/10 bg-[#07090e] p-4 space-y-3.5">
            {/* Record Type */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs">
              <span className="text-white/50 font-medium">Record Type</span>
              <div className="md:col-span-2 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-white/[0.08] text-white font-mono font-semibold">
                  {createdResult.dns_instructions.record_type}
                </span>
                <span className="text-white/40 text-[11px]">(Text Record)</span>
              </div>
            </div>

            {/* Record Host / Name */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-white/50 font-medium">Host / Name</span>
              <div className="md:col-span-2 flex items-center gap-2">
                <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-white/10 font-mono text-cyan-300 break-all select-all">
                  {createdResult.dns_instructions.record_host}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdResult.dns_instructions.record_host, "host")}
                  className="shrink-0 h-8 px-2.5 border-white/15 text-white/80 hover:bg-white/[0.08]"
                  title="Copy host name"
                >
                  {copiedHost ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="ml-1 text-[11px]">{copiedHost ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* Full Name for DNS that requires FQDN */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-white/50 font-medium">Full Name (FQDN)</span>
              <div className="md:col-span-2 flex items-center gap-2">
                <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-white/10 font-mono text-white/90 break-all select-all">
                  {createdResult.dns_instructions.record_name}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(createdResult.dns_instructions.record_name, "full")}
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
              <div className="md:col-span-2 flex items-center gap-2">
                <code className="flex-1 px-3 py-1.5 rounded bg-black/60 border border-cyan-500/30 font-mono text-cyan-200 break-all select-all font-semibold">
                  {createdResult.dns_instructions.record_value}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    copyToClipboard(createdResult.dns_instructions.record_value || "", "value")
                  }
                  className="shrink-0 h-8 px-2.5 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10"
                  title="Copy record value"
                >
                  {copiedValue ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="ml-1 text-[11px]">{copiedValue ? "Copied" : "Copy"}</span>
                </Button>
              </div>
            </div>

            {/* TTL */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center text-xs pt-2 border-t border-white/[0.06]">
              <span className="text-white/50 font-medium">TTL</span>
              <div className="md:col-span-2">
                <span className="text-white/70 font-mono text-xs">
                  {createdResult.dns_instructions.ttl} seconds (or DNS provider default / Auto)
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-white/40 leading-relaxed">
            Note: This verification challenge expires in 24 hours. DNS changes can take up to a few minutes to propagate across public nameservers.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/[0.08]">
            <Button
              type="button"
              onClick={handleClose}
              className="bg-white text-slate-900 hover:bg-slate-200 font-semibold px-5"
            >
              I&apos;ve Added the Record
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
