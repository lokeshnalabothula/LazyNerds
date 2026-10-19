"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  Building2,
  UserCheck,
  Server,
  ArrowRight,
  ArrowLeft,
  Search,
} from "lucide-react";

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters").max(255),
  email: z.string().email("Please provide a valid corporate email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[a-z]/, "Must contain at least one lowercase letter")
    .regex(/[0-9]/, "Must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Must contain at least one special character"),
  phone: z.string().max(50).optional().or(z.literal("")),
  job_title: z.string().max(100).optional().or(z.literal("")),
  company_name: z.string().min(2, "Company name must be at least 2 characters").max(255),
  website: z.string().max(500).optional().or(z.literal("")),
  industry: z.string().max(100).optional().or(z.literal("")),
  company_size: z.string().max(50).optional().or(z.literal("")),
  country: z.string().max(100).optional().or(z.literal("")),
  primary_domains: z.string().max(2000).optional().or(z.literal("")),
  requested_services: z.string().max(2000).optional().or(z.literal("")),
  scope_description: z.string().max(4000).optional().or(z.literal("")),
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successData, setSuccessData] = useState<{
    company_name: string;
    email: string;
    registration_id: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: "",
      email: "",
      password: "",
      phone: "",
      job_title: "",
      company_name: "",
      website: "",
      industry: "Technology / SaaS",
      company_size: "10-50",
      country: "India",
      primary_domains: "",
      requested_services: "Automated FixOps & Vulnerability Management",
      scope_description: "",
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);
    setIsSubmitting(true);
    try {
      const res = await api.registerClient({
        full_name: data.full_name,
        email: data.email,
        password: data.password,
        company_name: data.company_name,
        phone: data.phone || null,
        job_title: data.job_title || null,
        website: data.website || null,
        industry: data.industry || null,
        company_size: data.company_size || null,
        country: data.country || null,
        primary_domains: data.primary_domains || null,
        requested_services: data.requested_services || null,
        scope_description: data.scope_description || null,
      });

      setSuccessData({
        company_name: res.company_name,
        email: data.email,
        registration_id: res.registration_id,
      });
    } catch (err: any) {
      setServerError(
        err.message || "Failed to submit client registration. Please verify your inputs."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 py-10 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="relative mx-auto w-24 h-24 rounded-2xl border border-zinc-800 bg-[#111318] shadow-2xl flex items-center justify-center overflow-hidden transition-transform hover:scale-105 duration-200 ring-2 ring-[#F5C518]/30">
            <Image
              src="/profile-sm.png"
              alt="Lazy Nerds FixOps Mascot"
              width={96}
              height={96}
              priority
              className="object-cover w-full h-full"
            />
          </div>
          <div className="space-y-1.5 flex flex-col items-center">
            <div className="flex items-center justify-center gap-2">
              <div className="h-9 w-48 relative">
                <Image
                  src="/title-sm.png"
                  alt="Lazy Nerds"
                  fill
                  sizes="192px"
                  priority
                  className="object-contain"
                />
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#F5C518]/15 text-[#B88700] dark:text-[#FFD84D] border border-[#F5C518]/30 tracking-wider shrink-0">
                ONBOARDING
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md mx-auto">
              Register your organization to access our automated cybersecurity operations, vulnerability management, and remediation pipeline.
            </p>
          </div>
        </div>

        {/* Success Card */}
        {successData ? (
          <div className="rounded-md border border-emerald-500/30 bg-zinc-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-sm space-y-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-zinc-100">
                Application Submitted Successfully
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300">
                Thank you for applying. We have registered{" "}
                <span className="font-semibold text-brand-400 font-mono">
                  {successData.company_name}
                </span>{" "}
                in our onboarding queue.
              </p>
            </div>

            <div className="p-4 rounded bg-zinc-950/80 border border-zinc-800 text-left text-xs text-zinc-400 space-y-2 font-mono">
              <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
                <span className="text-zinc-500">Contact Email:</span>
                <span className="text-zinc-200">{successData.email}</span>
              </div>
              <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2">
                <span className="text-zinc-500">Application Status:</span>
                <span className="text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px]">
                  Pending Founder Review
                </span>
              </div>
              <p className="text-[11px] text-zinc-500 pt-1">
                For security reasons, access is quarantined until validated by Lazy Nerds leadership. Once verified, you will be able to log in immediately with your chosen credentials.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                href={`/register/status?email=${encodeURIComponent(successData.email)}`}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded text-xs font-semibold bg-brand-500 text-zinc-950 hover:bg-brand-400 transition-colors"
              >
                <Search className="h-4 w-4" />
                <span>Track Application Status</span>
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form Card */
          <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8 shadow-2xl backdrop-blur-sm">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {serverError && (
                <div className="p-3.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{serverError}</span>
                </div>
              )}

              {/* Section 1: Contact Representative */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                  <UserCheck className="h-4 w-4 text-brand-400" />
                  <span>1. Primary Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name *"
                    required
                    placeholder="Jane Doe"
                    error={errors.full_name?.message}
                    {...register("full_name")}
                  />
                  <Input
                    label="Corporate Email *"
                    type="email"
                    required
                    placeholder="jane@company.com"
                    error={errors.email?.message}
                    {...register("email")}
                  />
                  <Input
                    label="Account Password *"
                    type="password"
                    required
                    placeholder="Min 8 chars, mixed case, symbols"
                    error={errors.password?.message}
                    {...register("password")}
                  />
                  <Input
                    label="Job Title / Role"
                    placeholder="CISO / Head of Security"
                    error={errors.job_title?.message}
                    {...register("job_title")}
                  />
                  <Input
                    label="Contact Phone"
                    type="tel"
                    placeholder="+91 98765 43210"
                    error={errors.phone?.message}
                    {...register("phone")}
                  />
                </div>
              </div>

              {/* Section 2: Organization Profile */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                  <Building2 className="h-4 w-4 text-brand-400" />
                  <span>2. Organization Profile</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Company Name *"
                    required
                    placeholder="Acme Corp, Inc."
                    error={errors.company_name?.message}
                    {...register("company_name")}
                  />
                  <Input
                    label="Company Website"
                    placeholder="https://acme.com"
                    error={errors.website?.message}
                    {...register("website")}
                  />
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Industry Sector
                    </label>
                    <select
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      {...register("industry")}
                    >
                      <option value="Technology / SaaS">Technology / SaaS</option>
                      <option value="Financial Services / Fintech">Financial Services / Fintech</option>
                      <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                      <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                      <option value="Defense & Critical Infrastructure">Defense & Critical Infrastructure</option>
                      <option value="Consulting & Professional Services">Consulting & Professional Services</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Company Size
                    </label>
                    <select
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      {...register("company_size")}
                    >
                      <option value="1-20 employees">1-20 employees</option>
                      <option value="21-100 employees">21-100 employees</option>
                      <option value="101-500 employees">101-500 employees</option>
                      <option value="500+ employees">500+ employees</option>
                    </select>
                  </div>
                  <Input
                    label="Country / Headquarters"
                    placeholder="India"
                    error={errors.country?.message}
                    {...register("country")}
                  />
                </div>
              </div>

              {/* Section 3: Scope & Operations Requirements */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 text-zinc-200 text-xs font-mono font-semibold uppercase tracking-wider">
                  <Server className="h-4 w-4 text-brand-400" />
                  <span>3. Scope & Requirements</span>
                </div>
                <div className="space-y-3">
                  <Input
                    label="Primary In-Scope Domains / CIDRs"
                    placeholder="api.company.com, app.company.com"
                    error={errors.primary_domains?.message}
                    {...register("primary_domains")}
                  />
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Requested FixOps Automation Services
                    </label>
                    <select
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      {...register("requested_services")}
                    >
                      <option value="Automated FixOps & Vulnerability Management">
                        Automated FixOps & Vulnerability Management (Full Pipeline)
                      </option>
                      <option value="Continuous Penetration Testing & SLA Tracking">
                        Continuous Penetration Testing & SLA Tracking
                      </option>
                      <option value="Cloud Security Posture & Asset Discovery">
                        Cloud Security Posture & Asset Discovery
                      </option>
                      <option value="Compliance Verification & Audit Readiness">
                        Compliance Verification & Audit Readiness (SOC2, ISO27001)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                      Brief Scope Description or Security Goals
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Outline target assets, tech stack, compliance deadlines, or specific remediation requirements..."
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                      {...register("scope_description")}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800 space-y-3">
                <Button
                  type="submit"
                  className="w-full h-11 text-xs font-semibold tracking-wide uppercase"
                  isLoading={isSubmitting}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  <span>Submit Client Application</span>
                </Button>

                <div className="flex items-center justify-between text-xs text-zinc-500 pt-1">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 hover:text-zinc-300 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back to Sign In</span>
                  </Link>
                  <Link
                    href="/register/status"
                    className="hover:text-brand-400 transition-colors"
                  >
                    Already applied? Track status
                  </Link>
                </div>
              </div>
            </form>
          </div>
        )}

        <div className="text-center text-xs text-zinc-500">
          Strict authorization and tenant isolation are enforced. Inquiries:{" "}
          <a
            href="mailto:onboarding@lazynerds.com"
            className="text-zinc-400 hover:text-zinc-200 underline underline-offset-4"
          >
            onboarding@lazynerds.com
          </a>
        </div>
      </div>
    </div>
  );
}
