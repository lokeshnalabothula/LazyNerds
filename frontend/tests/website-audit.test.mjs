import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function validateUrlSsrf(inputUrl) {
  const trimmed = (inputUrl || "").trim();
  if (!trimmed) {
    return { isValid: false, message: "URL cannot be empty", severity: "neutral" };
  }
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
    return {
      isValid: false,
      message: "Invalid URL protocol. Only standard http:// and https:// URLs are supported.",
      severity: "error",
    };
  }
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("file:") ||
    lower.startsWith("data:") ||
    lower.startsWith("ftp:")
  ) {
    return {
      isValid: false,
      message: "Dangerous URI scheme detected. Target is strictly blocked by security policy.",
      severity: "critical",
    };
  }
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "[::1]" ||
      host.includes("::") ||
      host.endsWith(".localhost")
    ) {
      return {
        isValid: false,
        message: "SSRF Violation: Localhost and loopback interfaces cannot be targeted.",
        severity: "critical",
      };
    }
    if (
      host === "169.254.169.254" ||
      host === "169.254.170.2" ||
      host === "100.100.100.200" ||
      host.includes("metadata.google.internal") ||
      host.includes("instance-data")
    ) {
      return {
        isValid: false,
        message: "SSRF Violation: Cloud instance metadata addresses are strictly prohibited.",
        severity: "critical",
      };
    }
    if (
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return {
        isValid: false,
        message: "SSRF Violation: Private RFC 1918 subnets are restricted.",
        severity: "critical",
      };
    }
    return {
      isValid: true,
      message: `Authorized Web Target: ${host}`,
      severity: "success",
      hostname: host,
    };
  } catch {
    return {
      isValid: false,
      message: "Malformed URL syntax.",
      severity: "error",
    };
  }
}

describe("Website Audit URL Validation & SSRF Guard", () => {
  test("accepts valid public HTTP and HTTPS URLs", () => {
    const valid1 = validateUrlSsrf("https://example.com");
    assert.equal(valid1.isValid, true);
    assert.equal(valid1.severity, "success");

    const valid2 = validateUrlSsrf("https://subdomain.company.org/portal?tab=login");
    assert.equal(valid2.isValid, true);

    const valid3 = validateUrlSsrf("http://test.fixops.io:8080/app");
    assert.equal(valid3.isValid, true);
  });

  test("rejects dangerous non-HTTP protocols", () => {
    assert.equal(validateUrlSsrf("javascript:alert(1)").isValid, false);
    assert.equal(validateUrlSsrf("file:///etc/passwd").isValid, false);
    assert.equal(validateUrlSsrf("data:text/html,<script>alert(1)</script>").isValid, false);
    assert.equal(validateUrlSsrf("ftp://internal.vault/data").isValid, false);
  });

  test("rejects localhost and loopback targets", () => {
    assert.equal(validateUrlSsrf("http://localhost:8000").isValid, false);
    assert.equal(validateUrlSsrf("https://127.0.0.1:3000").isValid, false);
    assert.equal(validateUrlSsrf("http://[::1]/admin").isValid, false);
    assert.equal(validateUrlSsrf("http://app.localhost").isValid, false);
  });

  test("rejects cloud provider instance metadata targets", () => {
    assert.equal(validateUrlSsrf("http://169.254.169.254/latest/meta-data/").isValid, false);
    assert.equal(validateUrlSsrf("http://metadata.google.internal/computeMetadata/v1/").isValid, false);
    assert.equal(validateUrlSsrf("http://100.100.100.200/latest/meta-data/").isValid, false);
  });

  test("rejects private RFC 1918 IP addresses", () => {
    assert.equal(validateUrlSsrf("http://10.0.0.5:8080").isValid, false);
    assert.equal(validateUrlSsrf("https://192.168.1.1").isValid, false);
    assert.equal(validateUrlSsrf("http://172.16.0.10").isValid, false);
    assert.equal(validateUrlSsrf("http://172.31.255.254").isValid, false);
  });
});

describe("Website Audit Action Hierarchy & RoE Compliance", () => {
  const cwd = process.cwd();
  const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");

  test("Website Audit page features single prominent primary action (Launch Website Audit)", () => {
    const pageCode = fs.readFileSync(path.join(frontendDir, "app", "audit", "page.tsx"), "utf8");

    assert.ok(
      pageCode.includes('variant="primary"') && pageCode.includes("Launch Website Audit"),
      "Must have primary action 'Launch Website Audit'"
    );

    // Other actions must be outline/subordinate
    assert.ok(
      pageCode.includes('variant="outline"') && pageCode.includes("View All Engagements"),
      "View All Engagements must be subordinate variant='outline'"
    );

    // Action button disabled condition enforces valid URL and confirmed RoE
    assert.ok(
      pageCode.includes("!urlValidation.isValid") && pageCode.includes("!confirmedAuth"),
      "Submit button must be disabled until URL is valid and RoE authorization is confirmed"
    );
  });

  test("Mandatory Rules of Engagement (RoE) Certification checkbox is present and required", () => {
    const pageCode = fs.readFileSync(path.join(frontendDir, "app", "audit", "page.tsx"), "utf8");

    assert.ok(
      pageCode.includes("Mandatory Rules of Engagement (RoE) Certification"),
      "RoE certification declaration text must be present"
    );
    assert.ok(
      pageCode.includes("confirmedAuth"),
      "Form state must track confirmedAuth checkbox"
    );
    assert.ok(
      pageCode.includes("id=\"confirm-auth\"") && pageCode.includes("required"),
      "RoE checkbox must be marked required in the form"
    );
  });

  test("Sidebar includes Website Audit navigation item with /audit route and scan badge", () => {
    const sidebarCode = fs.readFileSync(
      path.join(frontendDir, "components", "layout", "sidebar.tsx"),
      "utf8"
    );

    assert.ok(sidebarCode.includes('"Website Audit"'), "Sidebar must include 'Website Audit'");
    assert.ok(sidebarCode.includes('href: "/audit"'), "Sidebar item must navigate to /audit");
    assert.ok(sidebarCode.includes('badge: "Scan"'), "Sidebar item must display 'Scan' badge");
  });

  test("API client exports submitWebsiteAudit method", () => {
    const apiCode = fs.readFileSync(path.join(frontendDir, "lib", "api.ts"), "utf8");

    assert.ok(
      apiCode.includes("submitWebsiteAudit(input: WebsiteAuditInput)"),
      "API client must implement submitWebsiteAudit"
    );
    assert.ok(
      apiCode.includes("/engagements/website-audit"),
      "API client must target /engagements/website-audit endpoint"
    );
  });
});
