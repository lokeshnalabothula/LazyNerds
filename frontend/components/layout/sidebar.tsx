"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/ui/avatar";
import {
  Users,
  Shield,
  Layers,
  FileCheck2,
  PieChart,
  Settings,
  LayoutDashboard,
  Zap,
  UserPlus,
  Globe,
} from "lucide-react";

interface SidebarProps {
  onNavigate?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onNavigate,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const isFounder = user?.role === "founder";
  const isClient = user?.role === "client";

  const navigationItems = [
    {
      name: "Dashboard",
      href: "/overview",
      icon: LayoutDashboard,
      description: "Security Operations & Telemetry",
    },
    ...(!isClient
      ? [
          {
            name: "Clients",
            href: "/clients",
            icon: Users,
            description: "Client Organizations Directory",
          },
        ]
      : []),
    ...(isFounder
      ? [
          {
            name: "Registrations",
            href: "/registrations",
            icon: UserPlus,
            badge: "Review",
            description: "Self-Registration Review Queue",
          },
        ]
      : []),
    {
      name: "Website Audit",
      href: "/audit",
      icon: Globe,
      badge: "Scan",
      description: "Automated URL Security Assessment",
    },
    {
      name: "Engagements",
      href: "/engagements",
      icon: Layers,
      description: "Audits, Pentests & Assessments",
    },
    {
      name: "Assets",
      href: "/assets",
      icon: Shield,
      description: "In-Scope Infrastructure & APIs",
    },
    {
      name: "Findings",
      href: "/findings",
      icon: FileCheck2,
      description: "Vulnerabilities & Remediations",
    },
    ...(!isClient
      ? [
          {
            name: "Automation",
            href: "/automation",
            icon: Zap,
            description: "Security Automation Engine",
          },
        ]
      : []),
    {
      name: "Reports",
      href: "/reports",
      icon: PieChart,
      description: "Deliverables & Audit Evidence",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      description: "Platform & Security Preferences",
    },
  ];

  return (
    <aside
      className={cn(
        "border-r border-white/[0.08] bg-[#0d0e13]/85 backdrop-blur-2xl flex flex-col h-full select-none transition-all duration-300 ease-in-out shadow-[20px_0_40px_-15px_rgba(0,0,0,0.65)]",
        isCollapsed ? "w-[68px]" : "w-64"
      )}
      aria-label="Application Navigation Sidebar"
    >
      {/* Brand Header */}
      <div
        className={cn(
          "h-14 border-b border-white/[0.08] px-3 flex items-center shrink-0",
          isCollapsed ? "justify-center" : "justify-start"
        )}
      >
        <Link
          href="/overview"
          onClick={onNavigate}
          className="flex items-center gap-2 group overflow-hidden"
          title="Lazy Nerds FixOps — Security Operations"
        >
          {isCollapsed ? (
            <div className="h-8 w-8 rounded-lg border border-[#00f0ff]/30 bg-[#161920] flex items-center justify-center font-mono font-bold text-xs text-[#00f0ff]">
              LN
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-sm tracking-tight text-[#dbfcff] truncate">
                Lazy Nerds
              </span>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-bold font-mono shrink-0">
                FIXOPS
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3.5 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <div className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[#849495] font-mono flex items-center justify-between">
            <span>Workspace</span>
            <span className="h-1 w-1 rounded-full bg-[#00f0ff]" />
          </div>
        )}

        {navigationItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && item.href !== "/overview" && pathname.startsWith(item.href)) ||
            (item.href === "/overview" && (pathname === "/overview" || pathname === "/"));

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              title={isCollapsed ? `${item.name}: ${item.description}` : undefined}
              className={cn(
                "group relative flex items-center rounded-lg text-xs font-medium min-h-[38px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00f0ff]",
                isCollapsed
                  ? "justify-center px-2 py-2"
                  : "gap-2.5 px-3 py-2",
                isActive
                  ? "bg-[#00f0ff]/15 text-[#00f0ff] font-semibold shadow-xs border-l-2 border-[#00f0ff]"
                  : "text-[#b9cacb] hover:text-[#dbfcff] hover:bg-white/[0.04]"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-[#00f0ff]"
                    : "text-[#849495] group-hover:text-[#dbfcff]"
                )}
              />

              {!isCollapsed && (
                <>
                  <span className="truncate flex-1 tracking-tight">{item.name}</span>
                  {"badge" in item && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 uppercase font-semibold shrink-0">
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {/* Hover tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2.5 py-1 rounded-md bg-zinc-900 dark:bg-[#161920] text-zinc-100 dark:text-[#F9FAFB] text-[11px] font-medium whitespace-nowrap shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-zinc-800 dark:border-[#222630]">
                  {item.name}
                  {"badge" in item && item.badge && (
                    <span className="ml-1.5 text-[9px] text-[#FFD84D] font-mono">({item.badge})</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Quick Profile */}
      {user && (
        <div className="border-t border-zinc-200 dark:border-[#222630] p-2 shrink-0">
          <Link
            href="/settings"
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 p-2 rounded-lg bg-transparent hover:bg-zinc-200/60 dark:hover:bg-[#161920] transition-colors group",
              isCollapsed ? "justify-center" : "justify-start"
            )}
            title={`Operator: ${user.full_name || user.email}`}
          >
            <div className="relative shrink-0">
              <Avatar
                fallbackText={user.full_name || user.email}
                size="sm"
                alt={user.full_name || "Operator"}
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 green-beacon-pulse border border-[#0B0D12]" title="Operational" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0 text-left">
                <span className="text-xs font-semibold text-zinc-900 dark:text-[#F9FAFB] truncate group-hover:text-[#F5C518] transition-colors">
                  {user.full_name || user.email}
                </span>
                <span className="text-[10px] text-zinc-500 dark:text-[#9CA3AF] truncate capitalize font-mono flex items-center gap-1">
                  <span>{user.role}</span>
                  <span className="text-zinc-600 dark:text-zinc-500">•</span>
                  <span className="text-emerald-500/90 dark:text-emerald-400">active</span>
                </span>
              </div>
            )}
          </Link>
        </div>
      )}

      {/* Footer Info */}
      <div className="border-t border-zinc-200 dark:border-[#222630] p-2.5 bg-zinc-100/40 dark:bg-[#090A0D] shrink-0">
        {isCollapsed ? (
          <div className="flex justify-center text-[10px] font-mono text-zinc-400 select-none" title="Lazy Nerds FixOps v2.1.0">
            v2.1
          </div>
        ) : (
          <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
            <span className="font-mono text-[10px]">FixOps v2.1.0</span>
            <div className="flex items-center gap-2">
              <Link
                href="/privacy"
                onClick={onNavigate}
                className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
              >
                Privacy
              </Link>
              <span>•</span>
              <Link
                href="/terms"
                onClick={onNavigate}
                className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
              >
                Terms
              </Link>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
