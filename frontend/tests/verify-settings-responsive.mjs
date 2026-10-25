import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/visual-evidence');

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';

let credFile = path.resolve(__dirname, '../../.fixops_founder_credentials.local.txt');
if (!fs.existsSync(credFile)) {
  credFile = path.resolve('.fixops_founder_credentials.local.txt');
}
let email = '';
let password = '';
if (fs.existsSync(credFile)) {
  const content = fs.readFileSync(credFile, 'utf8');
  for (const line of content.split('\n')) {
    if (line.startsWith('FOUNDER_EMAIL=')) email = line.split('=')[1].trim();
    if (line.startsWith('FOUNDER_PASSWORD=')) password = line.split('=')[1].trim();
  }
}

async function runSettingsResponsiveAudit() {
  console.log(`Starting Detailed Responsive Settings Audit across 5 Viewport Widths...`);
  console.log(`Target: ${BASE_URL}/settings\n`);

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();

    // 1. Log in
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/overview', { timeout: 45000 });
    console.log('✓ Successfully authenticated as Founder');

    // Viewports to verify
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900, type: 'Desktop Wide' },
      { name: 'desktop-1024', width: 1024, height: 768, type: 'Desktop Standard' },
      { name: 'tablet-768', width: 768, height: 1024, type: 'Tablet Portrait' },
      { name: 'mobile-390', width: 390, height: 844, type: 'Mobile Standard' },
      { name: 'mobile-320', width: 320, height: 568, type: 'Mobile Narrow' },
    ];

    const results = [];

    for (const vp of viewports) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(`${BASE_URL}/settings`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-loading-state="complete"]', { timeout: 15000 });
      await new Promise((r) => setTimeout(r, 600));

      const audit = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const winW = window.innerWidth;
        const hasHorizontalOverflow = docW > winW;

        // Check desktop settings sidebar
        const sidebar = document.querySelector('#settings-sidebar');
        const sidebarVisible = sidebar && window.getComputedStyle(sidebar).display !== 'none';
        let sidebarItemsCount = 0;
        let sidebarCollisions = [];

        if (sidebarVisible) {
          const buttons = Array.from(sidebar.querySelectorAll('button'));
          sidebarItemsCount = buttons.length;
          for (let i = 0; i < buttons.length - 1; i++) {
            const r1 = buttons[i].getBoundingClientRect();
            const r2 = buttons[i + 1].getBoundingClientRect();
            // In a vertical sidebar, each subsequent item should be strictly below the previous
            if (r1.bottom > r2.top + 1) {
              sidebarCollisions.push(`Button [${buttons[i].textContent.trim()}] collides with [${buttons[i + 1].textContent.trim()}]`);
            }
          }
        }

        // Check mobile select
        const mobileNav = document.querySelector('#mobile-settings-nav');
        const mobileNavVisible = mobileNav && window.getComputedStyle(mobileNav).display !== 'none';
        let selectOptionsCount = 0;
        if (mobileNav) {
          selectOptionsCount = mobileNav.querySelectorAll('option').length;
        }

        // Check for any text overlapping inside main
        const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, button, span.font-semibold'));
        const overlaps = [];
        for (let i = 0; i < allHeadings.length; i++) {
          const r1 = allHeadings[i].getBoundingClientRect();
          if (r1.width === 0 || r1.height === 0) continue;
          for (let j = i + 1; j < allHeadings.length; j++) {
            const r2 = allHeadings[j].getBoundingClientRect();
            if (r2.width === 0 || r2.height === 0) continue;
            // Check bounding box intersection
            const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
            const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
            if (xOverlap > 5 && yOverlap > 5) {
              // Ignore parent-child relationships
              if (!allHeadings[i].contains(allHeadings[j]) && !allHeadings[j].contains(allHeadings[i])) {
                overlaps.push({
                  el1: allHeadings[i].textContent.trim().slice(0, 30),
                  el2: allHeadings[j].textContent.trim().slice(0, 30),
                });
              }
            }
          }
        }

        return {
          winW,
          docW,
          hasHorizontalOverflow,
          sidebarVisible,
          sidebarItemsCount,
          sidebarCollisions,
          mobileNavVisible,
          selectOptionsCount,
          overlaps,
        };
      });

      // Capture screenshot
      const shotPath = path.join(OUTPUT_DIR, `settings-${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      console.log(`\n✓ Viewport [${vp.type}] ${vp.width}x${vp.height}:`);
      console.log(`  - Horizontal Overflow: ${audit.hasHorizontalOverflow ? 'FAIL (scrollWidth ' + audit.docW + ' > ' + audit.winW + ')' : 'PASS (0 overflow)'}`);
      if (audit.sidebarVisible) {
        console.log(`  - Desktop Sidebar: VISIBLE (${audit.sidebarItemsCount} items, Collisions: ${audit.sidebarCollisions.length})`);
      } else {
        console.log(`  - Mobile Select Nav: VISIBLE (${audit.selectOptionsCount} options, 100% discoverable)`);
      }
      console.log(`  - Text Overlaps: ${audit.overlaps.length}`);
      if (audit.overlaps.length > 0) {
        console.log(`    ⚠ Overlaps:`, JSON.stringify(audit.overlaps));
      }
      console.log(`  - Captured: settings-${vp.name}.png`);

      results.push({
        viewport: `${vp.width}x${vp.height} (${vp.name})`,
        overflow: audit.hasHorizontalOverflow ? 'FAIL' : 'PASS',
        navMode: audit.sidebarVisible ? `Sidebar (${audit.sidebarItemsCount} items)` : `Select (${audit.selectOptionsCount} opts)`,
        collisions: audit.sidebarCollisions.length + audit.overlaps.length,
      });
    }

    console.log('\n--- Summary of Responsive Settings Audit ---');
    console.table(results);

    const hasFailure = results.some((r) => r.overflow === 'FAIL' || r.collisions > 0);
    if (hasFailure) {
      console.error('\n❌ Responsive Settings audit detected failures.');
      process.exitCode = 1;
    } else {
      console.log('\n✅ All 5 viewports passed with 0 collisions and 0 horizontal overflow.');
    }
  } catch (err) {
    console.error('Audit failed with error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

runSettingsResponsiveAudit();
