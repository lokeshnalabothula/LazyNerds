import React from "react";
import { ShieldAlert, Construction, FileText, Layers, Bug, Lock } from "lucide-react";

interface FutureModulePlaceholderProps {
  moduleName: "engagements" | "assets" | "findings" | "reports";
  companyName?: string;
}

interface ModuleConfig {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  notice?: string;
  warning?: string;
}

export const FutureModulePlaceholder: React.FC<FutureModulePlaceholderProps> = ({
  moduleName,
  companyName = "this client",
}) => {
  const configs: Record<FutureModulePlaceholderProps["moduleName"], ModuleConfig> = {
    engagements: {
      icon: Layers,
      title: "Security Engagements (Planned Module)",
      description:
        "Formal cybersecurity engagements, authorized testing windows, rules of engagement (ROE), and consultant staffing will be managed here once the Engagement module is released.",
      notice:
        "No active or scheduled security projects are assigned to this organization.",
    },
    assets: {
      icon: ShieldAlert,
      title: "Authorized Assets & Target Scope (Planned Module)",
      description:
        "Asset inventory, authorized domain perimeters, API endpoints, and cloud infrastructure mapping will be defined in this section with verifiable ownership proof.",
      warning:
        "LEGAL NOTICE: Adding an organization or domain to the FixOps Client Manager does NOT constitute legal authorization or scope permission to conduct penetration tests, vulnerability scans, or active assessments against its infrastructure.",
    },
    findings: {
      icon: Bug,
      title: "Vulnerability Findings & Remediation (Planned Module)",
      description:
        "Validated security findings, severity ratings (CVSS), technical reproduction steps, remediation workflows, and re-test verification records will be tracked here.",
      notice:
        "No vulnerability finding records exist for this organization.",
    },
    reports: {
      icon: FileText,
      title: "Executive Reports & Audit Evidence (Planned Module)",
      description:
        "Cryptographically signed pentest deliverable reports, executive summaries, letter of attestation certificates, and raw artifact evidence will be archived here.",
      notice:
        "Downloadable reports and evidence archives are unavailable in this release.",
    },
  };

  const current = configs[moduleName];
  const IconComponent = current.icon;

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-8 text-center max-w-2xl mx-auto space-y-4 my-6">
      <div className="mx-auto w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400">
        <IconComponent className="h-6 w-6" />
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {current.title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-lg mx-auto">
          {current.description}
        </p>
      </div>

      {current.warning && (
        <div className="p-3.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-left text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
          <Lock className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="leading-relaxed font-mono text-[11px]">{current.warning}</p>
        </div>
      )}

      {current.notice && (
        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
          {current.notice}
        </div>
      )}
    </div>
  );
};
