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

const ROUTES_TO_INSPECT = [
  { path: '/overview', name: 'overview', title: 'Dashboard Telemetry' },
  { path: '/clients', name: 'clients', title: 'Client Directory' },
  { path: '/engagements', name: 'engagements', title: 'Engagements LifeCycle' },
  { path: '/assets', name: 'assets', title: 'Target Assets Inventory' },
  { path: '/findings', name: 'findings', title: 'Vulnerabilities & Triage' },
  { path: '/automation', name: 'automation', title: 'Workflow Automation' },
  { path: '/reports', name: 'reports', title: 'Reporting & Deliverables' },
  { path: '/registrations', name: 'registrations', title: 'Founder Onboarding Queue' },
];

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

    // 1. Unauthenticated: Capture Login & Register
    console.log('--- Step 1: Capturing Public & Auth Pages ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'login-desktop.png') });
    console.log('  ✓ Captured: login-desktop.png');

    await page.setViewport({ width: 375, height: 812 });
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'login-mobile.png') });
    console.log('  ✓ Captured: login-mobile.png');

    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'register-desktop.png') });
    console.log('  ✓ Captured: register-desktop.png');

    // 2. Sign In
    console.log('\n--- Step 2: Signing in as Founder ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/overview', { timeout: 45000 });
    console.log('  ✓ Successfully logged in, arrived at /overview');

    // 3. Inspect Core Authenticated Routes (Desktop & Mobile)
    console.log('\n--- Step 3: Inspecting Core Authenticated Routes ---');
    for (const route of ROUTES_TO_INSPECT) {
      // Desktop Capture (1280x800)
      await page.setViewport({ width: 1280, height: 800 });
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle2' });
      await new Promise((r) => setTimeout(r, 1200));

      const desktopShotPath = path.join(OUTPUT_DIR, `${route.name}-desktop.png`);
      await page.screenshot({ path: desktopShotPath, fullPage: false });

      // Inspect DOM Hierarchy and Action Rules on Desktop
      const domStats = await page.evaluate(() => {
        // Find all visible buttons
        const allButtons = Array.from(document.querySelectorAll('button, a.btn-glossy-gold, a[class*="gloss-yellow-btn"]'));
        const visibleButtons = allButtons.filter((btn) => {
          const rect = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
        });

        // Identify primary action buttons (having glossy gold class or primary styling)
        const primaryButtons = visibleButtons.filter((btn) => {
          const cls = btn.className || '';
          return (
            cls.includes('gloss-yellow-btn') ||
            cls.includes('btn-glossy-gold') ||
            cls.includes('bg-linear-to-b from-[#FFD84D]')
          );
        });

        // Get body background color
        const bodyBg = window.getComputedStyle(document.body).backgroundColor;

        // Count cockpit cards
        const cockpitCards = document.querySelectorAll('.cockpit-card, .telemetry-card');

        return {
          totalButtons: visibleButtons.length,
          primaryButtonCount: primaryButtons.length,
          primaryButtonTexts: primaryButtons.map((b) => b.textContent?.trim().replace(/\s+/g, ' ')),
          bodyBackground: bodyBg,
          cockpitCardCount: cockpitCards.length,
        };
      });

      console.log(`  ✓ Route ${route.path} [Desktop]:`);
      console.log(`    - Primary Action Count: ${domStats.primaryButtonCount} (${domStats.primaryButtonTexts.join(', ') || 'None'})`);
      console.log(`    - Cockpit Cards: ${domStats.cockpitCardCount}`);
      console.log(`    - Captured: ${route.name}-desktop.png`);

      // Mobile Capture (375x812)
      await page.setViewport({ width: 375, height: 812 });
      await new Promise((r) => setTimeout(r, 800));
      const mobileShotPath = path.join(OUTPUT_DIR, `${route.name}-mobile.png`);
      await page.screenshot({ path: mobileShotPath, fullPage: false });
      console.log(`    - Captured: ${route.name}-mobile.png`);

      inspectionResults.push({
        route: route.path,
        title: route.title,
        ...domStats,
      });
    }

    console.log('\n--- Step 4: Summary of Visual Inspection ---');
    console.table(
      inspectionResults.map((r) => ({
        Route: r.route,
        PrimaryCTAs: r.primaryButtonCount,
        Action: r.primaryButtonTexts[0] || 'N/A',
        CockpitCards: r.cockpitCardCount,
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
