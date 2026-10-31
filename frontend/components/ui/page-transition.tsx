"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

export type TransitionKind =
  | "card-flip-forward"    // Login -> Register
  | "card-flip-backward"   // Register -> Login
  | "card-tilt-forward"    // Login -> Forgot Password
  | "card-tilt-backward"   // Forgot Password -> Login
  | "card-flow-forward"    // Forgot Password -> Reset Password
  | "card-flow-backward"   // Reset Password -> Login
  | "landing-to-auth"      // Landing (/) -> Auth
  | "auth-to-landing"      // Auth -> Landing (/)
  | "default";             // Fallback / standard routes

function normalizePath(p: string): string {
  if (!p) return "/";
  const clean = p.split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) {
    return clean.slice(0, -1);
  }
  return clean;
}

/**
 * Determines the coordinated 3D transition based on navigation direction.
 */
export function resolveTransitionKind(prevPath: string, nextPath: string): TransitionKind {
  const from = normalizePath(prevPath);
  const to = normalizePath(nextPath);

  if (from === to) return "default";

  // Login <-> Register (tactile 3D horizontal card-flip)
  if (from === "/login" && to === "/register") return "card-flip-forward";
  if (from === "/register" && to === "/login") return "card-flip-backward";

  // Login <-> Forgot Password (directional 3D card tilt & slide)
  if (from === "/login" && to === "/forgot-password") return "card-tilt-forward";
  if (from === "/forgot-password" && to === "/login") return "card-tilt-backward";

  // Register <-> Forgot Password
  if (from === "/register" && to === "/forgot-password") return "card-tilt-forward";
  if (from === "/forgot-password" && to === "/register") return "card-flip-forward";

  // Forgot Password <-> Reset Password (directional forward flow)
  if (from === "/forgot-password" && to === "/reset-password") return "card-flow-forward";
  if (from === "/reset-password" && to === "/forgot-password") return "card-flow-backward";
  if (from === "/reset-password" && to === "/login") return "card-flip-backward";

  // Landing <-> Auth pages (coordinated emergence from / retreat to cyber shield)
  const authRoutes = ["/login", "/register", "/signup", "/forgot-password", "/reset-password"];
  if (from === "/" && authRoutes.includes(to)) {
    return "landing-to-auth";
  }
  if (authRoutes.includes(from) && to === "/") {
    return "auth-to-landing";
  }

  return "default";
}

/**
 * PageTransition
 * 
 * Provides an Apple-level, tactile 3D card-flip and coordinated transition system.
 * 
 * Key architectural features:
 * - The authentication form behaves as a physical frosted-glass panel smoothly
 *   transforming into the next view.
 * - Pinned header and footer: navigation controls and legal footers remain stationary.
 * - Persistent cosmic background: the cyber shield, orbital rings, Earth horizon,
 *   and lighting remain rock-solid and stationary.
 * - Coordinated dual-layer transition: outgoing card rotates away with subtle depth shadow,
 *   incoming card arrives with specular shine bloom and settles with refined Apple easing.
 * - Immediate navigation: zero artificial delays or setTimeout blocking before routing.
 * - Automatic cleanup after 320ms, with rapid-click override protection.
 * - Full prefers-reduced-motion accessibility support.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  const prevPathnameRef = useRef(pathname);
  const prevChildrenRef = useRef<React.ReactNode>(children);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [exitingState, setExitingState] = useState<{
    pathname: string;
    node: React.ReactNode;
    kind: TransitionKind;
  } | null>(null);

  const [activeKind, setActiveKind] = useState<TransitionKind>("default");

  useEffect(() => {
    const currentNormalized = normalizePath(pathname);
    const prevNormalized = normalizePath(prevPathnameRef.current);

    if (currentNormalized !== prevNormalized) {
      const kind = resolveTransitionKind(prevNormalized, currentNormalized);

      // Cancel any ongoing exit timer to handle rapid clicks cleanly
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      setExitingState({
        pathname: prevNormalized,
        node: prevChildrenRef.current,
        kind,
      });
      setActiveKind(kind);

      prevPathnameRef.current = pathname;

      // Clean up the exiting layer once the 240ms transition finishes
      timerRef.current = setTimeout(() => {
        setExitingState(null);
        setActiveKind("default");
      }, 260);
    }

    prevChildrenRef.current = children;

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [pathname, children]);

  return (
    <div
      className="fixops-transition-stage relative w-full min-h-screen overflow-x-hidden"
      data-purpose="page-transition-container"
      data-active-kind={activeKind}
      data-is-transitioning={Boolean(exitingState)}
    >
      {/* Exiting snapshot layer: physical card rotating / tilting out */}
      {exitingState && (
        <div
          key={`exit-${exitingState.pathname}`}
          className={`fixops-transition-layer fixops-exit-layer fixops-${exitingState.kind}-exit absolute inset-0 z-10 w-full min-h-screen pointer-events-none select-none`}
          aria-hidden="true"
        >
          {exitingState.node}
        </div>
      )}

      {/* Entering layer: interactive page content rotating / arriving in */}
      <div
        key={`enter-${pathname}`}
        className={`fixops-transition-layer fixops-enter-layer ${
          exitingState ? `fixops-${activeKind}-enter` : "fixops-subtle-appear"
        } relative z-20 w-full min-h-screen flex flex-col`}
      >
        {children}
      </div>
    </div>
  );
}

export default PageTransition;
