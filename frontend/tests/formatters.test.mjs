import { test } from "node:test";
import assert from "node:assert";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  parseSafeDate,
  parseTimestampDetails,
  toDatetimeLocalValue,
  fromDatetimeLocalToIso,
} from "../lib/utils.ts";

test("formatDate formats UTC ISO timestamp in Asia/Kolkata with IST label", () => {
  const result = formatDate("2026-10-14T10:00:00Z");
  assert.strictEqual(result, "Oct 14, 2026 IST");
});

test("formatDate handles date-boundary change when crossing UTC to IST", () => {
  // 20:23 UTC on Oct 13 + 5:30 = 01:53 IST on Oct 14
  const result = formatDate("2026-10-13T20:23:06.770Z");
  assert.strictEqual(result, "Oct 14, 2026 IST");
});

test("formatDateTime formats full date and time with clear IST label", () => {
  const result = formatDateTime("2026-10-13T20:23:06.770Z");
  assert.strictEqual(result, "Oct 14, 2026, 01:53 AM IST");
});

test("formatDate handles null, empty, or undefined safely without fabricated dates", () => {
  assert.strictEqual(formatDate(""), "");
  assert.strictEqual(formatDate(null), "");
  assert.strictEqual(formatDate(undefined), "");
  assert.strictEqual(formatDateTime(""), "");
  assert.strictEqual(formatDateTime(null), "");
  assert.strictEqual(formatDateTime(undefined), "");
});

test("formatDate and formatDateTime safely reject invalid strings without fabricated dates", () => {
  assert.strictEqual(formatDate("invalid-date-string"), "");
  assert.strictEqual(formatDate("not-a-timestamp"), "");
  assert.strictEqual(formatDateTime("invalid-date-string"), "");
});

test("naive timestamps are handled safely without blindly appending Z or shifting timezone", () => {
  // Naive ISO without timezone offset
  const naiveIso = "2026-10-14T10:00:00";
  assert.strictEqual(formatDate(naiveIso), "Oct 14, 2026 (No TZ)");
  assert.strictEqual(formatDateTime(naiveIso), "Oct 14, 2026, 10:00 AM (No TZ)");

  // Naive SQL space-separated format
  const naiveSql = "2026-05-01 12:30:00";
  assert.strictEqual(formatDate(naiveSql), "May 1, 2026 (No TZ)");
  assert.strictEqual(formatDateTime(naiveSql), "May 1, 2026, 12:30 PM (No TZ)");
});

test("parseSafeDate correctly returns Date object for timezone-aware strings", () => {
  const d1 = parseSafeDate("2026-10-14T10:00:00Z");
  assert.ok(d1 instanceof Date);
  assert.strictEqual(d1.toISOString(), "2026-10-14T10:00:00.000Z");

  const d2 = parseSafeDate("2026-10-14T15:30:00+05:30");
  assert.ok(d2 instanceof Date);
  assert.strictEqual(d2.toISOString(), "2026-10-14T10:00:00.000Z");

  assert.strictEqual(parseSafeDate(""), null);
  assert.strictEqual(parseSafeDate(null), null);
  assert.strictEqual(parseSafeDate("garbage-string"), null);
});

test("fromDatetimeLocalToIso converts IST datetime-local input to accurate UTC ISO-8601", () => {
  // 14:30 IST is 09:00 UTC
  const iso = fromDatetimeLocalToIso("2026-06-15T14:30");
  assert.strictEqual(iso, "2026-06-15T09:00:00.000Z");

  assert.strictEqual(fromDatetimeLocalToIso(""), null);
  assert.strictEqual(fromDatetimeLocalToIso(null), null);
});

test("toDatetimeLocalValue produces YYYY-MM-DDTHH:mm in IST", () => {
  // 08:15 UTC + 5:30 = 13:45 IST
  const val = toDatetimeLocalValue("2025-04-12T08:15:00Z");
  assert.strictEqual(val, "2025-04-12T13:45");
});
