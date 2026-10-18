"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
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
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
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
      name: "Overview",
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
        "border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950 flex flex-col h-full select-none transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[68px]" : "w-64"
      )}
      aria-label="Application Navigation Sidebar"
    >
      {/* Brand Header */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-3 flex items-center justify-between shrink-0">
        <Link
          href="/overview"
          onClick={onNavigate}
          className="flex items-center gap-2.5 group overflow-hidden"
          title="Lazy Nerds FixOps — Security Operations"
        >
          <div className="h-9 w-9 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-center shadow-xs overflow-hidden transition-transform group-hover:scale-105 shrink-0">
            <Image
              src="/brand/logo-icon.png"
              alt="Lazy Nerds"
              width={36}
              height={36}
              priority
              className="object-cover w-full h-full"
            />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono truncate">
                LAZY NERDS
              </span>
              <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold truncate">
                FixOps Platform
              </span>
            </div>
          )}
        </Link>

        {/* Desktop Collapse Button */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className={cn(
              "hidden md:flex p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors shrink-0",
              isCollapsed && "mx-auto"
            )}
            title={isCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {!isCollapsed && (
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-mono">
            Core Workspace
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
                "group relative flex items-center rounded-md text-xs font-medium min-h-[38px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                isCollapsed
                  ? "justify-center px-2 py-2"
                  : "gap-2.5 px-3 py-2",
                isActive
                  ? "bg-blue-500/10 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 font-semibold shadow-xs border-l-2 border-blue-600 dark:border-blue-500"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                )}
              />

              {!isCollapsed && (
                <>
                  <span className="truncate flex-1">{item.name}</span>
                  {"badge" in item && item.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-semibold shrink-0">
                      {item.badge}
                    </span>
                  )}
                </>
              )}

              {/* Hover tooltip for collapsed mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded bg-zinc-900 text-zinc-100 text-[11px] font-medium whitespace-nowrap shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 border border-zinc-800">
                  {item.name}
                  {"badge" in item && item.badge && (
                    <span className="ml-1.5 text-[9px] text-amber-400 font-mono">({item.badge})</span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-2.5 bg-zinc-100/40 dark:bg-zinc-900/40 shrink-0">
        {isCollapsed ? (
          <div className="flex justify-center">
            <button
              onClick={onToggleCollapse}
              className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
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
