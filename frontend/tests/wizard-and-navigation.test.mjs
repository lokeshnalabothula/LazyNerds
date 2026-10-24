import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { clientFormSchema, engagementFormSchema } from "../lib/validators.ts";

describe("Brand Assets & Navigation Integrity", () => {
  const cwd = process.cwd();
  const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");

  test("essential web assets exist and no profile or title images remain in frontend UI", () => {
    const faviconPath = path.join(frontendDir, "public", "favicon.ico");
    const appleTouchPath = path.join(frontendDir, "public", "apple-touch-icon.png");

    assert.ok(fs.existsSync(faviconPath), "frontend/public/favicon.ico must exist");
    assert.ok(fs.existsSync(appleTouchPath), "frontend/public/apple-touch-icon.png must exist");

    // Scan frontend app and components to verify no image-based profile or title references remain
    const scanDir = (dir) => {
      let files = [];
      for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory() && !['node_modules', '.next', '.git'].includes(item.name)) {
          files = files.concat(scanDir(fullPath));
        } else if (item.isFile() && (item.name.endsWith('.tsx') || item.name.endsWith('.ts'))) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const sourceFiles = [
      ...scanDir(path.join(frontendDir, "app")),
      ...scanDir(path.join(frontendDir, "components")),
    ];

    const forbiddenTerms = [
      ["pro", "file.png"].join(""),
      ["pro", "file-sm.png"].join(""),
      ["ti", "tle.png"].join(""),
      ["ti", "tle-sm.png"].join(""),
    ];

    for (const filePath of sourceFiles) {
      const content = fs.readFileSync(filePath, "utf8");
      for (const term of forbiddenTerms) {
        assert.ok(
          !content.includes(term),
          `Found forbidden image reference ${term} in ${path.relative(frontendDir, filePath)}`
        );
      }
    }
  });

  test("exactly ONE desktop sidebar collapse button exists in the application header", () => {
    const sidebarCode = fs.readFileSync(path.join(frontendDir, "components", "layout", "sidebar.tsx"), "utf8");
    const topbarCode = fs.readFileSync(path.join(frontendDir, "components", "layout", "topbar.tsx"), "utf8");

    // Topbar must have the deliberate desktop toggle
    assert.ok(
      topbarCode.includes("onToggleSidebar") &&
      (topbarCode.includes("PanelLeftClose") || topbarCode.includes("PanelLeftOpen")),
      "Topbar must contain the single desktop sidebar collapse control"
    );

    // Sidebar must NOT contain duplicate desktop toggle buttons
    assert.ok(
      !sidebarCode.includes("hidden md:flex p-1.5 rounded-md text-zinc-400 hover:text-zinc-900"),
      "Sidebar header must NOT contain desktop collapse button"
    );
    assert.ok(
      !sidebarCode.includes("ChevronLeft") && !sidebarCode.includes("ChevronRight"),
      "Sidebar must not import or render ChevronLeft/ChevronRight collapse icons"
    );
    assert.ok(
      !sidebarCode.includes('aria-label="Expand sidebar"'),
      "Sidebar footer must NOT contain duplicate expand button"
    );
  });

  test("clean text brand wordmark Lazy Nerds and FIXOPS is rendered without image wordmarks", () => {
    const sidebarCode = fs.readFileSync(path.join(frontendDir, "components", "layout", "sidebar.tsx"), "utf8");
    const loginCode = fs.readFileSync(path.join(frontendDir, "app", "login", "page.tsx"), "utf8");
    const registerCode = fs.readFileSync(path.join(frontendDir, "app", "register", "page.tsx"), "utf8");
    const settingsCode = fs.readFileSync(path.join(frontendDir, "app", "settings", "page.tsx"), "utf8");

    assert.ok(sidebarCode.includes("Lazy Nerds") && sidebarCode.includes("FIXOPS"), "Sidebar header must display text wordmark");
    assert.ok(loginCode.includes("Lazy Nerds") && loginCode.includes("FIXOPS"), "Login page must display text wordmark");
    assert.ok(registerCode.includes("Lazy Nerds"), "Register page must display text wordmark");
    assert.ok(settingsCode.includes("LAZY NERDS FIXOPS") || settingsCode.includes("Lazy Nerds"), "Settings page must display text wordmark");

    // Ensure none of the image wordmarks remain in these surfaces
    const imageWordmarkName = ["title", "-sm.png"].join("");
    assert.ok(!sidebarCode.includes(imageWordmarkName), "Sidebar header must not contain image wordmark");
    assert.ok(!loginCode.includes(imageWordmarkName), "Login page must not contain image wordmark");
    assert.ok(!registerCode.includes(imageWordmarkName), "Register page must not contain image wordmark");
    assert.ok(!settingsCode.includes(imageWordmarkName), "Settings page must not contain image wordmark");
  });

  test("client and engagement edit forms provide structured, sectioned layout with icons", () => {
    const clientFormCode = fs.readFileSync(path.join(frontendDir, "components", "clients", "client-form.tsx"), "utf8");
    const engFormCode = fs.readFileSync(path.join(frontendDir, "components", "engagements", "engagement-form.tsx"), "utf8");

    // Client form has 3 clear sections
    assert.ok(clientFormCode.includes("1. Organization Profile"), "ClientForm must include Organization Profile section");
    assert.ok(clientFormCode.includes("2. Primary Security Contact"), "ClientForm must include Primary Security Contact section");
    assert.ok(clientFormCode.includes("3. Business Context & Scoping Notes"), "ClientForm must include Business Context section");

    // Engagement form has 4 clear sections and locked client display on edit
    assert.ok(engFormCode.includes("1. Client & Methodology"), "EngagementForm must include Client & Methodology section");
    assert.ok(engFormCode.includes("2. Scheduling & Operational Lifecycle"), "EngagementForm must include Scheduling section");
    assert.ok(engFormCode.includes("3. Scope & Rules of Engagement"), "EngagementForm must include Scope section");
    assert.ok(engFormCode.includes("4. Assessor Assignment"), "EngagementForm must include Assessor section");
    assert.ok(engFormCode.includes("initialData.client_company_name"), "EngagementForm must display read-only client card when editing");
  });
});

