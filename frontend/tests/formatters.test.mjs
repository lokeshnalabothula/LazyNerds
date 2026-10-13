import { test } from "node:test";
import assert from "node:assert";

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

test("formatDate handles valid ISO dates", () => {
  const result = formatDate("2026-10-14T10:00:00Z");
  assert.strictEqual(result, "Oct 14, 2026");
});

test("formatDate handles empty or null strings safely", () => {
  assert.strictEqual(formatDate(""), "");
  assert.strictEqual(formatDate(null), "");
});

test("formatDate preserves invalid strings without crashing", () => {
  assert.strictEqual(formatDate("invalid-date"), "invalid-date");
});

function parseSafeDate(dateString) {
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

function fromDatetimeLocalToIso(localString) {
  if (!localString) return null;
  const date = new Date(localString);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

function toDatetimeLocalValue(dateString) {
  const date = dateString ? parseSafeDate(dateString) : new Date();
  if (!date) return "";
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, "0");
  const DD = String(date.getDate()).padStart(2, "0");
  const HH = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}T${HH}:${mm}`;
}

test("parseSafeDate correctly handles ISO and space-separated SQLite dates", () => {
  const d1 = parseSafeDate("2026-10-14T10:00:00Z");
  assert.ok(d1 instanceof Date);
  assert.strictEqual(d1.getUTCFullYear(), 2026);

  const d2 = parseSafeDate("2026-05-01 12:30:00");
  assert.ok(d2 instanceof Date);
  assert.strictEqual(d2.getUTCFullYear(), 2026);
  assert.strictEqual(d2.getUTCMonth(), 4);

  assert.strictEqual(parseSafeDate(""), null);
  assert.strictEqual(parseSafeDate(null), null);
  assert.strictEqual(parseSafeDate("gibberish-string"), null);
});

test("fromDatetimeLocalToIso converts local datetime string to valid ISO-8601", () => {
  const iso = fromDatetimeLocalToIso("2026-06-15T14:30");
  assert.ok(iso.includes("2026-06-15"));
  assert.ok(iso.endsWith("Z"));

  assert.strictEqual(fromDatetimeLocalToIso(""), null);
  assert.strictEqual(fromDatetimeLocalToIso(null), null);
});

test("toDatetimeLocalValue produces YYYY-MM-DDTHH:mm format", () => {
  const val = toDatetimeLocalValue("2025-04-12T08:15:00Z");
  assert.match(val, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
