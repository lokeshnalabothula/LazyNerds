import { test } from "node:test";
import assert from "node:assert";
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  parseSafeDate,
  toDatetimeLocalValue,
  fromDatetimeLocalToIso,
  getTimezoneLabel,
  getTimezonePreference,
  DEFAULT_TIMEZONE,
  isDateOnly,
} from "../lib/utils.ts";

test("1. A UTC timestamp displayed in IST", () => {
  // 10:00 UTC + 5:30 = 15:30 (3:30 PM) IST
  const result = formatDateTime("2026-10-14T10:00:00Z", "Asia/Kolkata");
  assert.strictEqual(result, "14 Oct 2026, 03:30 PM IST");

  const dateResult = formatDate("2026-10-14T10:00:00Z", "Asia/Kolkata");
  assert.strictEqual(dateResult, "14 Oct 2026");
});

test("2. A UTC timestamp displayed in another selected time zone (EDT, PDT, UTC, JST)", () => {
  // 14:30 UTC in New York (EDT, UTC-4) is 10:30 AM
  const nyResult = formatDateTime("2026-10-17T14:30:00Z", "America/New_York");
  assert.strictEqual(nyResult, "17 Oct 2026, 10:30 AM EDT");

  // 14:30 UTC in Los Angeles (PDT, UTC-7) is 7:30 AM
  const laResult = formatDateTime("2026-10-17T14:30:00Z", "America/Los_Angeles");
  assert.strictEqual(laResult, "17 Oct 2026, 07:30 AM PDT");

  // 14:30 UTC in UTC is 02:30 PM UTC
  const utcResult = formatDateTime("2026-10-17T14:30:00Z", "UTC");
  assert.strictEqual(utcResult, "17 Oct 2026, 02:30 PM UTC");

  // 14:30 UTC in Tokyo (JST, UTC+9) is 11:30 PM (23:30)
  const tokyoResult = formatDateTime("2026-10-17T14:30:00Z", "Asia/Tokyo");
  assert.ok(tokyoResult.includes("17 Oct 2026, 11:30 PM"));
  assert.ok(!tokyoResult.includes("IST"), "Never append IST to non-Kolkata timestamp");
});

test("3. Browser-detected time-zone and fallback to Asia/Kolkata", () => {
  // DEFAULT_TIMEZONE must be Asia/Kolkata
  assert.strictEqual(DEFAULT_TIMEZONE, "Asia/Kolkata");

  // When no window/browser or storage exists, preference defaults to Asia/Kolkata
  const pref = getTimezonePreference();
  assert.strictEqual(pref, "Asia/Kolkata");
});

test("4. Day-boundary changes between UTC and IST", () => {
  // 20:23 UTC on Oct 13 + 5:30 = 01:53 IST on Oct 14
  const istDateTime = formatDateTime("2026-10-13T20:23:06.770Z", "Asia/Kolkata");
  assert.strictEqual(istDateTime, "14 Oct 2026, 01:53 AM IST");

  const istDate = formatDate("2026-10-13T20:23:06.770Z", "Asia/Kolkata");
  assert.strictEqual(istDate, "14 Oct 2026");

  // Same timestamp in New York (UTC-4) is still Oct 13 (4:23 PM)
  const nyDate = formatDate("2026-10-13T20:23:06.770Z", "America/New_York");
  assert.strictEqual(nyDate, "13 Oct 2026");

  const nyDateTime = formatDateTime("2026-10-13T20:23:06.770Z", "America/New_York");
  assert.strictEqual(nyDateTime, "13 Oct 2026, 04:23 PM EDT");
});

test("5. Date-only fields do NOT shift to previous or next calendar day", () => {
  const dateOnly = "2026-10-17";
  assert.strictEqual(isDateOnly(dateOnly), true);

  // In IST
  assert.strictEqual(formatDate(dateOnly, "Asia/Kolkata"), "17 Oct 2026");

  // In US Pacific (UTC-7/8) - must NEVER shift to Oct 16
  assert.strictEqual(formatDate(dateOnly, "America/Los_Angeles"), "17 Oct 2026");

  // In Tokyo (UTC+9) - must NEVER shift to Oct 18
  assert.strictEqual(formatDate(dateOnly, "Asia/Tokyo"), "17 Oct 2026");

  // Must not have '(No TZ)' appended
  assert.ok(!formatDate(dateOnly).includes("No TZ"));
});

