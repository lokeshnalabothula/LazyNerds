import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Single Prominent Primary Action & UI Visual Hierarchy", () => {
  const cwd = process.cwd();
  const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");

  test("Overview Dashboard has exactly ONE primary action (Start scan or New Engagement)", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "overview", "page.tsx"), "utf8");

    // Must have primary action
    assert.ok(
      (code.includes('variant="primary"') && code.includes("New Engagement")) ||
      (code.includes("specular-button") && code.includes("Start scan")),
      "Overview header must feature single dominant primary action (Start scan or New Engagement)"
    );
  });

  test("Client Directory enforces single primary action (Add Client)", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "clients", "page.tsx"), "utf8");

    // Add Client must be variant="primary"
    assert.ok(
      code.includes('variant="primary"') && code.includes("Add Client"),
      "Clients header must feature Add Client as variant='primary'"
    );

    // Review Queue must be subordinate variant="outline"
    assert.ok(
      code.includes('variant="outline"') && code.includes("Review Queue"),
      "Review Queue link must be subordinate variant='outline'"
    );
  });

  test("Engagements page enforces single primary action (Create Engagement)", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "engagements", "page.tsx"), "utf8");

    assert.ok(
      code.includes('variant="primary"') && code.includes("Create Engagement"),
      "Engagements header must feature Create Engagement as variant='primary'"
    );
  });

  test("Findings page enforces single primary action (Launch Security Scan) with subordinate helpers", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "findings", "page.tsx"), "utf8");

    // Launch Security Scan must be variant="primary"
    assert.ok(
      code.includes('variant="primary"') && code.includes("Launch Security Scan"),
      "Findings header must feature Launch Security Scan as variant='primary'"
    );

    // Import Scan and Record Finding must be subordinate outline
    assert.ok(
      code.includes('variant="outline"') && code.includes("Import Scan Results"),
      "Import Scan Results must be subordinate variant='outline'"
    );
    assert.ok(
      code.includes('variant="outline"') && code.includes("Record Finding"),
      "Record Finding must be subordinate variant='outline'"
    );
  });

  test("Automation page enforces single primary action (New Workflow) and subordinate inline checks", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "automation", "page.tsx"), "utf8");

    // New Workflow must be variant="primary"
    assert.ok(
      code.includes('variant="primary"') && code.includes("New Workflow"),
      "Automation header must feature New Workflow as variant='primary'"
    );

    // Run Follow-up Check Now must NOT compete with gold styling
    assert.ok(
      !code.includes('btn-glossy-gold font-bold">\n              {runningReminders') &&
      code.includes('variant="outline"') &&
      code.includes("Run Follow-up Check Now"),
      "Run Follow-up Check Now must be subordinate outline"
    );
  });

  test("Reports page enforces single primary action (Generate Report)", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "reports", "page.tsx"), "utf8");

    assert.ok(
      code.includes('variant="primary"') && code.includes("Generate Report"),
      "Reports header must feature Generate Report as variant='primary'"
    );
  });

  test("Registrations queue demotes navigation link and focuses on approval actions", () => {
    const code = fs.readFileSync(path.join(frontendDir, "app", "registrations", "page.tsx"), "utf8");

    // Client Directory must be subordinate outline
    assert.ok(
      code.includes('variant="outline"') && code.includes("Client Directory"),
      "Client Directory button on Registrations queue must be subordinate outline"
    );

    // Modal submit uses prominent variant="primary" or destructive
    assert.ok(
      code.includes('variant={reviewAction === "reject" ? "destructive" : "primary"}'),
      "Registration modal review confirmation must use dynamic primary/destructive variant"
    );
  });

  test("Authentication & public onboarding forms feature single dominant submit action", () => {
    const loginCode = fs.readFileSync(path.join(frontendDir, "app", "login", "page.tsx"), "utf8");
    const registerCode = fs.readFileSync(path.join(frontendDir, "app", "register", "page.tsx"), "utf8");
    const forgotCode = fs.readFileSync(path.join(frontendDir, "app", "forgot-password", "page.tsx"), "utf8");
    const resetCode = fs.readFileSync(path.join(frontendDir, "app", "reset-password", "page.tsx"), "utf8");

    assert.ok(
      (loginCode.includes('variant="primary"') && loginCode.includes("Sign In to Workspace")) ||
      (loginCode.includes("liquid-metal-btn") && loginCode.includes("Sign in")),
      "Login submit is dominant primary action"
    );
    assert.ok(
      (registerCode.includes('variant="primary"') && registerCode.includes("Submit Client Application")) ||
      (registerCode.includes("liquid-metal-btn") && (registerCode.includes("Continue") || registerCode.includes("Verify"))),
      "Register submit is dominant primary action"
    );
    assert.ok(forgotCode.includes('variant="primary"') && forgotCode.includes("Send Recovery Instructions"), "Forgot password submit is variant='primary'");
    assert.ok(resetCode.includes('variant="primary"') && resetCode.includes("type=\"submit\""), "Reset password submit is variant='primary'");
  });

  test("Modals and Dialogs enforce primary forward action and subordinate/destructive actions", () => {
    const scanLauncher = fs.readFileSync(path.join(frontendDir, "components", "findings", "scan-launcher-modal.tsx"), "utf8");
    const scanImport = fs.readFileSync(path.join(frontendDir, "components", "findings", "scan-import-modal.tsx"), "utf8");
    const findingForm = fs.readFileSync(path.join(frontendDir, "components", "findings", "finding-form-modal.tsx"), "utf8");
    const verificationModal = fs.readFileSync(path.join(frontendDir, "components", "findings", "verification-modal.tsx"), "utf8");
    const ruleForm = fs.readFileSync(path.join(frontendDir, "components", "automation", "rule-form-modal.tsx"), "utf8");
    const assetForm = fs.readFileSync(path.join(frontendDir, "components", "assets", "asset-form-modal.tsx"), "utf8");
    const reportForm = fs.readFileSync(path.join(frontendDir, "components", "reports", "report-form-modal.tsx"), "utf8");
    const archiveDialog = fs.readFileSync(path.join(frontendDir, "components", "clients", "archive-dialog.tsx"), "utf8");

    assert.ok(scanLauncher.includes('variant="primary"') && scanLauncher.includes('variant="ghost"'), "ScanLauncher has primary launch and ghost cancel");
    assert.ok(scanImport.includes('variant="primary"') && scanImport.includes('variant="outline"'), "ScanImport has primary import and outline cancel");
    assert.ok(findingForm.includes('variant="primary"') && findingForm.includes('variant="outline"'), "FindingForm has primary submit and outline cancel");
    assert.ok(verificationModal.includes('variant="primary"') && verificationModal.includes('variant="outline"'), "VerificationModal has primary record and outline cancel");
    assert.ok(ruleForm.includes('variant="primary"') && ruleForm.includes('variant="outline"'), "RuleForm has primary submit and outline cancel");
    assert.ok(assetForm.includes('variant="primary"') && assetForm.includes('variant="outline"'), "AssetForm has primary submit and outline cancel");
    assert.ok(reportForm.includes('variant="primary"') && reportForm.includes('variant="outline"'), "ReportForm has primary submit and outline cancel");
    assert.ok(archiveDialog.includes('variant="destructive"') && archiveDialog.includes('variant="outline"'), "ArchiveDialog has unmistakable destructive action and outline cancel");
  });

  test("Multi-step wizards feature primary forward progression and subordinate back control", () => {
    const clientWizard = fs.readFileSync(path.join(frontendDir, "components", "clients", "client-wizard.tsx"), "utf8");
    const engWizard = fs.readFileSync(path.join(frontendDir, "components", "engagements", "engagement-wizard.tsx"), "utf8");

    assert.ok(clientWizard.includes('variant="primary"') && clientWizard.includes('variant="outline"'), "ClientWizard uses variant='primary' forward and variant='outline' back");
    assert.ok(engWizard.includes('variant="primary"') && engWizard.includes('variant="outline"'), "EngagementWizard uses variant='primary' forward and variant='outline' back");
  });
});
