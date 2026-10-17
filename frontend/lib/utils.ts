import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_TIMEZONE = "Asia/Kolkata";

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export const SUPPORTED_TIMEZONES: TimezoneOption[] = [
  { value: "auto", label: "Automatic (Browser Detected)", offset: "Auto" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (India Standard Time - IST)", offset: "UTC+05:30" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: "UTC+00:00" },
  { value: "America/New_York", label: "America/New_York (US Eastern Time)", offset: "UTC-04:00/05:00" },
  { value: "America/Chicago", label: "America/Chicago (US Central Time)", offset: "UTC-05:00/06:00" },
  { value: "America/Denver", label: "America/Denver (US Mountain Time)", offset: "UTC-06:00/07:00" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (US Pacific Time)", offset: "UTC-07:00/08:00" },
  { value: "Europe/London", label: "Europe/London (GMT / British Summer Time)", offset: "UTC+00:00/+01:00" },
  { value: "Europe/Paris", label: "Europe/Paris (Central European Time)", offset: "UTC+01:00/+02:00" },
  { value: "Europe/Berlin", label: "Europe/Berlin (Central European Time)", offset: "UTC+01:00/+02:00" },
  { value: "Asia/Dubai", label: "Asia/Dubai (Gulf Standard Time)", offset: "UTC+04:00" },
  { value: "Asia/Singapore", label: "Asia/Singapore (Singapore Time)", offset: "UTC+08:00" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (Japan Standard Time)", offset: "UTC+09:00" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST / AEDT)", offset: "UTC+10:00/+11:00" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getDetectedBrowserTimezone(): string {
  if (typeof Intl !== "undefined" && typeof Intl.DateTimeFormat === "function") {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (tz && typeof tz === "string" && tz.includes("/")) {
        return tz;
      }
    } catch {
      // Fallback
    }
  }
  return DEFAULT_TIMEZONE;
}

export function getTimezonePreference(): string {
  if (typeof window === "undefined") {
    return DEFAULT_TIMEZONE;
  }
  try {
    const saved = localStorage.getItem("fixops_timezone_preference");
    if (saved) {
      if (saved === "auto") {
        return getDetectedBrowserTimezone();
      }
      try {
        Intl.DateTimeFormat(undefined, { timeZone: saved });
        return saved;
      } catch {
        return DEFAULT_TIMEZONE;
      }
    }
  } catch {
    // In incognito or restricted storage
  }

  return DEFAULT_TIMEZONE;
}

export function getRawTimezoneSetting(): string {
  if (typeof window === "undefined") {
    return "Asia/Kolkata";
  }
  try {
    return localStorage.getItem("fixops_timezone_preference") || "Asia/Kolkata";
  } catch {
    return "Asia/Kolkata";
  }
}

export function setTimezonePreference(tz: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("fixops_timezone_preference", tz);
    window.dispatchEvent(new CustomEvent("fixops_timezone_change", { detail: { timezone: tz } }));
  } catch {
    // Storage restricted
  }
}

export function isDateOnly(dateString?: string | null): boolean {
  if (!dateString || typeof dateString !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateString.trim());
}

/**
 * Parses timestamps safely.
 * Naive database timestamps are treated as UTC in line with FixOps backend architecture.
 * Pure date-only strings (YYYY-MM-DD) are preserved without timezone shifts.
 */
export function parseSafeDate(dateString?: string | null): Date | null {
  if (!dateString || typeof dateString !== "string") return null;
  const trimmed = dateString.trim();
  if (!trimmed) return null;

  // Pure date-only YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
  }

  // Has timezone offset or Z
  if (/(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // Naive datetime: FixOps backend persists all database event timestamps in UTC.
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?/);
  if (match) {
    const [_, y, m, d, hh, mm, ss, ms] = match;
    const date = new Date(Date.UTC(+y, +m - 1, +d, +(hh || 0), +(mm || 0), +(ss || 0), +(ms ? ms.slice(0, 3) : 0)));
    return isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function getTimezoneLabel(timeZone: string, date: Date): string {
  if (timeZone === "Asia/Kolkata") return "IST";
  if (timeZone === "UTC") return "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName")?.value;
    if (tzPart === "GMT+5:30") return "IST";
    return tzPart || timeZone;
  } catch {
    return timeZone;
  }
}

/**
 * Formats date strictly without shifting date-only fields across days.
 * When given a datetime string, formats in the target or preferred timezone.
 * Format: '17 Oct 2026'
 */
export function formatDate(dateString?: string | null, targetTimezone?: string): string {
  if (!dateString || typeof dateString !== "string") return "";
  const trimmed = dateString.trim();
  if (!trimmed) return "";

  // Date-only fields (e.g. start_date, due_date) must remain pure calendar dates
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return "";
    return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
  }

  const date = parseSafeDate(trimmed);
  if (!date) return "";

  const timeZone = targetTimezone || getTimezonePreference();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    return `${get("day")} ${get("month")} ${get("year")}`;
  } catch {
    return "";
  }
}

/**
 * Formats date and time in the target or preferred timezone.
 * Format: '17 Oct 2026, 08:00 PM IST'
 */
export function formatDateTime(dateString?: string | null, targetTimezone?: string): string {
  if (!dateString || typeof dateString !== "string") return "";
  const trimmed = dateString.trim();
  if (!trimmed) return "";

  const date = parseSafeDate(trimmed);
  if (!date) return "";

  const timeZone = targetTimezone || getTimezonePreference();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
    const tzLabel = getTimezoneLabel(timeZone, date);
    return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()} ${tzLabel}`;
  } catch {
    return "";
  }
}

export function formatRelativeTime(dateString?: string | null, targetTimezone?: string): string {
  const date = parseSafeDate(dateString);
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return formatDate(dateString, targetTimezone);
  if (diffDay > 1) return `${diffDay} days ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffHour >= 1) return `${diffHour}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return "Just now";
}

/**
 * Produces YYYY-MM-DDTHH:mm format in the user's selected time zone for datetime-local input controls.
 */
export function toDatetimeLocalValue(dateString?: string | null, targetTimezone?: string): string {
  const date = dateString ? parseSafeDate(dateString) : new Date();
  if (!date || isNaN(date.getTime())) return "";

  const timeZone = targetTimezone || getTimezonePreference();
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);

    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "";
    let hour = getPart("hour");
    if (hour === "24") hour = "00";
    return `${getPart("year")}-${getPart("month")}-${getPart("day")}T${hour}:${getPart("minute")}`;
  } catch {
    return "";
  }
}

/**
 * Converts a datetime-local input value entered in sourceTimezone to an exact ISO-8601 UTC string.
 */
export function fromDatetimeLocalToIso(localString?: string | null, sourceTimezone?: string): string | null {
  if (!localString || !localString.trim()) return null;
  const match = localString.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const [_, y, m, d, hh, mm, ss] = match;

  const timeZone = sourceTimezone || getTimezonePreference();
  try {
    const tentativeUtc = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +(ss || 0)));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(tentativeUtc);

    const get = (t: string) => parts.find((p) => p.type === t)?.value || "0";
    let h = +get("hour");
    if (h === 24) h = 0;
    const asTz = new Date(Date.UTC(+get("year"), +get("month") - 1, +get("day"), h, +get("minute"), +get("second")));
    const diffMs = tentativeUtc.getTime() - asTz.getTime();
    const exactUtc = new Date(tentativeUtc.getTime() + diffMs);
    return exactUtc.toISOString();
  } catch {
    return null;
  }
}
