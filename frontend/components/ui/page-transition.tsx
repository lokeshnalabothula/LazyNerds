"use client";

import React from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition
 * 
 * Provides an immediate, seamless tactile page flip transition for Lazy Nerds FixOps.
 * Timing: 240ms enter with cubic-bezier(0.22, 1, 0.36, 1).
 * Features subtle 3D card perspective (rotateX 1.2deg -> 0deg, translateY 6px -> 0px, scale 0.995 -> 1).
 * Zero artificial waiting timers or delayed routing.
 * Persistent cosmic background, specular shield, horizon and lighting remain stationary.
 * Automatically respects prefers-reduced-motion.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <div
      key={pathname}
      className="fixops-page-enter w-full flex-1 flex flex-col relative z-10"
      data-purpose="page-transition-container"
    >
      {children}
    </div>
  );
}

export default PageTransition;
