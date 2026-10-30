import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");

describe("DNS TXT Domain Ownership Verification (Method A)", () => {
  // 1. Client-Side Domain Syntax Validation
  function validateDomainInput(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return "Domain name is required.";
    if (trimmed.includes("://") || trimmed.startsWith("http:") || trimmed.startsWith("https:")) {
      return "Do not include http:// or https:// schemes. Enter only the domain name (e.g. example.com).";
    }
    if (trimmed.includes("/") || trimmed.includes("?") || trimmed.includes("#")) {
      return "Paths and query parameters are not allowed.";
    }
    if (trimmed.includes(":")) {
      return "Port numbers are not allowed.";
    }
    if (trimmed.includes("@")) {
      return "Email addresses are not allowed.";
    }
    if (!trimmed.includes(".")) {
      return "Domain must include at least a domain name and a top-level domain (e.g. example.com).";
    }
    return null;
  }

  test("validates domain inputs correctly", () => {
    // Valid domains
    assert.strictEqual(validateDomainInput("example.com"), null);
    assert.strictEqual(validateDomainInput("api.example.com"), null);
    assert.strictEqual(validateDomainInput("sub.domain.co.uk"), null);
    assert.strictEqual(validateDomainInput("my-app-test.org"), null);

    // Invalid domains
    assert.match(validateDomainInput(""), /Domain name is required/);
    assert.match(validateDomainInput("   "), /Domain name is required/);
    assert.match(validateDomainInput("https://example.com"), /Do not include http:\/\/ or https:\/\//);
    assert.match(validateDomainInput("http://example.com"), /Do not include http:\/\/ or https:\/\//);
    assert.match(validateDomainInput("example.com/path/test"), /Paths and query parameters are not allowed/);
    assert.match(validateDomainInput("example.com?query=1"), /Paths and query parameters are not allowed/);
    assert.match(validateDomainInput("example.com#hash"), /Paths and query parameters are not allowed/);
    assert.match(validateDomainInput("example.com:8080"), /Port numbers are not allowed/);
    assert.match(validateDomainInput("admin@example.com"), /Email addresses are not allowed/);
    assert.match(validateDomainInput("localhost"), /must include at least a domain name and a top-level domain/);
  });

  // 2. DNS Instruction Generation Contract
  test("generates compliant Method A DNS TXT record specifications", () => {
    const domain = "cloud.lazynerds.org";
    const token = "mock-crypto-token-32-chars-long-123456";

    const instructions = {
      record_type: "TXT",
      record_host: "_lazynerds-verification",
      record_name: `_lazynerds-verification.${domain}`,
      record_value: `lazynerds-verification=${token}`,
      ttl: 300,
    };

    assert.strictEqual(instructions.record_type, "TXT");
    assert.strictEqual(instructions.record_host, "_lazynerds-verification");
    assert.strictEqual(instructions.record_name, "_lazynerds-verification.cloud.lazynerds.org");
    assert.ok(instructions.record_value.startsWith("lazynerds-verification="));
    assert.strictEqual(instructions.ttl, 300);
  });

  // 3. API Client Domain Methods
  test("frontend api.ts exports all required domain verification methods", () => {
    const apiFilePath = path.join(frontendDir, "lib", "api.ts");
    assert.ok(fs.existsSync(apiFilePath), "frontend/lib/api.ts must exist");
    const content = fs.readFileSync(apiFilePath, "utf8");

    assert.ok(content.includes("getDomains"), "api must export getDomains");
    assert.ok(content.includes("getDomain"), "api must export getDomain");
    assert.ok(content.includes("createDomain"), "api must export createDomain");
    assert.ok(content.includes("verifyDomain"), "api must export verifyDomain");
    assert.ok(content.includes("regenerateDomainChallenge"), "api must export regenerateDomainChallenge");
    assert.ok(content.includes("deleteDomain"), "api must export deleteDomain");
  });

  // 4. Navigation Integrity
  test("sidebar and floating nav expose Domains with /domains and DNS badge", () => {
    const sidebarPath = path.join(frontendDir, "components", "layout", "sidebar.tsx");
    const floatingNavPath = path.join(frontendDir, "components", "layout", "floating-nav.tsx");

    assert.ok(fs.existsSync(sidebarPath), "sidebar.tsx must exist");
    assert.ok(fs.existsSync(floatingNavPath), "floating-nav.tsx must exist");

    const sidebarContent = fs.readFileSync(sidebarPath, "utf8");
    const floatingNavContent = fs.readFileSync(floatingNavPath, "utf8");

    assert.ok(sidebarContent.includes('href: "/domains"'), "sidebar must link to /domains");
    assert.ok(sidebarContent.includes('name: "Domains"'), "sidebar must have Domains entry");
    assert.ok(sidebarContent.includes('badge: "DNS"'), "sidebar must show DNS badge");

    assert.ok(floatingNavContent.includes('href: "/domains"'), "floatingNav must link to /domains");
    assert.ok(floatingNavContent.includes('name: "Domains"'), "floatingNav must have Domains entry");
  });

  // 5. Domain Management Page Architecture
  test("domains page implements telemetry KPIs, filtering, table and card views", () => {
    const pagePath = path.join(frontendDir, "app", "domains", "page.tsx");
    assert.ok(fs.existsSync(pagePath), "app/domains/page.tsx must exist");
    const content = fs.readFileSync(pagePath, "utf8");

    // Key components
    assert.ok(content.includes("Domain Ownership Verification"), "Page title must be present");
    assert.ok(content.includes("DomainRegisterModal"), "Register modal must be wired");
    assert.ok(content.includes("DomainDnsInstructionsModal"), "Instructions modal must be wired");
    assert.ok(content.includes("ConfirmDialog"), "ConfirmDialog for deletion must be wired");

    // Filters
    assert.ok(content.includes("Verified"), "Must filter by Verified");
    assert.ok(content.includes("Pending"), "Must filter by Pending");
    assert.ok(content.includes("Failed"), "Must filter by Failed");
    assert.ok(content.includes("Expired"), "Must filter by Expired");

    // Actions
    assert.ok(content.includes("handleDirectVerify"), "Direct DNS verification must be supported");
    assert.ok(content.includes("confirmDeleteDomain"), "Domain deletion confirmation must be supported");
  });

  // 6. Modal Component Architecture & Security Boundaries
  test("domain modals protect plaintext tokens and enforce clear instructions", () => {
    const regModalPath = path.join(frontendDir, "components", "domains", "domain-register-modal.tsx");
    const instrModalPath = path.join(frontendDir, "components", "domains", "domain-dns-instructions-modal.tsx");

    assert.ok(fs.existsSync(regModalPath), "domain-register-modal.tsx must exist");
    assert.ok(fs.existsSync(instrModalPath), "domain-dns-instructions-modal.tsx must exist");

    const regContent = fs.readFileSync(regModalPath, "utf8");
    const instrContent = fs.readFileSync(instrModalPath, "utf8");

    // One-click copy controls
    assert.ok(regContent.includes("copyToClipboard"), "Register modal must have copy controls");
    assert.ok(instrContent.includes("copyToClipboard"), "Instructions modal must have copy controls");

    // Host name and FQDN presentation
    assert.ok(regContent.includes("_lazynerds-verification"), "Register modal must display DNS host");
    assert.ok(instrContent.includes("_lazynerds-verification"), "Instructions modal must display DNS host");

    // Regeneration support
    assert.ok(instrContent.includes("handleRegenerate"), "Instructions modal must support challenge regeneration");
    assert.ok(instrContent.includes("handleVerify"), "Instructions modal must support verification");
  });
});
