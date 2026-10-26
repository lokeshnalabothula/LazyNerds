import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { interpretFinding, getSeverityMeaning } from "../lib/finding-interpreter.ts";

describe("Finding Interpreter & Plain-English Security Reports", () => {
  test("getSeverityMeaning provides grounded, practical explanations for all severity levels", () => {
    const critical = getSeverityMeaning("critical");
    assert.match(critical.label, /Critical/i);
    assert.match(critical.meaning, /Immediate and severe danger/i);

    const high = getSeverityMeaning("high");
    assert.match(high.label, /High/i);
    assert.match(high.meaning, /Significant security risk/i);

    const medium = getSeverityMeaning("medium");
    assert.match(medium.label, /Medium/i);
    assert.match(medium.meaning, /Moderate security concern/i);

    const low = getSeverityMeaning("low");
    assert.match(low.label, /Low/i);
    assert.match(low.meaning, /Defensive hardening recommendation/i);
    // Explicit check that low severity does NOT claim active compromise
    assert.match(low.meaning, /not currently compromised/i);

    const info = getSeverityMeaning("info");
    assert.match(info.label, /Informational/i);
    assert.match(info.meaning, /Neutral observation/i);
  });

  test("interprets missing HSTS into plain English with 7 required sections and config snippets", () => {
    const rawFinding = {
      id: "f-hsts-1",
      engagement_id: "eng-1",
      title: "Missing Strict-Transport-Security (HSTS) Header",
      severity: "low",
      status: "open",
      asset_name: "https://example.com",
      description: "The HTTP Strict-Transport-Security header is not enforced.",
      impact: "Allows man-in-the-middle downgrade attacks from HTTPS to plain HTTP.",
      remediation_guidance: "Add Strict-Transport-Security header with max-age=31536000; includeSubDomains.",
      evidence: "HTTP/1.1 200 OK\nServer: nginx/1.24.0\nContent-Type: text/html\n(No Strict-Transport-Security header present)",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(rawFinding, "https://example.com");

    // Check basic metadata
    assert.equal(report.id, "f-hsts-1");
    assert.match(report.simpleTitle, /HSTS/i);
    assert.equal(report.severity, "low");
    assert.ok(report.quickRiskSummary.length > 10);

    // 1. What is the problem?
    assert.ok(report.problemExplanation.length > 20);
    assert.match(report.problemExplanation, /HTTP.*HTTPS|encrypted|redirect/i);

    // 2. Why should I care?
    assert.ok(report.whyShouldICare.length > 20);
    assert.match(report.whyShouldICare, /Wi-Fi|intercept|downgrade|visitor/i);

    // 3. How serious is it?
    assert.match(report.howSeriousIsIt, /Low Risk/i);
    assert.match(report.howSeriousIsIt, /breached|attack/i);

    // 4. Where is the problem?
    assert.equal(report.whereIsTheProblem.targetUrl, "https://example.com");
    assert.ok(report.whereIsTheProblem.location.length > 0);

    // 5. What did the scanner find?
    assert.ok(report.evidenceSummary.length > 10);
    assert.ok(report.rawEvidence && report.rawEvidence.includes("nginx"));

    // 6. How can I fix it?
    assert.ok(report.recommendedFix.steps.length >= 3);
    assert.ok(report.recommendedFix.configExamples.length >= 3);

    // Verify platform config snippets exist
    const platforms = report.recommendedFix.configExamples.map((c) => c.platform);
    assert.ok(platforms.includes("Nginx"), "Must include Nginx configuration example");
    assert.ok(platforms.includes("Cloudflare"), "Must include Cloudflare configuration example");
    assert.ok(platforms.includes("Next.js / Vercel"), "Must include Next.js / Vercel configuration example");

    const nginxExample = report.recommendedFix.configExamples.find((c) => c.platform === "Nginx");
    assert.match(nginxExample.snippet, /Strict-Transport-Security/i);

    // 7. How to verify your fix
    assert.ok(report.verificationSteps.command.includes("curl"));
    assert.ok(report.verificationSteps.expectedResult.length > 10);

    // 8. What happens if I ignore it?
    assert.ok(report.whatHappensIfIIgnoreIt.realisticImpact.length > 10);
    assert.ok(report.whatHappensIfIIgnoreIt.limitations.length > 10);

    // Technical details
    assert.ok(report.technicalDetails.detectionSource.length > 0);
  });

  test("interprets missing Content-Security-Policy (CSP) with actionable instructions", () => {
    const rawFinding = {
      id: "f-csp-1",
      engagement_id: "eng-1",
      title: "Content-Security-Policy (CSP) Header Missing",
      severity: "low",
      status: "open",
      asset_name: "https://shop.example.com",
      description: "Content-Security-Policy header is not present on HTTP response.",
      impact: "Without CSP, the browser cannot restrict script sources if XSS occurs.",
      evidence: "HTTP/2 200 OK\ncontent-type: text/html",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(rawFinding, "https://shop.example.com");

    assert.match(report.simpleTitle, /Content Security Policy/i);
    assert.match(report.problemExplanation, /Content Security Policy|Content-Security-Policy|browser/i);
    assert.match(report.whyShouldICare, /script|XSS|malicious/i);
    assert.ok(report.recommendedFix.configExamples.length >= 2);

    const nextExample = report.recommendedFix.configExamples.find((c) => c.platform === "Next.js / Vercel");
    assert.ok(nextExample, "Must provide Next.js / Vercel CSP configuration example");
    assert.match(nextExample.snippet, /default-src|csp/i);
  });

  test("interprets clickjacking / X-Frame-Options finding", () => {
    const rawFinding = {
      id: "f-xfo-1",
      engagement_id: "eng-1",
      title: "Missing X-Frame-Options (Clickjacking Risk)",
      severity: "low",
      status: "open",
      asset_name: "https://portal.example.com",
      description: "Neither X-Frame-Options nor frame-ancestors CSP directive was found.",
      evidence: "HTTP/1.1 200 OK",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(rawFinding, "https://portal.example.com");

    assert.match(report.simpleTitle, /Clickjacking/i);
    assert.match(report.problemExplanation, /frame|iframe|embedded/i);
    assert.match(report.whyShouldICare, /click|invisible|trick/i);

    const nginxExample = report.recommendedFix.configExamples.find((c) => c.platform === "Nginx");
    assert.match(nginxExample.snippet, /X-Frame-Options.*DENY|SAMEORIGIN/i);
  });

  test("interprets expired SSL/TLS certificate with High risk severity", () => {
    const rawFinding = {
      id: "f-cert-1",
      engagement_id: "eng-1",
      title: "SSL/TLS Certificate Has Expired",
      severity: "high",
      status: "open",
      asset_name: "https://api.example.com",
      description: "The remote TLS certificate expired 3 days ago.",
      evidence: "Not After: 2026-10-23T00:00:00Z",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(rawFinding, "https://api.example.com");

    assert.equal(report.severity, "high");
    assert.match(report.simpleTitle, /Security Certificate.*SSL\/TLS/i);
    assert.match(report.whyShouldICare, /warning|untrusted|turn away|block/i);
    assert.ok(report.recommendedFix.steps.some((s) => s.toLowerCase().includes("certbot") || s.toLowerCase().includes("renew") || s.toLowerCase().includes("ca")));
  });

  test("interprets Insecure CORS Origin Reflection", () => {
    const rawFinding = {
      id: "f-cors-1",
      engagement_id: "eng-1",
      title: "CORS Misconfiguration: Arbitrary Origin Reflection",
      severity: "medium",
      status: "open",
      asset_name: "https://api.example.com",
      description: "The server reflects arbitrary Origin headers in Access-Control-Allow-Origin.",
      evidence: "Origin: https://evil.attacker.com -> Access-Control-Allow-Origin: https://evil.attacker.com",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(rawFinding, "https://api.example.com");

    assert.equal(report.severity, "medium");
    assert.match(report.simpleTitle, /CORS/i);
    assert.match(report.whyShouldICare, /browser|cross-origin|read|session/i);
  });

  test("handles unknown or generic scanner findings gracefully without crashing", () => {
    const genericFinding = {
      id: "f-unknown-99",
      engagement_id: "eng-1",
      title: "Custom Service Header Detected",
      severity: "info",
      status: "open",
      asset_name: "https://custom.target.net",
      description: "Observed custom header X-Custom-Debug: true in HTTP response.",
      impact: "May reveal internal application debugging flags.",
      evidence: "X-Custom-Debug: true",
      remediation_guidance: "Disable debug headers in production environment.",
      remediation_notes: "Engine: Custom Parser v1",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verifications: [],
    };

    const report = interpretFinding(genericFinding, "https://custom.target.net");

    assert.equal(report.id, "f-unknown-99");
    assert.equal(report.severity, "info");
    assert.ok(report.problemExplanation.length > 0);
    assert.ok(report.whyShouldICare.length > 0);
    assert.ok(report.howSeriousIsIt.includes("Informational"));
    assert.equal(report.whereIsTheProblem.targetUrl, "https://custom.target.net");
    assert.ok(report.evidenceSummary.length > 0);
    assert.ok(report.recommendedFix.steps.length > 0);
    assert.ok(report.verificationSteps.command.length > 0);
    assert.ok(report.whatHappensIfIIgnoreIt.realisticImpact.length > 0);
    assert.equal(report.technicalDetails.detectionSource, "Engine: Custom Parser v1");
  });
});
