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
} from "lucide-react";

interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const isFounder = user?.role === "founder";
  const isClient = user?.role === "client";

  const navigationItems = [
    {
      name: "Overview",
      href: "/overview",
      icon: LayoutDashboard,
    },
    ...(!isClient
      ? [
          {
            name: "Clients",
            href: "/clients",
            icon: Users,
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
          },
        ]
      : []),
    {
      name: "Engagements",
      href: "/engagements",
      icon: Layers,
    },
    {
      name: "Assets",
      href: "/assets",
      icon: Shield,
    },
    {
      name: "Findings",
      href: "/findings",
      icon: FileCheck2,
    },
    ...(!isClient
      ? [
          {
            name: "Automation",
            href: "/automation",
            icon: Zap,
          },
        ]
      : []),
    {
      name: "Reports",
      href: "/reports",
      icon: PieChart,
    },
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between">
        <Link href="/overview" onClick={onNavigate} className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg border border-brand-500/30 bg-zinc-900 flex items-center justify-center shadow-xs overflow-hidden transition-transform group-hover:scale-105">
            <Image
              src="/brand/logo-icon.png"
              alt="Lazy Nerds"
              width={32}
              height={32}
              priority
              className="object-contain"
            />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold tracking-tight text-zinc-900 dark:text-zinc-100 font-mono">
              LAZY NERDS
            </span>
            <span className="text-[10px] uppercase tracking-wider text-brand-600 dark:text-brand-400 font-semibold">
              FixOps Platform
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2.5 pb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Core Workspace
        </div>

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
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium min-h-[38px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                isActive
                  ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 font-semibold shadow-xs"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900/60"
              )}
            >
              <item.icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              />
              <span className="truncate flex-1">{item.name}</span>
              {"badge" in item && item.badge && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 uppercase font-semibold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-100/40 dark:bg-zinc-900/30">
        <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span className="font-mono text-[10px]">FixOps v2.0.0</span>
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
      </div>
    </aside>
  );
};
