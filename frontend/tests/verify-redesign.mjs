import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

// Discover browser executable (Brave, Chrome, or environment override)
const BROWSER_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  process.env.CHROME_PATH ||
  process.env.BRAVE_PATH ||
  (fs.existsSync('/Applications/Brave Browser.app/Contents/MacOS/Brave Browser')
    ? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser'
    : fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : '/usr/bin/chromium-browser');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUTPUT_DIR = process.env.ARTIFACTS_DIR || path.resolve('./docs/visual-evidence/audit-redesign');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Read credentials
let credFile = path.resolve('.fixops_founder_credentials.local.txt');
if (!fs.existsSync(credFile)) {
  credFile = path.resolve('../.fixops_founder_credentials.local.txt');
}
let email = 'lokeshnalabothula@gmail.com';
let password = 'change_this_to_a_strong_password_in_production';
if (fs.existsSync(credFile)) {
  const content = fs.readFileSync(credFile, 'utf8');
  for (const line of content.split('\n')) {
    if (line.startsWith('FOUNDER_EMAIL=')) email = line.split('=')[1].trim();
    if (line.startsWith('FOUNDER_PASSWORD=')) password = line.split('=')[1].trim();
  }
}

async function run() {
  if (!fs.existsSync(BROWSER_PATH)) {
    console.warn(`Browser binary not found at ${BROWSER_PATH}. Set PUPPETEER_EXECUTABLE_PATH to run visual verification.`);
    return;
  }

  console.log(`Launching browser from ${BROWSER_PATH}...`);
  const browser = await puppeteer.launch({
    executablePath: BROWSER_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const page = await browser.newPage();
  page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', (err) => console.error('PAGE ERROR:', err.message));

  try {
    // 1. Login
    console.log('Navigating to login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', email);
    await page.type('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => window.location.pathname === '/overview', { timeout: 45000 });
    console.log('Successfully logged in, arrived at /overview');

    // 2. Navigate to /audit
    console.log('Navigating to /audit...');
    await page.goto(`${BASE_URL}/audit`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture initial idle state
    const idlePath = path.join(OUTPUT_DIR, 'redesigned_audit_idle_state.png');
    await page.screenshot({ path: idlePath, fullPage: true });
    console.log(`Captured idle state to ${idlePath}`);

    // 3. Fill in target directly
    console.log('Entering target URL and certifying RoE...');
    await page.waitForSelector('#target-url', { timeout: 10000 });
    await page.type('#target-url', 'http://127.0.0.1:8888');
    await page.click('#confirm-auth');
    await new Promise((r) => setTimeout(r, 600));

    // 4. Submit scan
    const formState = await page.evaluate(() => {
      const input = document.querySelector('#target-url');
      const auth = document.querySelector('#confirm-auth');
      const submitBtn = document.querySelector('button[type="submit"]');
      return {
        url: input ? input.value : null,
        confirmedAuth: auth ? auth.checked : null,
        submitDisabled: submitBtn ? submitBtn.disabled : null,
      };
    });
    console.log('Form State before submit:', JSON.stringify(formState));

    console.log('Clicking Scan Website...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    }

    // 5. Wait for scan to complete
    console.log('Waiting for scan completion...');
    await page.waitForFunction(
      () => {
        return document.body.innerText.includes('Website Audit Summary') ||
               document.body.innerText.includes('Filter Findings by Risk Level');
      },
      { timeout: 30000 }
    );
    console.log('Scan completed!');

    await new Promise((r) => setTimeout(r, 2000));

    // Capture results overview
    const resultsOverviewPath = path.join(OUTPUT_DIR, 'redesigned_audit_results_overview.png');
    await page.screenshot({ path: resultsOverviewPath, fullPage: true });
    console.log(`Captured results overview to ${resultsOverviewPath}`);

    // 6. Expand the first finding's details
    console.log('Expanding first finding details...');
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.textContent && b.textContent.includes('View Details'));
    }, { timeout: 15000 });

    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(b => b.textContent && b.textContent.includes('View Details'));
      if (target) target.click();
    });
    console.log('Clicked View Details button via page.evaluate!');

    // Wait for animation & content
    await page.waitForFunction(
      () => document.body.innerText.includes('1. What is the problem?') &&
            document.body.innerText.includes('6. How can I fix it?'),
      { timeout: 10000 }
    );
    await new Promise((r) => setTimeout(r, 1000));

    // Capture expanded details showing 7 core questions
    const expandedPath = path.join(OUTPUT_DIR, 'redesigned_audit_finding_expanded.png');
    await page.screenshot({ path: expandedPath, fullPage: true });
    console.log(`Captured expanded finding report to ${expandedPath}`);

  } catch (err) {
    console.error('Error during inspection:', err);
  } finally {
    await browser.close();
  }
}

run();
