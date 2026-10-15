import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface ParsedTimestamp {
  type: "aware" | "naive";
  date?: Date;
  year?: number;
  month?: string;
  day?: number;
  hour?: number | null;
  minute?: number | null;
}

/**
 * Parses timestamps safely without blindly appending 'Z' or assuming naive dates are UTC.
 * Returns null for missing, null, or invalid date strings.
 */
export function parseSafeDate(dateString?: string | null): Date | null {
  if (!dateString || typeof dateString !== "string") return null;
  const trimmed = dateString.trim();
  if (!trimmed) return null;

  // If timestamp has explicit timezone offset or Z
  const hasTimezone = /(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
  if (hasTimezone) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle naive ISO or SQL space format by parsing components without appending 'Z'
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [_, y, m, d, hh, mm, ss] = match;
    const year = parseInt(y, 10);
    const month = parseInt(m, 10) - 1;
    const day = parseInt(d, 10);
    const hour = hh ? parseInt(hh, 10) : 0;
    const minute = mm ? parseInt(mm, 10) : 0;
    const second = ss ? parseInt(ss, 10) : 0;
    const date = new Date(year, month, day, hour, minute, second);
    return isNaN(date.getTime()) ? null : date;
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function parseTimestampDetails(dateString?: string | null): ParsedTimestamp | null {
  if (!dateString || typeof dateString !== "string") return null;
  const trimmed = dateString.trim();
  if (!trimmed) return null;

  const hasTimezone = /(Z|[+-]\d{2}(?::?\d{2})?)$/i.test(trimmed);
  if (hasTimezone) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : { type: "aware", date: d };
  }

  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (match) {
    const [_, y, m, d, hh, mm] = match;
    const monthIdx = parseInt(m, 10) - 1;
    if (monthIdx < 0 || monthIdx > 11) return null;
    return {
      type: "naive",
      year: parseInt(y, 10),
      month: MONTH_NAMES[monthIdx],
      day: parseInt(d, 10),
      hour: hh !== undefined ? parseInt(hh, 10) : null,
      minute: mm !== undefined ? parseInt(mm, 10) : null,
    };
  }

  const fallback = new Date(trimmed);
  return isNaN(fallback.getTime()) ? null : { type: "aware", date: fallback };
}

/**
 * Formats date strictly in Asia/Kolkata (IST) with a clear 'IST' label.
 * Returns empty string for empty/null/invalid inputs without fabricating dates.
 */
export function formatDate(dateString?: string | null): string {
  const parsed = parseTimestampDetails(dateString);
  if (!parsed) return "";

  if (parsed.type === "aware" && parsed.date) {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(parsed.date);
    return `${formatted} IST`;
  }

  return `${parsed.month} ${parsed.day}, ${parsed.year} (No TZ)`;
}

/**
 * Formats date and time strictly in Asia/Kolkata (IST) with a clear 'IST' label.
 * Returns empty string for empty/null/invalid inputs without fabricating dates.
 */
export function formatDateTime(dateString?: string | null): string {
  const parsed = parseTimestampDetails(dateString);
  if (!parsed) return "";

  if (parsed.type === "aware" && parsed.date) {
    const formatted = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(parsed.date);
    return `${formatted} IST`;
  }

  let timeStr = "";
  if (parsed.hour !== null && parsed.hour !== undefined && parsed.minute !== null && parsed.minute !== undefined) {
    const period = parsed.hour >= 12 ? "PM" : "AM";
    const h12 = parsed.hour % 12 || 12;
    const mm = String(parsed.minute).padStart(2, "0");
    const hh = String(h12).padStart(2, "0");
    timeStr = `, ${hh}:${mm} ${period}`;
  }
  return `${parsed.month} ${parsed.day}, ${parsed.year}${timeStr} (No TZ)`;
}

export function formatRelativeTime(dateString?: string | null): string {
  const date = parseSafeDate(dateString);
  if (!date) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffDay > 30) return formatDate(dateString);
  if (diffDay > 1) return `${diffDay} days ago`;
  if (diffDay === 1) return "Yesterday";
  if (diffHour >= 1) return `${diffHour}h ago`;
  if (diffMin >= 1) return `${diffMin}m ago`;
  return "Just now";
}

/**
 * Produces YYYY-MM-DDTHH:mm format in Asia/Kolkata (IST) for datetime-local input controls.
 */
export function toDatetimeLocalValue(dateString?: string | null): string {
  const date = dateString ? parseSafeDate(dateString) : new Date();
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
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
}

/**
 * Converts a datetime-local input value entered in IST to an exact ISO-8601 UTC string.
 */
export function fromDatetimeLocalToIso(localString?: string | null): string | null {
  if (!localString || !localString.trim()) return null;
  const trimmed = localString.trim();
  const istString = `${trimmed}:00+05:30`;
  const date = new Date(istString);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
