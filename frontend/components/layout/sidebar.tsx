"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Users,
  Shield,
  Layers,
  FileCheck2,
  PieChart,
  Settings,
  LayoutDashboard,
  ExternalLink,
} from "lucide-react";

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const pathname = usePathname();

  const navigationItems = [
    {
      name: "Overview",
      href: "/overview",
      icon: LayoutDashboard,
      status: "planned",
    },
    {
      name: "Clients",
      href: "/clients",
      icon: Users,
      status: "active",
    },
    {
      name: "Engagements",
      href: "/engagements",
      icon: Layers,
      status: "active",
    },
    {
      name: "Assets",
      href: "/assets",
      icon: Shield,
      status: "planned",
    },
    {
      name: "Findings",
      href: "/findings",
      icon: FileCheck2,
      status: "planned",
    },
    {
      name: "Reports",
      href: "/reports",
      icon: PieChart,
      status: "planned",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      status: "active",
    },
  ];

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between">
        <Link href="/clients" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-zinc-900 font-mono text-xs font-bold">
            LN
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              LAZY NERDS
            </span>
            <span className="text-[10px] uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold">
              FixOps Client Manager
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Core Workspace
        </div>

        {navigationItems.map((item) => {
          const isActive =
            item.status === "active" &&
            (pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href)));
          const isPlanned = item.status === "planned";

          if (isPlanned) {
            return (
              <div
                key={item.name}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs text-zinc-400 dark:text-zinc-600 cursor-not-allowed group"
                title={`${item.name} module is planned for a future platform release.`}
              >
                <div className="flex items-center gap-2.5">
                  <item.icon className="h-4 w-4 text-zinc-400 dark:text-zinc-600" />
                  <span>{item.name}</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 font-mono">
                  Planned
                </span>
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                isActive
                  ? "bg-zinc-200/70 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4",
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-100/40 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="font-mono text-[10px]">FixOps v1.0.0</span>
          <div className="flex items-center gap-2">
            <Link
              href="/privacy"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
            >
              Privacy
            </Link>
            <span>•</span>
            <Link
              href="/terms"
              className="hover:text-zinc-900 dark:hover:text-zinc-200 hover:underline"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
};
