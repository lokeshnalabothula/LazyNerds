import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test.describe("Settings Page Organization & Telemetry Integrity (LNA-14)", () => {
  const settingsPath = fs.existsSync(path.join(process.cwd(), "app/settings/page.tsx"))
    ? path.join(process.cwd(), "app/settings/page.tsx")
    : path.join(process.cwd(), "frontend/app/settings/page.tsx");
  const settingsSource = fs.readFileSync(settingsPath, "utf-8");

  test("Settings defines distinct sections for account, preferences, security, health, and audit", () => {
    assert.match(settingsSource, /"account"/);
    assert.match(settingsSource, /"preferences"/);
    assert.match(settingsSource, /"security"/);
    assert.match(settingsSource, /"health"/);
    assert.match(settingsSource, /"audit"/);
    assert.match(settingsSource, /"all"/);
  });

  test("Settings provides responsive tab bar with full labels for desktop and compact labels for mobile", () => {
    assert.match(settingsSource, /tab\.label/);
    assert.match(settingsSource, /tab\.shortLabel/);
    assert.match(settingsSource, /overflow-x-auto/);
    assert.match(settingsSource, /min-h-\[38px\]/);
  });

  test("Diagnostics are dynamically sourced from api.getHealth and do not hardcode fake operational version", () => {
    // Verifies that healthStatus?.version and healthStatus?.service are used rather than hardcoded 'Operational (FixOps v2.0.0)'
    assert.doesNotMatch(settingsSource, /Operational \(FixOps v2\.0\.0\)/);
    assert.match(settingsSource, /healthStatus\?\.version/);
    assert.match(settingsSource, /healthStatus\?\.service/);
    assert.match(settingsSource, /healthStatus\?\.commit/);
    assert.match(settingsSource, /healthStatus\?\.database === "connected"/);
  });

  test("Schema revision is accurately labeled as server-side managed without faking operational probe", () => {
    assert.match(settingsSource, /managed server-side/);
  });

  test("Security tab maintains single prominent primary action for password update", () => {
    // Only Update Password has btn-glossy-gold
    const glossyMatches = settingsSource.match(/btn-glossy-gold/g) || [];
    assert.equal(glossyMatches.length, 1);
    assert.match(settingsSource, /Update Password/);
  });

  test("Preferences section integrates timezone configuration with live sample timestamp", () => {
    assert.match(settingsSource, /SUPPORTED_TIMEZONES/);
    assert.match(settingsSource, /setTimezonePreference/);
    assert.match(settingsSource, /formatDateTime\(new Date\(\)\.toISOString\(\), effectiveTz\)/);
  });
});