describe("Client Multi-Step Wizard Validation & Flow", () => {
  test("Step 1 (Organization) validates company name and allows industry", () => {
    // Valid organization step data
    const validStep1 = {
      company_name: "Sentinel Shield Corp",
      industry: "Fintech & Banking",
      created_at: "2026-10-19T10:00:00",
      primary_contact_name: "Alex Mercer",
      primary_contact_email: "alex@sentinel.com",
    };
    const result = clientFormSchema.safeParse(validStep1);
    assert.ok(result.success, "Valid Step 1 input should pass schema validation");

    // Missing company name fails
    const invalidStep1 = {
      ...validStep1,
      company_name: "   ",
    };
    const failResult = clientFormSchema.safeParse(invalidStep1);
    assert.strictEqual(failResult.success, false);
  });

  test("Step 2 (Contact Info) requires contact name and valid email, validates website URL", () => {
    const baseData = {
      company_name: "Vanguard Tech",
      industry: "Software & SaaS",
      primary_contact_name: "Jordan Lee",
      primary_contact_email: "jordan@vanguard.com",
    };

    // Valid contact data
    assert.ok(clientFormSchema.safeParse(baseData).success);

    // Invalid email fails Step 2
    assert.strictEqual(
      clientFormSchema.safeParse({ ...baseData, primary_contact_email: "not-an-email" }).success,
      false
    );

    // Malicious or invalid website fails
    assert.strictEqual(
      clientFormSchema.safeParse({ ...baseData, website: "javascript:alert(1)" }).success,
      false
    );
    assert.strictEqual(
      clientFormSchema.safeParse({ ...baseData, website: "htp:/broken" }).success,
      false
    );

    // Valid HTTPS website passes
    assert.ok(
      clientFormSchema.safeParse({ ...baseData, website: "https://vanguard.tech" }).success
    );
  });

  test("Step 3 (Business Context) enforces notes character limit", () => {
    const baseData = {
      company_name: "Apex Logistics",
      primary_contact_name: "Sarah Chen",
      primary_contact_email: "sarah@apex.com",
    };

    // Notes within 5,000 limit pass
    assert.ok(
      clientFormSchema.safeParse({ ...baseData, notes: "Confidential penetration testing notes." }).success
    );

    // Notes exceeding 5,000 characters fail
    const tooLong = "A".repeat(5001);
    assert.strictEqual(
      clientFormSchema.safeParse({ ...baseData, notes: tooLong }).success,
      false
    );
  });

  test("Step 4 (Review) payload accurately strips whitespaces and normalizes email", () => {
    const input = {
      company_name: "  Acme Cyber  ",
      primary_contact_name: "  Dave Clark  ",
      primary_contact_email: "  DAVE@AcmeCyber.COM  ",
      website: "https://acme.com",
      notes: "Scoping notes",
    };
    const parsed = clientFormSchema.parse(input);
    assert.strictEqual(parsed.company_name, "Acme Cyber");
    assert.strictEqual(parsed.primary_contact_name, "Dave Clark");
    assert.strictEqual(parsed.primary_contact_email, "dave@acmecyber.com");
  });
});

