import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Public Marketing Homepage Integrity & Grounded Truth (LNA-16)", () => {
  const cwd = process.cwd();
  const frontendDir = cwd.endsWith("frontend") ? cwd : path.join(cwd, "frontend");
  const homepagePath = path.join(frontendDir, "app", "page.tsx");
  const homepageCode = fs.readFileSync(homepagePath, "utf8");

  test("Homepage renders public landing page without unconditional redirects away from '/'", () => {
    // Must NOT contain unconditional router.replace('/overview') or router.replace('/login')
    assert.ok(
      !homepageCode.includes("router.replace('/overview')") &&
        !homepageCode.includes("router.replace('/login')") &&
        !homepageCode.includes('router.replace("/overview")') &&
        !homepageCode.includes('router.replace("/login")'),
      "Homepage must not unconditionally redirect unauthenticated visitors away from '/'"
    );

    // Must render hero headline and brand
    assert.ok(
      homepageCode.includes("Precision Penetration Testing & Vulnerability Operations"),
      "Must render the primary headline"
    );
    assert.ok(
      homepageCode.includes("Lazy Nerds") && homepageCode.includes("FIXOPS"),
      "Must render Lazy Nerds FIXOPS branding"
    );
  });

  test("Navigation provides accessible routes to portal, registration, and governance", () => {
    // Portal sign in
    assert.ok(
      homepageCode.includes('href="/login"') || homepageCode.includes("href={user ? \"/overview\" : \"/login\"}"),
      "Must provide navigation link to login/portal"
    );

    // Registration request
    assert.ok(
      homepageCode.includes('href="/register"'),
      "Must provide navigation link to self-service registration"
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
    assert.ok(
      homepageCode.includes('href="/api/v1/health"'),
      "Must provide link to operational health endpoint"
    );
  });

  test("Enforces single prominent primary action hierarchy per screen state", () => {
    // Count exact occurrences of gloss-yellow-btn across the entire homepage template
    const yellowMatches = homepageCode.match(/gloss-yellow-btn/g) || [];
    assert.strictEqual(
      yellowMatches.length,
      1,
      `Homepage must define exactly ONE yellow primary action across all template states (found ${yellowMatches.length})`
    );

    // Hero action must have dominant primary yellow styling on the anchor
    assert.ok(
      homepageCode.includes("gloss-yellow-btn") &&
        homepageCode.includes('{user ? "Open FixOps Console" : "Launch FixOps Portal"}'),
      "Hero section must feature the single dominant yellow action anchor"
    );

    // Hero secondary helper must be subordinate outline styling
    assert.ok(
      homepageCode.includes('href="#capabilities"') &&
        homepageCode.includes("Explore Platform Capabilities"),
      "Secondary hero action must be subordinate anchor linking to capabilities"
    );

    // Header actions must use subordinate styling to avoid competing with hero
    assert.ok(
      homepageCode.includes("Portal Sign In") &&
        homepageCode.includes("Open Console") &&
        homepageCode.includes("border-white/[0.15]"),
      "Header actions must use subordinate outline styling rather than yellow primary"
    );

    // Bottom CTA section must feature subordinate outline styling
    assert.ok(
      homepageCode.includes("Request Organization Access") &&
        homepageCode.includes("border-white/[0.2]"),
      "Bottom CTA section must offer subordinate styling"
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

    // Homepage must not import or render the Button component (all navigation actions are styled anchors)
    assert.ok(
      !homepageCode.includes('import { Button }') &&
        !homepageCode.includes('<Button'),
      "Homepage navigation actions must be rendered as direct styled anchors rather than nested <Button> components"
    );

    // Any standalone button (like mobile hamburger) must be a valid button with type='button'
    assert.ok(
      homepageCode.includes('<button') &&
        homepageCode.includes('type="button"') &&
        homepageCode.includes('aria-label="Toggle navigation menu"'),
      "Standalone interactive controls must be valid accessible buttons"
    );
  });

  test("Claims are strictly grounded in verified platform capabilities (zero fabricated proof)", () => {
    // Grounded technical capabilities verified in LNA-15
    assert.ok(
      homepageCode.includes("Rules of Engagement") || homepageCode.includes("RoE"),
      "Must highlight verified Rules of Engagement authorization fencing"
    );
    assert.ok(
      homepageCode.includes("SSRF") && homepageCode.includes("169.254.169.254"),
      "Must highlight verified multi-layer SSRF destination protection"
    );
    assert.ok(
      homepageCode.includes("Docker") && homepageCode.includes("Nuclei"),
      "Must highlight verified containerized scanner orchestration"
    );
    assert.ok(
      homepageCode.includes("CVSS") && homepageCode.includes("CWE"),
      "Must highlight verified findings triage and remediation taxonomy"
    );

    // Strict negative checks: No fabricated social proof or false guarantees
    const lower = homepageCode.toLowerCase();
    assert.ok(
      !lower.includes("10,000+ hacks prevented") &&
        !lower.includes("100% unhackable") &&
        !lower.includes("guaranteed zero breaches") &&
        !lower.includes("trusted by fortune 500") &&
        !lower.includes("cross-tenant data leaks are structurally prevented") &&
        !lower.includes("5-star rating"),
      "Must not include fabricated statistics, false security guarantees, or fake testimonials"
    );

    // Verifiable isolation claim
    assert.ok(
      homepageCode.includes("Tenant isolation is enforced across database queries and role-based access checks"),
      "Must use precise, verifiable tenant isolation wording rather than absolute guarantees"
    );

    // Zero broken or non-functional dummy contact forms
    assert.ok(
      !homepageCode.includes("<form") && !homepageCode.includes('onSubmit='),
      "Must not include non-functional placeholder contact forms"
    );
  });

  test("Semantic accessibility structure and responsive layout attributes exist", () => {
    // Semantic landmarks
    assert.ok(homepageCode.includes("<header"), "Must include semantic <header> landmark");
    assert.ok(homepageCode.includes("<main"), "Must include semantic <main> landmark");
    assert.ok(homepageCode.includes("<footer"), "Must include semantic <footer> landmark");
    assert.ok(homepageCode.includes("<nav"), "Must include semantic <nav> landmark");

    // Responsive landmarks and mobile controls
    assert.ok(
      homepageCode.includes("aria-label=\"Primary Navigation\"") ||
        homepageCode.includes("aria-label='Primary Navigation'"),
      "Primary navigation must include descriptive aria-label"
    );
    assert.ok(
      homepageCode.includes("aria-label=\"Toggle navigation menu\"") ||
        homepageCode.includes("aria-label='Toggle navigation menu'"),
      "Mobile hamburger button must include accessible aria-label"
    );
    assert.ok(
      homepageCode.includes("aria-expanded="),
      "Mobile hamburger button must include aria-expanded attribute"
    );
  });
});
