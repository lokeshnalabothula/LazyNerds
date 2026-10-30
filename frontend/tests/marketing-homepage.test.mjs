import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Stitch Cybersecurity Audit Landing Page Parity", () => {
  const cwd = process.cwd();
  const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");
  const homepagePath = path.join(frontendDir, "app", "page.tsx");
  const homepageCode = fs.readFileSync(homepagePath, "utf8");

  test("Homepage renders public Stitch landing page without unconditional redirects", () => {
    // Must NOT contain unconditional router.replace('/overview') or router.replace('/login')
    assert.ok(
      !homepageCode.includes("router.replace('/overview')") &&
        !homepageCode.includes("router.replace('/login')") &&
        !homepageCode.includes('router.replace("/overview")') &&
        !homepageCode.includes('router.replace("/login")'),
      "Homepage must not unconditionally redirect unauthenticated visitors away from '/'"
    );

    // Must render Stitch headline and brand
    assert.ok(
      homepageCode.includes("Know what’s") && homepageCode.includes("exposed."),
      "Must render the Stitch primary headline 'Know what’s exposed.'"
    );
    assert.ok(
      homepageCode.includes("Lazy Nerds") && homepageCode.includes("FixOps"),
      "Must render Lazy Nerds FixOps branding"
    );
    assert.ok(
      homepageCode.includes("CYBERSECURITY AUDIT"),
      "Must render category eyebrow 'CYBERSECURITY AUDIT'"
    );
    assert.ok(
      homepageCode.includes("Verify. Scan. Secure."),
      "Must render supporting subheadline 'Verify. Scan. Secure.'"
    );
  });

  test("Navigation provides accessible routes to portal, legal, and console", () => {
    // Portal sign in / console
    assert.ok(
      homepageCode.includes('href="/login"') && homepageCode.includes('href="/overview"'),
      "Must provide navigation link to login and console"
    );

    // Governance & Legal
    assert.ok(
      homepageCode.includes('href="/privacy"'),
      "Must provide link to privacy policy"
    );
    assert.ok(
      homepageCode.includes('href="/terms"'),
      "Must provide link to terms of service"
    );
  });

  test("Interactive domain scan input capsule and Chrome button exist", () => {
    // Form and input capsule
    assert.ok(
      homepageCode.includes("capsule-pill"),
      "Must feature Stitch capsule-pill input container"
    );
    assert.ok(
      homepageCode.includes('id="domainInput"'),
      "Must include domain input"
    );
    assert.ok(
      homepageCode.includes("chrome-button"),
      "Must feature Stitch chrome-button liquid pill action"
    );
    assert.ok(
      homepageCode.includes("Free initial scan · Domain verification required"),
      "Must feature domain verification requirement hint"
    );
  });

  test("Navigation actions avoid nested interactive controls (no <a><button> or <Link><Button>)", () => {
    // Must NOT wrap <Button> component inside Next.js <Link> or anchor <a>
    assert.ok(
      !homepageCode.match(/<Link[^>]*>\s*<Button/i) &&
        !homepageCode.match(/<a[^>]*>\s*<Button/i),
      "Must not wrap <Button> inside Next.js <Link> or <a> anchor tags"
    );

    // Must NOT wrap any <button> element inside Next.js <Link> or anchor <a>
    const hasNestedLinkButton = /<Link(?![^>]*\/>)[^>]*>(?:(?!<\/Link>)[\s\S])*?<button/i.test(homepageCode);
    const hasNestedAButton = /<a(?![^>]*\/>)[^>]*>(?:(?!<\/a>)[\s\S])*?<button/i.test(homepageCode);
    assert.ok(
      !hasNestedLinkButton && !hasNestedAButton,
      "Must not nest interactive <button> controls inside <Link> or <a> elements"
    );
  });

  test("Stitch atmospheric lighting, shield geometry, and energy beams are defined", () => {
    const bgFile = path.join(frontendDir, "components", "ui", "fixops-background.tsx");
    const bgCode = fs.existsSync(bgFile) ? fs.readFileSync(bgFile, "utf8") : "";
    const combinedCode = homepageCode + "\n" + bgCode;

    assert.ok(
      combinedCode.includes("vertical-axis-ray"),
      "Must render central vertical axis ray"
    );
    assert.ok(
      homepageCode.includes("shield-glass") || combinedCode.includes("shield-glass"),
      "Must render frosted glass shield backdrop"
    );
    assert.ok(
      homepageCode.includes("perimeter-pulse-beam-left") &&
        homepageCode.includes("perimeter-pulse-beam-right"),
      "Must render dual synchronous perimeter pulse energy beams"
    );
    assert.ok(
      homepageCode.includes("apex-flare") &&
        homepageCode.includes("bottom-apex-flare"),
      "Must render top apex flare and bottom convergence flare"
    );
    assert.ok(
      combinedCode.includes("earth-container") &&
        combinedCode.includes("earth-surface-lights"),
      "Must render curved earth horizon backdrop and surface lights"
    );
    assert.ok(
      homepageCode.includes("animate-falling-arrow"),
      "Must render synchronized scroll exploration arrow"
    );
  });

  test("Semantic accessibility structure exists", () => {
    assert.ok(homepageCode.includes("<header"), "Must include semantic <header> landmark");
    assert.ok(homepageCode.includes("<main"), "Must include semantic <main> landmark");
    assert.ok(homepageCode.includes("<footer"), "Must include semantic <footer> landmark");
    assert.ok(homepageCode.includes("<nav"), "Must include semantic <nav> landmark");
    assert.ok(
      homepageCode.includes('aria-label="Primary Navigation"'),
      "Primary navigation must include descriptive aria-label"
    );
    assert.ok(
      homepageCode.includes('aria-label="Website domain to audit"'),
      "Domain input must include accessible aria-label"
    );
  });
});
