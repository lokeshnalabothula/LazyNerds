import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

test.describe("Settings Page Organization & Telemetry Integrity (LNA-14)", () => {
  const settingsPath = fs.existsSync(path.join(process.cwd(), "app/settings/page.tsx"))
    ? path.join(process.cwd(), "app/settings/page.tsx")
    : path.join(process.cwd(), "frontend/app/settings/page.tsx");
  const settingsSource = fs.readFileSync(settingsPath, "utf-8");

  test("Settings defines distinct sections for account, preferences, security, health, audit, and all", () => {
    assert.match(settingsSource, /"account"/);
    assert.match(settingsSource, /"preferences"/);
    assert.match(settingsSource, /"security"/);
    assert.match(settingsSource, /"health"/);
    assert.match(settingsSource, /"audit"/);
    assert.match(settingsSource, /"all"/);
  });

  test("Settings provides master-detail desktop sidebar without horizontal pill collisions", () => {
    assert.match(settingsSource, /<aside[^>]*id="settings-sidebar"[^>]*className="[^"]*hidden xl:block[^"]*"/);
    assert.match(settingsSource, /Settings Navigation/);
    assert.match(settingsSource, /min-h-\[40px\]/);
    // Eliminates overflowing horizontal pill strips that caused desktop text collision
    assert.doesNotMatch(settingsSource, /overflow-x-auto/);
  });

  test("Settings provides mobile, tablet, and compact laptop select navigation for 100% discoverability at narrow widths", () => {
    assert.match(settingsSource, /<div className="w-full xl:hidden">/);
    assert.match(settingsSource, /<select/);
    assert.match(settingsSource, /id="mobile-settings-nav"/);
    assert.match(settingsSource, /min-h-\[44px\]/);
  });

  test("Header workspace badges are dynamically sourced and avoid hardcoded static labels", () => {
    assert.doesNotMatch(settingsSource, /FIXOPS ENTERPRISE/);
    assert.doesNotMatch(settingsSource, /"v2\.1\.0"/);
    assert.match(settingsSource, /healthStatus\?\.environment/);
    assert.match(settingsSource, /healthStatus\?\.version/);
  });

  test("Diagnostics are dynamically sourced from api.getHealth and do not hardcode fake operational version", () => {
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
