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

// Credentials
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

const CLIENT_ID = '68e1f028-a7a4-42b8-81a7-6c99c11b6f51';
const ENGAGEMENT_ID = '91ea4d99-6c1d-4e7f-8d72-d997edd043bd';
const FINDING_ID = '9505a4f5-95b3-40c9-91e4-7cf125496081';
const REPORT_ID = 'b475e8f4-664a-4116-b860-28e7badb7635';

const PUBLIC_ROUTES_TO_INSPECT = [
  { path: '/login', name: 'login', title: 'Sign In & Authentication' },
  { path: '/register', name: 'register', title: 'Client Registration Portal' },
  { path: '/register/status', name: 'register-status', title: 'Registration Status Tracker' },
  { path: '/forgot-password', name: 'forgot-password', title: 'Account Recovery Dispatch' },
  { path: '/reset-password', name: 'reset-password', title: 'Security Password Reset' },
];

const ROUTES_TO_INSPECT = [
  // Core Telemetry & Directories
  { path: '/overview', name: 'overview', title: 'Dashboard Telemetry' },
  { path: '/clients', name: 'clients', title: 'Client Directory' },
  { path: `/clients/${CLIENT_ID}`, name: 'client-detail', title: 'Client Organization Detail' },
  { path: '/clients/new', name: 'client-new', title: 'Register New Client' },
  { path: `/clients/${CLIENT_ID}/edit`, name: 'client-edit', title: 'Edit Client Organization' },
  { path: '/engagements', name: 'engagements', title: 'Engagements LifeCycle' },
  { path: `/engagements/${ENGAGEMENT_ID}`, name: 'engagement-detail', title: 'Engagement Scope & Operations' },
  { path: '/engagements/new', name: 'engagement-new', title: 'Create New Engagement' },
  { path: `/engagements/${ENGAGEMENT_ID}/edit`, name: 'engagement-edit', title: 'Edit Security Engagement' },
  { path: '/assets', name: 'assets', title: 'Target Assets Inventory' },
  { path: '/findings', name: 'findings', title: 'Vulnerabilities & Triage' },
  { path: `/findings/${FINDING_ID}`, name: 'finding-detail', title: 'Vulnerability Technical Detail' },
  { path: '/automation', name: 'automation', title: 'Workflow Automation' },
  { path: '/reports', name: 'reports', title: 'Reporting & Deliverables' },
  { path: `/reports/${REPORT_ID}`, name: 'report-detail', title: 'Rendered Deliverable Document' },
  { path: '/registrations', name: 'registrations', title: 'Founder Onboarding Queue' },
  { path: '/settings', name: 'settings', title: 'Settings & Administration' },
];

