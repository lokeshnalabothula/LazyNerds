"use client";

import { useState, useEffect, useCallback } from "react";

export type ViewMode = "table" | "cards";

/**
 * Device-aware view preference hook.
 * 
 * Behavior:
 * 1. Restores the user's explicit saved choice from localStorage if present.
 * 2. If no saved choice exists, uses the screen-size default:
 *    - Desktop / Laptop (>= 1024px): "table" (List View)
 *    - Tablet / Mobile (< 1024px): "cards" (Card View)
 * 3. Never overwrites a saved choice during initialization.
 * 4. User's explicit selection is persisted to localStorage and takes priority on future visits.
 */
export function useViewMode(storageKey: string, desktopBreakpoint: number = 1024) {
  // Safe default before client mount
  const [viewMode, setViewModeState] = useState<ViewMode>("cards");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey) as ViewMode | null;
      if (saved === "table" || saved === "cards") {
        // Saved preference takes priority
        setViewModeState(saved);
      } else {
        // First visit default based on current device screen width
        const isDesktop = window.innerWidth >= desktopBreakpoint;
        setViewModeState(isDesktop ? "table" : "cards");
      }
    } catch (_) {
      // Safe fallback on restricted storage
    } finally {
      setIsLoaded(true);
    }
  }, [storageKey, desktopBreakpoint]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(storageKey, mode);
    } catch (_) {
      // Safe fallback
    }
  }, [storageKey]);

  return { viewMode, setViewMode, isLoaded };
}
