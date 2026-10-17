"use client";

import React, { useEffect, useState } from "react";
import {
  formatDateTime,
  formatDate,
  formatRelativeTime,
  getTimezonePreference,
  DEFAULT_TIMEZONE,
} from "@/lib/utils";

interface TimeDisplayProps {
  value?: string | null;
  mode?: "datetime" | "date" | "relative";
  className?: string;
  targetTimezone?: string;
  showTooltip?: boolean;
}

/**
 * Hydration-safe, timezone-aware timestamp display component.
 * Defaults deterministically to Asia/Kolkata during SSR to prevent hydration mismatches,
 * and seamlessly synchronizes with client-side user timezone preferences.
 */
export const TimeDisplay: React.FC<TimeDisplayProps> = ({
  value,
  mode = "datetime",
  className = "",
  targetTimezone,
  showTooltip = true,
}) => {
  const [activeTz, setActiveTz] = useState<string>(targetTimezone || DEFAULT_TIMEZONE);

  useEffect(() => {
    if (!targetTimezone) {
      setActiveTz(getTimezonePreference());
    }

    const onTzChange = () => {
      if (!targetTimezone) {
        setActiveTz(getTimezonePreference());
      }
    };

    window.addEventListener("fixops_timezone_change", onTzChange);
    return () => window.removeEventListener("fixops_timezone_change", onTzChange);
  }, [targetTimezone]);

  if (!value) return null;

  let formatted = "";
  if (mode === "date") {
    formatted = formatDate(value, activeTz);
  } else if (mode === "relative") {
    formatted = formatRelativeTime(value, activeTz);
  } else {
    formatted = formatDateTime(value, activeTz);
  }

  const tooltip = showTooltip && mode !== "datetime" ? formatDateTime(value, activeTz) : undefined;

  return (
    <span className={className} title={tooltip} suppressHydrationWarning>
      {formatted}
    </span>
  );
};
