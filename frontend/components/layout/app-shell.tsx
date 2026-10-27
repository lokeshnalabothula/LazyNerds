"use client";

import React, { useEffect } from "react";
import { FloatingNav } from "@/components/layout/floating-nav";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { FixOpsAppLoader } from "@/components/ui/loading";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, title }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <FixOpsAppLoader
        label="AUTHENTICATING SESSION"
        subtext="Connecting to FixOps secure operational bus…"
      />
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#07090E] telemetry-grid-bg flex flex-col text-[#e3e1e9] overflow-x-hidden relative selection:bg-[#F5C518]/20 selection:text-[#F5C518]">
      {/* Subtle Atmospheric Radial Vignette (Stitch Liquid Glass Model) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(245,197,24,0.04),rgba(7,9,14,0))]"
      />

      {/* Modern Floating Liquid Glass Navigation System */}
      <FloatingNav />

      {/* Main Content Area - Full width, expansive, and unobstructed */}
      <main className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-5 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-6 pb-16 relative z-10 transition-all">
        {children}
      </main>
    </div>
  );
};
