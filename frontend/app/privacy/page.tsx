import React from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, FileText } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — Lazy Nerds FixOps",
  description: "Privacy policy and data handling disclosures for FixOps Client Manager.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation */}
        <div>
          <Link
            href="/clients"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to Workspace</span>
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-zinc-800 pb-6 space-y-2">
          <div className="flex items-center gap-2 text-brand-400 font-mono text-xs uppercase tracking-wider">
            <Shield className="h-4 w-4" />
            <span>Lazy Nerds FixOps Security & Governance</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-400 font-mono">
            Effective Date: October 14, 2026 | Version 1.0.0
          </p>
        </div>

        {/* Notice on Legal Review */}
        <div className="p-4 rounded-md border border-amber-500/20 bg-amber-500/10 text-xs text-amber-300 leading-relaxed font-mono">
          <strong>LEGAL NOTICE FOR DEPLOYMENT:</strong> Sections marked with brackets (e.g., [COMPANY LEGAL ENTITY], [REGISTERED JURISDICTION]) represent verified corporate parameters that must be reviewed and customized by Lazy Nerds legal counsel prior to public launch.
        </div>

        {/* Content Sections */}
        <div className="space-y-6 text-xs text-zinc-300 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">1. Overview and Scope</h2>
            <p>
              This Privacy Policy describes how [COMPANY LEGAL ENTITY: Lazy Nerds, LLC / Private Limited] (&quot;Lazy Nerds&quot;, &quot;we&quot;, &quot;us&quot;) collects, maintains, uses, and safeguards information processed through the <strong>FixOps Client Manager</strong> application. FixOps is an internal and operational client workspace designed exclusively for authorized cybersecurity consultants and designated client stakeholders.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">2. Information Collected</h2>
            <p>
              FixOps collects and processes only the minimum data required to establish and coordinate authorized cybersecurity engagements:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li><strong>Organization Details:</strong> Official company name, industry sector, website address, and engagement scope parameters.</li>
              <li><strong>Authorized Security Contact Information:</strong> Full name, professional corporate email address, and direct business telephone number.</li>
              <li><strong>Internal Engagement Notes:</strong> Confidential notes regarding authorization boundaries, point-of-contact preferences, and technical coordination requirements.</li>
              <li><strong>System Audit Records:</strong> Timestamps of client record creation, modification, archival status, and authenticated user IDs.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">3. Purpose and Legal Basis for Processing</h2>
            <p>
              We process client and contact data solely for legitimate business operations and performance of contracts, specifically:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li>Managing client relationships and maintaining authorized lines of security communication.</li>
              <li>Preparing Rules of Engagement (ROE) and verifying authorization prior to scheduled security projects.</li>
              <li>Maintaining immutable audit logs of administrative mutations in PostgreSQL.</li>
            </ul>
            <p className="text-zinc-400">
              We do not sell client data, license contact lists, or transmit corporate contact information to third-party advertising, analytics, or external AI providers.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">4. Access Controls and Security Measures</h2>
            <p>
              Information within FixOps is protected through defensive architectural controls:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-zinc-400">
              <li><strong>Authentication:</strong> Cryptographic password hashing utilizing modern bcrypt algorithms and time-bounded JSON Web Tokens (JWT).</li>
              <li><strong>Authorization:</strong> Strict server-side verification on all mutation and retrieval endpoints; no client records are accessible to unauthenticated visitors.</li>
              <li><strong>Input Sanitization:</strong> Strict Pydantic schema validation, parameterized database transactions via SQLAlchemy, and text-only rendering of user notes to prevent Cross-Site Scripting (XSS).</li>
              <li><strong>Encryption in Transit:</strong> Mandatory HTTPS/TLS encryption across all public network endpoints.</li>
            </ul>
            <p className="text-zinc-500 italic">
              While we implement rigorous modern engineering safeguards, no Internet-connected system can guarantee absolute cryptographic infallibility.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">5. Session Technologies and Cookies</h2>
            <p>
              FixOps utilizes a single first-party cookie named <code className="font-mono text-zinc-200">fixops_access_token</code>. This cookie is configured with <code className="font-mono text-zinc-200">HttpOnly</code>, <code className="font-mono text-zinc-200">SameSite=Lax</code>, and <code className="font-mono text-zinc-200">Secure</code> attributes. It is strictly functional and used solely to maintain authenticated staff sessions. We do not employ third-party tracking cookies or behavioral beacons.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">6. Hosting and Subprocessors</h2>
            <p>
              Data is persisted in dedicated relational databases hosted in restricted cloud environments (Neon Serverless PostgreSQL). Subprocessors are restricted to enterprise cloud infrastructure providers under strict confidentiality and security agreements.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">7. Data Retention, Archival, and Erasure</h2>
            <p>
              Client records remain active throughout the engagement lifecycle. When an authorized user archives a client, the record is excluded from active directory searches but preserved in PostgreSQL for compliance, contractual auditability, and historical scope defense. Permanent erasure requests may be directed to our privacy contact.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-zinc-100">8. Privacy Contact and Inquiries</h2>
            <p>
              For inquiries regarding personal contact information, record corrections, or erasure under applicable data protection laws, contact:
            </p>
            <div className="p-3 rounded bg-zinc-900 border border-zinc-800 font-mono text-[11px] text-zinc-300">
              <div>Privacy Operations: Data Protection & Security Team</div>
              <div>Email: privacy@lazynerds.com</div>
              <div>Entity: Lazy Nerds Cybersecurity Operations</div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 pt-6 flex items-center justify-between text-xs text-zinc-500">
          <span>Lazy Nerds FixOps Client Manager</span>
          <div className="flex items-center gap-3">
            <Link href="/terms" className="hover:text-zinc-300 hover:underline">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/overview" className="hover:text-zinc-300 hover:underline">
              Workspace Overview
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
