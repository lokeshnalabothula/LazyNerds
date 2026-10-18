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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row text-zinc-900 dark:text-zinc-100 overflow-x-hidden">
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
              className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation overlay"
            />
            <div className="relative w-64 max-w-[85vw] h-full z-10 bg-zinc-50 dark:bg-zinc-950 shadow-2xl animate-in slide-in-from-left duration-200">
              <Sidebar onNavigate={() => setMobileNavOpen(false)} />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
          <Topbar
            title={title}
            isSidebarCollapsed={isCollapsed}
            onToggleSidebar={toggleSidebarCollapse}
            onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
          />
          <main className="flex-1 p-3 sm:p-5 md:p-6 lg:p-8 max-w-7xl w-full mx-auto transition-all">
            {children}
          </main>
        </div>
      </div>
    );
  };
