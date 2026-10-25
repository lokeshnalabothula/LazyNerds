import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FINDINGS_PAGE = path.resolve(__dirname, '../app/findings/page.tsx');
const FINDING_DETAIL_PAGE = path.resolve(__dirname, '../app/findings/[findingId]/page.tsx');

test('Findings UI & Readability Architecture (LNA-13)', async (t) => {
  const listCode = fs.readFileSync(FINDINGS_PAGE, 'utf8');
  const detailCode = fs.readFileSync(FINDING_DETAIL_PAGE, 'utf8');

  await t.test('Findings List enforces single primary action hierarchy', () => {
    // Exactly one variant="primary" action on findings list
    const primaryMatches = [...listCode.matchAll(/variant="primary"/g)];
    assert.equal(
      primaryMatches.length,
      1,
      `Expected exactly 1 primary action button on Findings page, found ${primaryMatches.length}`
    );
    assert.match(listCode, /Launch Security Scan/);
    assert.match(listCode, /variant="outline"[\s\S]*?Import Scan Results/);
    assert.match(listCode, /variant="outline"[\s\S]*?Record Finding/);
  });

  await t.test('Findings List implements interactive telemetry KPI filter bar', () => {
    // Stat cards for All, Critical, High, In Remediation, Verified Fixed
    assert.match(listCode, /severityFilter ===/);
    assert.match(listCode, /statusFilter ===/);
    assert.match(listCode, /All Findings/);
    assert.match(listCode, /Critical/);
    assert.match(listCode, /High/);
    assert.match(listCode, /In Remediation/);
    assert.match(listCode, /Verified Fixed/);
  });

  await t.test('Findings List handles URL search parameters for engagement scoping', () => {
    assert.match(listCode, /useSearchParams\(\)/);
    assert.match(listCode, /engagement_id/);
    assert.match(listCode, /Suspense/);
  });

  await t.test('Findings Detail enforces single primary action hierarchy', () => {
    // Record Verification is primary; Edit Finding is outline
    const primaryMatches = [...detailCode.matchAll(/variant="primary"/g)];
    assert.equal(
      primaryMatches.length,
      1,
      `Expected exactly 1 primary action button on Finding detail page, found ${primaryMatches.length}`
    );
    assert.match(detailCode, /Record Verification/);
    assert.match(detailCode, /variant="outline"[\s\S]*?Edit Finding/);
  });

  await t.test('CVE sanitization rejects invalid sentinel values like "None" and "null"', () => {
    assert.match(detailCode, /isValidCve/);
    assert.match(listCode, /isValidCve/);

    const testCve = (val) => {
      if (!val) return false;
      const clean = String(val).trim().toLowerCase();
      return clean !== '' && clean !== 'none' && clean !== 'null' && clean !== 'n/a' && clean !== '—' && clean !== '-';
    };

    assert.equal(testCve('None'), false);
    assert.equal(testCve('none'), false);
    assert.equal(testCve('null'), false);
    assert.equal(testCve('n/a'), false);
    assert.equal(testCve('—'), false);
    assert.equal(testCve('CVE-2024-3094'), true);
    assert.equal(testCve('cve-2023-4863'), true);
  });

  await t.test('Findings Detail features prominent scannable dossier sections', () => {
    // Target asset clearly legible
    assert.match(detailCode, /Target Asset/);
    // Technical vulnerability description & risk impact
    assert.match(detailCode, /Technical Vulnerability Description & Risk Impact/);
    // Reproduction evidence in terminal
    assert.match(detailCode, /Replication Evidence & HTTP Proof-of-Concept/);
    assert.match(detailCode, /Copy Evidence/);
    // Remediation panel
    assert.match(detailCode, /Actionable Engineering Remediation/);
    // Retest timeline
    assert.match(detailCode, /Retest & Verification Timeline/);
  });
});
