import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseSafeDate(dateString?: string | null): Date | null {
  if (!dateString) return null;
  let normalized = dateString.trim();
  if (normalized.includes(" ") && !normalized.includes("T")) {
    normalized = normalized.replace(" ", "T");
  }
  if (!normalized.endsWith("Z") && !/[+-]\d{2}(:\d{2})?$/.test(normalized)) {
    normalized = `${normalized}Z`;
  }
  const date = new Date(normalized);
  return isNaN(date.getTime()) ? null : date;
}

export function formatDate(dateString?: string | null): string {
  const date = parseSafeDate(dateString);
  if (!date) return dateString || "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateString?: string | null): string {
  const date = parseSafeDate(dateString);
  if (!date) return dateString || "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
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

export function toDatetimeLocalValue(dateString?: string | null): string {
  const date = dateString ? parseSafeDate(dateString) : new Date();
  if (!date) return "";
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const DD = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
}

export function fromDatetimeLocalToIso(localString?: string | null): string | null {
  if (!localString) return null;
  const date = new Date(localString);
  return isNaN(date.getTime()) ? null : date.toISOString();
}
