"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useAuth } from "@/lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { FixOpsAppLoader } from "@/components/ui/loading";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export const AppShell: React.FC<AppShellProps> = ({ children, title }) => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Initialize and persist sidebar collapse state
  useEffect(() => {
    try {
      const saved = localStorage.getItem("fixops_sidebar_collapsed");
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // Safe no-op on SSR / private browsing
    }
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("fixops_sidebar_collapsed", String(next));
      } catch {
        // Safe no-op
      }
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl+B or Cmd+B to toggle sidebar (ignoring active input fields)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebarCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebarCollapse]);

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
    <div className="min-h-screen bg-zinc-50 dark:bg-[#090A0D] cyber-grid flex flex-col md:flex-row text-zinc-900 dark:text-[#F9FAFB] overflow-x-hidden relative">
      {/* Ambient Top Cyber Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[900px] max-w-full h-[320px] bg-gradient-to-b from-[#F5C518]/[0.03] via-[#F5C518]/[0.01] to-transparent blur-3xl z-0"
      />

      {/* Desktop Collapsible Sidebar */}
      <div
        className={cn(
          "hidden md:block shrink-0 h-screen sticky top-0 transition-[width] duration-300 ease-in-out z-20",
          isCollapsed ? "w-[68px]" : "w-64"
        )}
      >
        <Sidebar
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      </div>

      {/* Mobile / Tablet Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex animate-in fade-in duration-200">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation overlay"
          />
          <div className="relative w-64 max-w-[85vw] h-full z-10 bg-zinc-50 dark:bg-[#0B0D12] shadow-2xl animate-in slide-in-from-left duration-200 border-r border-zinc-200 dark:border-[#222630]">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden relative z-10">
        <Topbar
          title={title}
          isSidebarCollapsed={isCollapsed}
          onToggleSidebar={toggleSidebarCollapse}
          onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
        />
        <main className="flex-1 p-3.5 sm:p-5 md:p-6 lg:p-8 max-w-[1400px] w-full mx-auto transition-all">
          {children}
        </main>
      </div>
    </div>
  );
  };
