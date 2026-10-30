"use client";

import React from "react";
import { usePathname } from "next/navigation";

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * PageTransition
 * 
 * Provides smooth, fast GPU-accelerated enter transitions on route changes.
 * Timing: 280ms enter, cubic-bezier(0.22, 1, 0.36, 1).
 * Respects prefers-reduced-motion automatically.
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
