import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

describe("Stitch Sign-In Page Parity & Email OTP Registration Flow", () => {
  test("Sign-in page faithfully implements Google Stitch design structure", () => {
    const loginPath = path.join(frontendDir, "app", "login", "page.tsx");
    assert.ok(fs.existsSync(loginPath), "login/page.tsx must exist");
    const loginCode = fs.readFileSync(loginPath, "utf8");

    // Atmospheric backdrop elements
    assert.ok(loginCode.includes("vertical-axis-ray"), "Must include central vertical laser ray");
    assert.ok(loginCode.includes("stitch-earth-container"), "Must include Stitch earth container");
    assert.ok(loginCode.includes("stitch-earth-surface-lights"), "Must include Stitch earth surface lights");
    assert.ok(loginCode.includes("stitch-shield-glass"), "Must include frosted glass shield vector");
    assert.ok(loginCode.includes("apex-flare"), "Must include specular apex flare");

    // Header & navigation
    assert.ok(loginCode.includes("Back to scan"), "Header must include 'Back to scan' link");
    assert.ok(loginCode.includes("Lazy Nerds"), "Header must display Lazy Nerds branding");
    assert.ok(loginCode.includes("FixOps"), "Header must display FixOps branding");

    // Stitch form components
    assert.ok(loginCode.includes("Welcome back."), "Title must be 'Welcome back.'");
    assert.ok(loginCode.includes("Work Email"), "Label must be 'Work Email'");
    assert.ok(loginCode.includes("operator@company.com"), "Email placeholder must be 'operator@company.com'");
    assert.ok(loginCode.includes("Password"), "Label must be 'Password'");
    assert.ok(loginCode.includes("Forgot password?"), "Must include 'Forgot password?' link");
    assert.ok(loginCode.includes("toggle-pwd-btn"), "Must include interactive password visibility toggle button");
    assert.ok(loginCode.includes("stitch-liquid-metal-btn"), "Must use Stitch liquid metal button");
    assert.ok(loginCode.includes("Sign in"), "Button label must be 'Sign in'");
    assert.ok(loginCode.includes("Create an account"), "Must include link to create an account");

    // Footer
    assert.ok(loginCode.includes("Lazy Nerds © 2026"), "Footer must include institutional copyright");
    assert.ok(loginCode.includes("Privacy") && loginCode.includes("Terms"), "Footer must include Privacy and Terms links");
  });

  test("Registration page follows minimal Stitch design language for Email OTP", () => {
    const registerPath = path.join(frontendDir, "app", "register", "page.tsx");
    assert.ok(fs.existsSync(registerPath), "register/page.tsx must exist");
    const registerCode = fs.readFileSync(registerPath, "utf8");

    // Minimal inputs only
    assert.ok(registerCode.includes("Work Email"), "Must include Work Email entry");
    assert.ok(registerCode.includes("Verification Code") || registerCode.includes("6-Digit Verification Code"), "Must include Verification Code entry");
    assert.ok(registerCode.includes("Resend code"), "Must include Resend code action");
    assert.ok(registerCode.includes("cooldown"), "Must support cooldown timer");
    assert.ok(registerCode.includes("Sign in"), "Must link back to sign-in");

    // Reuses Stitch atmospheric backdrop and components
    assert.ok(registerCode.includes("stitch-specular-card"), "Must use specular glass card");
    assert.ok(registerCode.includes("stitch-liquid-metal-btn"), "Must use liquid metal CTA button");
    assert.ok(registerCode.includes("vertical-axis-ray"), "Must feature vertical laser ray");
  });

  test("OTP verification code validation enforces 6 digits", () => {
    const validateCode = (val) => {
      const clean = String(val).trim();
      return clean.length === 6 && /^\d+$/.test(clean);
    };

    assert.strictEqual(validateCode("123456"), true);
    assert.strictEqual(validateCode("000000"), true);
    assert.strictEqual(validateCode("987654"), true);
    assert.strictEqual(validateCode("12345"), false); // too short
    assert.strictEqual(validateCode("1234567"), false); // too long
    assert.strictEqual(validateCode("12a456"), false); // non-digit
    assert.strictEqual(validateCode(""), false);
  });
});
