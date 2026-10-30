"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition
 * 
 * Provides a coordinated two-stage page navigation motion system for Lazy Nerds FixOps:
 * 1. Exit Stage: Opacity 1 -> 0, TranslateY 0 -> -4px (180ms, cubic-bezier(0.22, 1, 0.36, 1))
 * 2. Enter Stage: Opacity 0 -> 1, TranslateY 8px -> 0, Scale 0.99 -> 1 (300ms, cubic-bezier(0.22, 1, 0.36, 1))
 * 
 * Intercepts internal Next.js link clicks so outgoing page content smoothly exits
 * before routing, and incoming page content enters smoothly on mount.
 * The persistent background (grid, laser ray, earth limb, and cyber shield)
 * remains rock-solid in RootLayout without restarting or flickering.
 * Respects prefers-reduced-motion automatically.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [isExiting, setIsExiting] = useState(false);
  const isNavigatingRef = useRef(false);
  const exitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // When pathname changes (route push completed), reset exit state immediately
  useEffect(() => {
    isNavigatingRef.current = false;
    setIsExiting(false);
    if (exitTimeoutRef.current) {
      clearTimeout(exitTimeoutRef.current);
      exitTimeoutRef.current = null;
    }
  }, [pathname]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (exitTimeoutRef.current) {
        clearTimeout(exitTimeoutRef.current);
      }
    };
  }, []);

  // Intercept client-side link navigation
  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only process primary click without modifier keys
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }

      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Skip non-navigational or special links
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:") ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Check origin
      let targetUrl: URL;
      try {
        targetUrl = new URL(href, window.location.href);
      } catch {
        return;
      }

      if (targetUrl.origin !== window.location.origin) {
        return;
      }

      const targetPath = targetUrl.pathname + targetUrl.search + targetUrl.hash;
      const currentPath = window.location.pathname + window.location.search + window.location.hash;

      // Same route - nothing to transition
      if (targetPath === currentPath) {
        return;
      }

      // Intercept Next.js Link default immediate route change
      e.preventDefault();

      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;

      // Check prefers-reduced-motion
      const prefersReduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReduced) {
        router.push(targetPath);
        return;
      }

      // Stage 1: Exit transition (180ms)
      setIsExiting(true);

      exitTimeoutRef.current = setTimeout(() => {
        router.push(targetPath);
      }, 180);
    },
    [router]
  );

  return (
    <div
      onClick={handleContainerClick}
      className={`w-full flex-1 flex flex-col relative z-10 ${
        isExiting ? "fixops-page-exit" : "fixops-page-enter"
      }`}
      key={pathname}
      data-purpose="page-transition-container"
    >
      {children}
    </div>
  );
}

export default PageTransition;