async function waitForContentLoaded(page, routePath) {
  // Wait for document ready
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 35000 }).catch(() => {});

  // Wait for data-loading-state="complete" if present
  try {
    await page.waitForFunction(() => {
      const loadingEls = document.querySelectorAll('[data-loading-state]');
      if (loadingEls.length === 0) return true;
      for (const el of loadingEls) {
        if (el.getAttribute('data-loading-state') === 'loading') return false;
      }
      return true;
    }, { timeout: 35000 });
  } catch {
    console.warn(`    ⚠ [data-loading-state="complete"] not reached within 35s on ${routePath}`);
  }

  // Wait for loading skeleton containers (.animate-pulse that are not tiny status dots) to disappear
  try {
    await page.waitForFunction(() => {
      const skeletons = document.querySelectorAll('div.animate-pulse, .animate-pulse:not(span)');
      return skeletons.length === 0;
    }, { timeout: 35000 });
  } catch {
    console.warn(`    ⚠ Skeletons did not fully disappear within 35s on ${routePath}`);
  }

  // Route-specific content assertions to ensure live data is rendered
  if (routePath === '/overview') {
    await page.waitForSelector('.telemetry-card', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/clients')) {
    await page.waitForSelector('table tbody tr, .cockpit-card-interactive, [data-empty="true"], form, [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/engagements')) {
    await page.waitForSelector('table tbody tr, .cockpit-card-interactive, [data-empty="true"], form, [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/assets')) {
    await page.waitForSelector('table tbody tr, .cockpit-card-interactive, [data-empty="true"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/findings')) {
    await page.waitForSelector('table tbody tr, .cockpit-card-interactive, [data-empty="true"], [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/automation')) {
    await page.waitForSelector('table tbody tr, .cockpit-card-interactive, [data-empty="true"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/reports')) {
    await page.waitForSelector('.cockpit-card, [data-empty="true"], [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/registrations')) {
    await page.waitForSelector('table, .cockpit-card, [data-empty="true"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/settings')) {
    await page.waitForSelector('.cockpit-card, [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  } else if (routePath.startsWith('/register') || routePath.startsWith('/forgot') || routePath.startsWith('/reset') || routePath.startsWith('/login')) {
    await page.waitForSelector('form, .cockpit-card, [data-loading-state="complete"]', { timeout: 35000 }).catch(() => {});
  }

  // Allow animations and fonts to settle
  await new Promise((r) => setTimeout(r, 600));
}

async function captureScreenshots() {
  console.log(`Starting Visual Inspection & Screenshot Capture using Brave Browser...`);
  console.log(`Output Directory: ${OUTPUT_DIR}\n`);

  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const inspectionResults = [];

  try {
    const page = await browser.newPage();

    async function inspectAndCaptureRoute(route) {
      // Desktop Capture (1440x900)
      await page.setViewport({ width: 1440, height: 900 });
      try {
        await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
      } catch (err) {
        if (err.message.includes('detached') || err.message.includes('disposed')) {
          await new Promise((r) => setTimeout(r, 800));
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 35000 });
        } else {
          throw err;
        }
      }
      await waitForContentLoaded(page, route.path);

      // Check for nested clipping defects on desktop
      const desktopClippingIssues = await page.evaluate(() => {
        const found = [];
        const all = document.querySelectorAll('div, table, section, article, p, h1, h2, h3, h4, span, a');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (
            style.overflowX === 'hidden' &&
            style.textOverflow !== 'ellipsis' &&
            el.scrollWidth > el.clientWidth + 4 &&
            el.clientWidth > 0
          ) {
            found.push({
              tag: el.tagName,
              cls: el.className.slice(0, 50),
              scrollW: el.scrollWidth,
              clientW: el.clientWidth,
              text: el.textContent?.slice(0, 30).trim()
            });
          }
        }
        return found;
      });

      const desktopShotPath = path.join(OUTPUT_DIR, `${route.name}-desktop.png`);
      await page.screenshot({ path: desktopShotPath, fullPage: false });

      // Inspect DOM Hierarchy and Action Rules on Desktop
      const domStats = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, a.btn-glossy-gold, a[class*="gloss-yellow-btn"], button[type="submit"]'));
        const visibleButtons = allButtons.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });

        const primaryButtons = visibleButtons.filter((btn) => {
          if (btn.getAttribute('role') === 'switch') return false;
          const cls = btn.className || '';
          const isPrimaryGold = cls.includes('gloss-yellow-btn') || cls.includes('btn-glossy-gold');
          const isPrimaryYellowBg = /(^|\s)bg-\[#F5C518\](\s|$)/.test(cls);
          return isPrimaryGold || isPrimaryYellowBg;
        });

        const bodyBg = window.getComputedStyle(document.body).backgroundColor;
        const glassPanels = document.querySelectorAll('.cockpit-card, .telemetry-card, .liquid-glass, .liquid-glass-elevated');

        const hasSkeletonDiv = document.querySelectorAll('div.animate-pulse, .animate-pulse:not(span)').length > 0;

        return {
          totalButtons: visibleButtons.length,
          primaryButtonCount: primaryButtons.length,
          primaryButtonTexts: primaryButtons.map((b) => b.textContent?.trim().replace(/\s+/g, ' ')),
          bodyBackground: bodyBg,
          glassPanelCount: glassPanels.length,
          hasLoadingSkeleton: hasSkeletonDiv,
        };
      });

      console.log(`  ✓ Route ${route.path} [Desktop]:`);
      console.log(`    - Primary Action Count: ${domStats.primaryButtonCount} (${domStats.primaryButtonTexts.join(', ') || 'None'})`);
      console.log(`    - Glass Panels: ${domStats.glassPanelCount}`);
      console.log(`    - Skeletons: ${domStats.hasLoadingSkeleton ? 'YES (UNSTABLE)' : 'NONE (STABLE DATA)'}`);
      console.log(`    - Clipping Issues: ${desktopClippingIssues.length}`);
      console.log(`    - Captured: ${route.name}-desktop.png`);

      // Mobile Capture (390x844 iPhone standard)
      await page.setViewport({ width: 390, height: 844 });
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await new Promise((r) => setTimeout(r, 400));
      await waitForContentLoaded(page, route.path);

      // Check for nested clipping defects on mobile
      const mobileClippingIssues = await page.evaluate(() => {
        const found = [];
        const all = document.querySelectorAll('div, table, section, article, p, h1, h2, h3, h4, span, a');
        for (const el of all) {
          const style = window.getComputedStyle(el);
          if (
            style.overflowX === 'hidden' &&
            style.textOverflow !== 'ellipsis' &&
            el.scrollWidth > el.clientWidth + 4 &&
            el.clientWidth > 0
          ) {
            found.push({
              tag: el.tagName,
              cls: el.className.slice(0, 50),
              scrollW: el.scrollWidth,
              clientW: el.clientWidth,
              text: el.textContent?.slice(0, 30).trim()
            });
          }
        }
        return found;
      });

      const mobileShotPath = path.join(OUTPUT_DIR, `${route.name}-mobile.png`);
      await page.screenshot({ path: mobileShotPath, fullPage: false });
      console.log(`    - Mobile Clipping Issues: ${mobileClippingIssues.length}`);
      console.log(`    - Captured: ${route.name}-mobile.png`);

      inspectionResults.push({
        route: route.path,
        title: route.title,
        ...domStats,
        desktopClippingIssues: desktopClippingIssues.length,
        mobileClippingIssues: mobileClippingIssues.length,
      });
    }

    // 1. Unauthenticated: Capture Public & Auth Pages
    console.log('--- Step 1: Inspecting & Capturing Public & Auth Pages ---');
    for (const route of PUBLIC_ROUTES_TO_INSPECT) {
      await inspectAndCaptureRoute(route);
    }

    // 2. Sign In
    console.log('\n--- Step 2: Signing in as Founder ---');
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/overview', { timeout: 45000 });
    console.log('  ✓ Successfully logged in, arrived at /overview');

    // 3. Inspect Core & Extended Authenticated Routes (Desktop & Mobile)
    console.log('\n--- Step 3: Inspecting Core & Detail Authenticated Routes ---');
    for (const route of ROUTES_TO_INSPECT) {
      await inspectAndCaptureRoute(route);
    }

    console.log('\n--- Step 4: Summary of Visual Inspection ---');
    console.table(
      inspectionResults.map((r) => ({
        Route: r.route,
        PrimaryCTAs: r.primaryButtonCount,
        Action: r.primaryButtonTexts[0] || 'N/A',
        GlassPanels: r.glassPanelCount,
        Skeletons: r.hasLoadingSkeleton ? 'FAIL' : 'PASS',
        ClipDesk: r.desktopClippingIssues,
        ClipMob: r.mobileClippingIssues,
        BodyBg: r.bodyBackground,
      }))
    );

    // Write inspection report JSON
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'inspection-summary.json'),
      JSON.stringify(inspectionResults, null, 2)
    );
    console.log(`\nWritten visual inspection summary to docs/visual-evidence/inspection-summary.json`);
  } catch (err) {
    console.error('Visual capture failed with error:', err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

captureScreenshots();