test("6. Invalid and missing timestamps handled gracefully", () => {
  assert.strictEqual(formatDate(""), "");
  assert.strictEqual(formatDate(null), "");
  assert.strictEqual(formatDate(undefined), "");
  assert.strictEqual(formatDate("invalid-date-string"), "");
  assert.strictEqual(formatDate("not-a-timestamp"), "");

  assert.strictEqual(formatDateTime(""), "");
  assert.strictEqual(formatDateTime(null), "");
  assert.strictEqual(formatDateTime(undefined), "");
  assert.strictEqual(formatDateTime("invalid-date-string"), "");
  assert.strictEqual(formatDateTime("garbage"), "");
});

test("7. Naive database timestamps are treated as UTC and converted to active timezone", () => {
  // Naive ISO timestamp (from SQLite or un-annotated DB): represents 10:00 UTC
  const naiveIso = "2026-10-14T10:00:00";
  // 10:00 UTC + 5:30 = 15:30 (3:30 PM) in IST
  assert.strictEqual(formatDateTime(naiveIso, "Asia/Kolkata"), "14 Oct 2026, 03:30 PM IST");

  // Naive SQL space format
  const naiveSql = "2026-05-01 12:30:00";
  // 12:30 UTC + 5:30 = 18:00 (6:00 PM) in IST
  assert.strictEqual(formatDateTime(naiveSql, "Asia/Kolkata"), "1 May 2026, 06:00 PM IST");
});

test("8. toDatetimeLocalValue converts UTC ISO to local datetime-local format in target timezone", () => {
  const utcIso = "2026-10-17T14:30:00.000Z";

  // In Asia/Kolkata (+5:30) => 20:00
  assert.strictEqual(toDatetimeLocalValue(utcIso, "Asia/Kolkata"), "2026-10-17T20:00");

  // In America/New_York (-4:00 EDT) => 10:30
  assert.strictEqual(toDatetimeLocalValue(utcIso, "America/New_York"), "2026-10-17T10:30");

  // In UTC => 14:30
  assert.strictEqual(toDatetimeLocalValue(utcIso, "UTC"), "2026-10-17T14:30");
});

test("9. fromDatetimeLocalToIso converts local input back to exact UTC ISO", () => {
  // 20:00 in IST is 14:30 UTC
  const utcFromIst = fromDatetimeLocalToIso("2026-10-17T20:00", "Asia/Kolkata");
  assert.strictEqual(utcFromIst, "2026-10-17T14:30:00.000Z");

  // 10:30 in EDT is 14:30 UTC
  const utcFromNy = fromDatetimeLocalToIso("2026-10-17T10:30", "America/New_York");
  assert.strictEqual(utcFromNy, "2026-10-17T14:30:00.000Z");

  assert.strictEqual(fromDatetimeLocalToIso(""), null);
  assert.strictEqual(fromDatetimeLocalToIso(null), null);
});

test("10. getTimezoneLabel returns accurate standard abbreviations", () => {
  const d = new Date("2026-10-17T14:30:00Z");
  assert.strictEqual(getTimezoneLabel("Asia/Kolkata", d), "IST");
  assert.strictEqual(getTimezoneLabel("UTC", d), "UTC");
  assert.strictEqual(getTimezoneLabel("America/New_York", d), "EDT");
  assert.strictEqual(getTimezoneLabel("America/Los_Angeles", d), "PDT");
});

test("11. formatRelativeTime handles recent and older dates", () => {
  const now = new Date();
  const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  assert.strictEqual(formatRelativeTime(fiveMinAgo), "5m ago");

  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  assert.strictEqual(formatRelativeTime(twoHoursAgo), "2h ago");

  const oldDate = "2026-01-01T10:00:00Z";
  assert.strictEqual(formatRelativeTime(oldDate, "Asia/Kolkata"), "1 Jan 2026");
});