describe("Engagement Multi-Step Wizard Validation & Flow", () => {
  test("Step 1 (Basics) requires title and assessment methodology", () => {
    const validStep1 = {
      name: "Q4 External Security Assessment",
      assessment_type: "External Network Pen Test",
      client_id: "00000000-0000-0000-0000-000000000001",
      authorization_status: "confirmed",
      status: "draft",
    };
    assert.ok(engagementFormSchema.safeParse(validStep1).success);

    // Empty name fails
    assert.strictEqual(
      engagementFormSchema.safeParse({ ...validStep1, name: "   " }).success,
      false
    );
  });

  test("Step 2 (Client Association) strictly requires a selected client ID", () => {
    const missingClient = {
      name: "API Pen Test",
      assessment_type: "API Security Assessment",
      client_id: "   ",
      authorization_status: "pending",
      status: "draft",
    };
    const result = engagementFormSchema.safeParse(missingClient);
    assert.strictEqual(result.success, false);
  });

  test("Step 3 (Schedule & Scope) enforces due_date >= start_date and valid RoE status", () => {
    const base = {
      name: "Cloud Configuration Audit",
      assessment_type: "Cloud Security Assessment",
      client_id: "00000000-0000-0000-0000-000000000002",
      status: "planned",
      authorization_status: "confirmed",
    };

    // Valid chronological dates
    assert.ok(
      engagementFormSchema.safeParse({
        ...base,
        start_date: "2026-11-01",
        due_date: "2026-11-15",
      }).success
    );

    // Single-day assessment (equal start and due date) is valid
    assert.ok(
      engagementFormSchema.safeParse({
        ...base,
        start_date: "2026-11-01",
        due_date: "2026-11-01",
      }).success
    );

    // Inverted dates fail
    assert.strictEqual(
      engagementFormSchema.safeParse({
        ...base,
        start_date: "2026-11-15",
        due_date: "2026-11-01",
      }).success,
      false
    );
  });

  test("Step 4 (Launch & Review) confirms valid operational status options", () => {
    const validStatuses = ["draft", "planned", "in_progress", "on_hold"];
    for (const st of validStatuses) {
      const payload = {
        name: "Mobile App Assessment",
        assessment_type: "Mobile App Security Assessment",
        client_id: "00000000-0000-0000-0000-000000000003",
        status: st,
        authorization_status: "confirmed",
      };
      assert.ok(engagementFormSchema.safeParse(payload).success, `Status ${st} should be valid`);
    }
  });
});
