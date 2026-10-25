import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/visual-evidence');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: 'desktop-1440', label: 'Desktop Wide', width: 1440, height: 900 },
  { name: 'laptop-1024', label: 'Desktop Standard', width: 1024, height: 768 },
  { name: 'tablet-768', label: 'Tablet Portrait', width: 768, height: 1024 },
  { name: 'mobile-390', label: 'Mobile Standard', width: 390, height: 844 },
  { name: 'mobile-320', label: 'Mobile Narrow', width: 320, height: 568 },
];

async function run() {
  console.log('Starting Detailed Responsive Homepage Audit across 5 Viewport Widths...');
  console.log(`Target: ${BASE_URL}/`);

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  const results = [];

  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 600));

    // Verify 0 horizontal overflow
    const docMetrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientWidth = doc.clientWidth;
      const windowWidth = window.innerWidth;
      const overflow = scrollWidth > windowWidth;
      return { scrollWidth, clientWidth, windowWidth, overflow };
    });

    // Check header elements collision
    const headerCheck = await page.evaluate(() => {
      const brand = document.querySelector('header a[href="/"]');
      const action = document.querySelector('header a[href="/login"]') || document.querySelector('header a[href="/overview"]');
      if (!brand || !action) return { ok: false, reason: 'missing elements' };

      const bBox = brand.getBoundingClientRect();
      const aBox = action.getBoundingClientRect();

      const overlaps = bBox.right > aBox.left;
      const clearance = aBox.left - bBox.right;

      return {
        ok: true,
        overlaps,
        brandRight: bBox.right,
        actionLeft: aBox.left,
        clearance,
      };
    });

    // Verify exactly ONE yellow primary action across the entire rendered page (Hero only)
    // and verify zero nested interactive elements (no <a><button> or <button><a>)
    const primaryActionsCheck = await page.evaluate(() => {
      const allPrimaryActions = Array.from(document.querySelectorAll('.gloss-yellow-btn'));
      const heroActions = Array.from(document.querySelectorAll('main section:first-of-type .gloss-yellow-btn'));
      const headerActions = Array.from(document.querySelectorAll('header .gloss-yellow-btn'));
      const ctaActions = Array.from(document.querySelectorAll('main section:last-of-type .gloss-yellow-btn'));
      const nestedInteractive = Array.from(document.querySelectorAll('a button, button a, a a'));

      const heroOk = heroActions.length === 1 && heroActions[0].tagName.toLowerCase() === 'a';
      const headerSubordinate = headerActions.length === 0;
      const ctaSubordinate = ctaActions.length === 0;
      const exactlyOneTotal = allPrimaryActions.length === 1;
      const noNestedInteractive = nestedInteractive.length === 0;

      return {
        heroOk,
        headerSubordinate,
        ctaSubordinate,
        noNestedInteractive,
        nestedCount: nestedInteractive.length,
        totalPrimaryCount: allPrimaryActions.length,
        allOk: heroOk && headerSubordinate && ctaSubordinate && exactlyOneTotal && noNestedInteractive,
      };
    });

    const passed = !docMetrics.overflow && !headerCheck.overlaps && primaryActionsCheck.allOk;

    const screenshotPath = path.join(OUTPUT_DIR, `homepage-${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    console.log(`\n✓ Viewport [${vp.label}] ${vp.width}x${vp.height}:`);
    console.log(`  - Horizontal Overflow: ${docMetrics.overflow ? 'FAIL' : 'PASS'} (scrollWidth: ${docMetrics.scrollWidth}px, innerWidth: ${vp.width}px)`);
    console.log(`  - Header Elements Clearance: ${headerCheck.clearance.toFixed(1)}px (Overlaps: ${headerCheck.overlaps})`);
    console.log(`  - Single Yellow Hero Action: ${primaryActionsCheck.heroOk ? 'PASS' : 'FAIL'} (Count: ${primaryActionsCheck.totalPrimaryCount})`);
    console.log(`  - Zero Nested Interactive Controls: ${primaryActionsCheck.noNestedInteractive ? 'PASS' : 'FAIL'} (Nested: ${primaryActionsCheck.nestedCount})`);
    console.log(`  - Captured: homepage-${vp.name}.png`);

    results.push({
      viewport: `${vp.width}x${vp.height} (${vp.name})`,
      overflow: docMetrics.overflow ? 'FAIL' : 'PASS',
      clearance: `${headerCheck.clearance.toFixed(1)}px`,
      overlaps: headerCheck.overlaps ? 'COLLISION' : 'NONE',
      singlePrimary: primaryActionsCheck.allOk ? 'PASS' : 'FAIL',
      status: passed ? 'PASS' : 'FAIL',
    });
  }

  await browser.close();

  console.log('\n--- Summary of Responsive Homepage Audit ---');
  console.table(results);

  const hasFailures = results.some((r) => r.status === 'FAIL');
  if (hasFailures) {
    console.error('Audit failed: one or more viewports had defects!');
    process.exit(1);
  } else {
    console.log('\n✅ All 5 viewports passed with 0 collisions and 0 horizontal overflow.');
  }
}

run().catch((err) => {
  console.error('Fatal error running homepage audit:', err);
  process.exit(1);
});
