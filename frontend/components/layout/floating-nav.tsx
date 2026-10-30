"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { Notification } from "@/types/notification";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Globe,
  Radar,
  Layers,
  Shield,
  ShieldCheck,
  FileCheck2,
  Zap,
  PieChart,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  CheckCheck,
  ExternalLink,
  Loader2,
  ChevronRight,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  badge?: "Scan" | "Live" | "Review" | "DNS";
  role?: "founder" | "employee" | "client" | "all";
}

export const FloatingNav: React.FC = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isFounder = user?.role === "founder";
  const isClient = user?.role === "client";

  const navigationItems: NavItem[] = [
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
            badge: "Review" as const,
            description: "Self-Registration Review Queue",
          },
        ]
      : []),
    {
      name: "Website Audit",
      href: "/audit",
      icon: Globe,
      badge: "Scan" as const,
      description: "Automated URL Security Assessment",
    },
    {
      name: "Orbital Radar",
      href: "/radar",
      icon: Radar,
      badge: "Live" as const,
      description: "Orbital Defense & Telemetry Stream",
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
      name: "Domains",
      href: "/domains",
      icon: ShieldCheck,
      badge: "DNS" as const,
      description: "Domain Ownership & Verification",
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

  const isItemActive = (href: string) => {
    if (href === "/overview") {
      return pathname === "/overview" || pathname === "/";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setIsNotifOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  // Notifications polling
  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.getNotifications(20);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
    } catch {
      // Background fail-safe
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchNotifications]);

  // Click outside listener for dropdowns
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setLoadingNotifs(true);
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } finally {
      setLoadingNotifs(false);
    }
  };

  return (
    <header className="sticky top-2 sm:top-3 md:top-4 z-40 w-full px-2 sm:px-4 md:px-6 pointer-events-none">
      <div className="max-w-[1440px] mx-auto pointer-events-auto">
        {/* Floating Liquid Glass Island */}
        <div className="relative rounded-2xl bg-[#07090E]/85 backdrop-blur-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)] transition-all">
          {/* Main Navigation Bar */}
          <div className="h-14 sm:h-16 px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Brand Identity */}
            <Link
              href="/overview"
              className="flex items-center gap-2 group shrink-0 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50 rounded-xl"
              title="Lazy Nerds FixOps"
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-[#FFD84D]/20 via-[#F5C518]/10 to-transparent border border-[#F5C518]/30 flex items-center justify-center text-[#F5C518] shadow-sm group-hover:border-[#F5C518]/60 transition-colors">
                <Shield className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-bold text-xs sm:text-sm tracking-tight text-white font-mono truncate">
                  Lazy Nerds
                </span>
                <span className="text-[8px] sm:text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-[#F5C518]/40 bg-[#F5C518]/10 text-[#F5C518] font-bold tracking-widest shrink-0">
                  FIXOPS
                </span>
              </div>
            </Link>

            {/* Center: Desktop Liquid Glass Pill Track (XL & Above) */}
            <nav
              aria-label="Primary Navigation"
              className="hidden xl:flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/[0.06] shadow-inner max-w-full overflow-x-auto no-scrollbar"
            >
              {navigationItems.map((item) => {
                const active = isItemActive(item.href);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    title={`${item.name} — ${item.description}`}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 select-none shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50",
                      active
                        ? "bg-white/[0.12] text-white font-semibold border border-white/20 shadow-[0_2px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.18)]"
                        : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] border border-transparent"
                    )}
                  >
                    <IconComponent
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 transition-colors",
                        active ? "text-[#F5C518]" : "text-zinc-400 group-hover:text-zinc-200"
                      )}
                    />
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span
                        className={cn(
                          "text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold tracking-wider",
                          item.badge === "Scan" &&
                            "bg-[#F5C518]/20 text-[#FFD84D] border border-[#F5C518]/40",
                          item.badge === "Live" &&
                            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                          item.badge === "Review" &&
                            "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",
                          item.badge === "DNS" &&
                            "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#F5C518] shadow-[0_0_6px_#F5C518]" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Right: Telemetry Status, Notifications, & User Account */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Stitch Core Online Status Indicator */}
              <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] text-white/90 shadow-xs font-mono shrink-0 select-none">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400/60 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                </span>
                <span className="tracking-wide text-zinc-300 font-medium">CORE ONLINE</span>
              </div>

              {/* Notifications Dropdown */}
              {user && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => {
                      setIsNotifOpen(!isNotifOpen);
                      if (!isNotifOpen) fetchNotifications();
                    }}
                    className={cn(
                      "p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] relative transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center border border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50",
                      isNotifOpen && "bg-white/[0.1] text-white border-white/15"
                    )}
                    aria-label="Security notifications"
                    title="Security Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFD84D] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F5C518] shadow-[0_0_6px_#F5C518]" />
                      </span>
                    )}
                  </button>

                  {/* Dropdown Panel */}
                  {isNotifOpen && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#090B10]/95 backdrop-blur-2xl border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="p-3.5 border-b border-white/[0.08] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4 text-[#F5C518]" />
                          <span className="text-xs font-semibold text-white">
                            Security Alerts & Audit Events
                          </span>
                        </div>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            disabled={loadingNotifs}
                            className="text-[10px] text-zinc-400 hover:text-[#F5C518] font-mono flex items-center gap-1 transition-colors"
                          >
                            <CheckCheck className="h-3 w-3" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.05]">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-xs text-zinc-500 font-mono">
                            Zero security alerts in queue.
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n.id}
                              onClick={() => handleMarkRead(n.id)}
                              className={cn(
                                "p-3 hover:bg-white/[0.04] transition-colors cursor-pointer text-xs flex gap-2.5",
                                !n.is_read && "bg-[#F5C518]/[0.03]"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full mt-1.5 shrink-0",
                                  n.is_read
                                    ? "bg-transparent"
                                    : "bg-[#F5C518] shadow-[0_0_6px_#F5C518]"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-zinc-200 truncate">
                                  {n.title}
                                </p>
                                <p className="text-zinc-400 text-[11px] mt-0.5 line-clamp-2">
                                  {n.message}
                                </p>
                                <span className="text-[9px] text-zinc-500 font-mono mt-1 block">
                                  {new Date(n.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Account Avatar & Dropdown */}
              {user && (
                <div className="relative" ref={userMenuRef}>
                  <button
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className={cn(
                      "flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full bg-white/[0.04] border border-white/10 hover:border-white/20 hover:bg-white/[0.08] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50",
                      isUserMenuOpen && "border-[#F5C518]/40 bg-white/[0.1]"
                    )}
                    aria-label="User account menu"
                    title={`Signed in as ${user.full_name || user.email}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center font-mono font-bold text-xs text-white shadow-xs">
                      {user.full_name?.charAt(0).toUpperCase() ||
                        user.email?.charAt(0).toUpperCase() ||
                        "U"}
                    </div>
                    <span className="hidden sm:inline text-xs font-medium text-zinc-200 max-w-[100px] truncate">
                      {user.full_name?.split(" ")[0] || "User"}
                    </span>
                  </button>

                  {/* User Profile Dropdown Panel */}
                  {isUserMenuOpen && (
                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#090B10]/95 backdrop-blur-2xl border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.8)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="p-3.5 border-b border-white/[0.08]">
                        <p className="text-xs font-bold text-white truncate">
                          {user.full_name}
                        </p>
                        <p className="text-[11px] text-zinc-400 font-mono truncate mt-0.5">
                          {user.email}
                        </p>
                        <div className="mt-2 flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-[9px] font-mono uppercase px-2 py-0.5 rounded-full font-bold tracking-wider border",
                              isFounder &&
                                "bg-[#F5C518]/15 text-[#FFD84D] border-[#F5C518]/30",
                              user.role === "employee" &&
                                "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
                              isClient &&
                                "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            )}
                          >
                            {user.role}
                          </span>
                        </div>
                      </div>

                      <div className="p-1.5 space-y-0.5">
                        <Link
                          href="/settings"
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                        >
                          <Settings className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Settings & Preferences</span>
                        </Link>
                        <button
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            logout();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                        >
                          <LogOut className="h-3.5 w-3.5 text-rose-400" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile / Tablet Menu Toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 rounded-full text-zinc-400 hover:text-white hover:bg-white/[0.08] transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50"
                aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Secondary Horizontal Pill Strip on Tablet / Laptop (< XL) */}
          <div className="hidden md:flex xl:hidden items-center gap-1 px-3 py-2 overflow-x-auto no-scrollbar border-t border-white/[0.06]">
            {navigationItems.map((item) => {
              const active = isItemActive(item.href);
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 select-none shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518]/50",
                    active
                      ? "bg-white/[0.12] text-white font-semibold border border-white/20 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] border border-transparent"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-colors",
                      active ? "text-[#F5C518]" : "text-zinc-400 group-hover:text-zinc-200"
                    )}
                  />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span
                      className={cn(
                        "text-[8px] font-mono uppercase px-1 py-0.2 rounded-full font-bold",
                        item.badge === "Scan" &&
                          "bg-[#F5C518]/20 text-[#FFD84D] border border-[#F5C518]/40",
                        item.badge === "Live" &&
                          "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                        item.badge === "Review" &&
                          "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",
                        item.badge === "DNS" &&
                          "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Quick-Scroll Touch Pill Strip on Mobile (< MD) */}
          <div className="flex md:hidden items-center gap-1 px-2.5 py-1.5 overflow-x-auto no-scrollbar border-t border-white/[0.06]">
            {navigationItems.map((item) => {
              const active = isItemActive(item.href);
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all select-none shrink-0",
                    active
                      ? "bg-white/[0.14] text-white font-semibold border border-white/20 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] border border-transparent"
                  )}
                >
                  <IconComponent
                    className={cn(
                      "h-3 w-3 shrink-0",
                      active ? "text-[#F5C518]" : "text-zinc-400"
                    )}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>

          {/* Mobile Full Navigation Overlay Sheet */}
          {mobileMenuOpen && (
            <div className="xl:hidden p-3 pt-2 border-t border-white/[0.08] animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[70vh] overflow-y-auto no-scrollbar py-1">
                {navigationItems.map((item) => {
                  const active = isItemActive(item.href);
                  const IconComponent = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs",
                        active
                          ? "bg-white/[0.12] text-white border-white/25 shadow-sm font-semibold"
                          : "bg-white/[0.02] text-zinc-400 hover:text-white hover:bg-white/[0.06] border-white/[0.05]"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                            active
                              ? "bg-[#F5C518]/20 border-[#F5C518]/40 text-[#F5C518]"
                              : "bg-white/[0.04] border-white/10 text-zinc-400"
                          )}
                        >
                          <IconComponent className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate font-mono">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      {item.badge ? (
                        <span
                          className={cn(
                            "text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold shrink-0",
                            item.badge === "Scan" &&
                              "bg-[#F5C518]/20 text-[#FFD84D] border border-[#F5C518]/40",
                            item.badge === "Live" &&
                              "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40",
                            item.badge === "Review" &&
                              "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40",
                            item.badge === "DNS" &&
                              "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                          )}
                        >
                          {item.badge}
                        </span>
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>

              {/* Mobile Logout Row */}
              <div className="mt-2 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="font-mono text-[10px]">{user?.email}</span>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    logout();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 font-medium transition-colors"
                >
                  <LogOut className="h-3 w-3" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
