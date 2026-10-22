import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Terms and Conditions — Lazy Nerds FixOps",
  description: "Terms and conditions of use for Lazy Nerds FixOps Client Manager.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <div>
          <Link
            href="/overview"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Workspace Dashboard</span>
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-zinc-800 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-brand-400 font-mono text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" />
            <span>Lazy Nerds FixOps Terms of Service</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Terms and Conditions
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Effective Date: October 14, 2026 | Version 1.0.0
          </p>
        </div>

        {/* Legal Notice */}
        <div className="p-4 rounded-md border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-400 leading-relaxed font-mono">
          <strong className="text-zinc-200">AUTHORIZED OPERATIONS NOTICE:</strong> This service agreement governs operational use of Lazy Nerds FixOps for cybersecurity assessment, vulnerability tracking, and client relationship management.
        </div>

        {/* Content */}
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">1. Acceptance of Terms</h2>
            <p>
              By accessing or utilizing the FixOps platform (&quot;Service&quot;), operated by Lazy Nerds (&quot;Lazy Nerds&quot;), you acknowledge and agree to be bound by these Terms and Conditions. Access is granted solely to authorized representatives of Lazy Nerds and designated client stakeholders.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">2. Description of the Service</h2>
            <p>
              The Service provides an operational workspace for managing cybersecurity client profiles, authorized corporate points of contact, engagement metadata, and preparatory scoping information.
            </p>
          </section>

          <section className="space-y-2 p-3.5 rounded border border-rose-500/20 bg-rose-500/5">
            <h2 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>3. Explicit Testing Authorization Boundary</span>
            </h2>
            <p className="text-zinc-300">
              <strong>CRITICAL CYBERSECURITY COVENANT:</strong> The inclusion or storage of an organization name, domain, URL, or IP address within the FixOps platform does <strong>NOT</strong> constitute legal consent, authorization, or authorization of engagement to perform penetration testing, vulnerability scanning, security probing, or intrusive security assessments.
            </p>
            <p className="text-zinc-400 mt-1">
              Active security testing requires a separate, mutually executed Master Services Agreement (MSA), a formal Statement of Work (SOW), and a signed Rules of Engagement (ROE) document with verified infrastructure ownership attestation.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">4. User Account Security and Confidentiality</h2>
            <p>
              Users are responsible for maintaining the confidentiality of their authentication credentials. Any unauthorized access or suspected credential compromise must be reported immediately to Lazy Nerds security personnel.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">5. Acceptable Use Policy</h2>
            <p>
              Users agree not to:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li>Attempt unauthorized access to organizations or client records outside their authorized tenancy.</li>
              <li>Inject malicious payloads, scripts, or automated exploits into client data fields.</li>
              <li>Circumvent or attempt to tamper with API authentication tokens, headers, or rate-limiting controls.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">6. Intellectual Property & Data Ownership</h2>
            <p>
              All proprietary code, user interfaces, branding, and system architectures of FixOps remain the exclusive intellectual property of Lazy Nerds. Client contact information and specific engagement scope documents remain the confidential property of the respective client organizations.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">7. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by applicable law, Lazy Nerds and its officers, employees, and consultants shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from the use of or inability to use the Service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">8. Governing Law and Jurisdiction</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable cybersecurity regulations and standard commercial laws, without regard to conflict of law principles.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">9. Contact Information</h2>
            <div className="p-3 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
              <div>Legal Department: Lazy Nerds Compliance & Counsel</div>
              <div>Inquiries: legal@lazynerds.com</div>
              <div>Entity: Lazy Nerds Cybersecurity Operations</div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-6 flex items-center justify-between text-xs text-zinc-500">
          <span>Lazy Nerds FixOps Client Manager</span>
          <div className="flex items-center gap-3">
            <Link href="/privacy" className="hover:text-zinc-300 hover:underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/overview" className="hover:text-zinc-300 hover:underline">
              Workspace Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
