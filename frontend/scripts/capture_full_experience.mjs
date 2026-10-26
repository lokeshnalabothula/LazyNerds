import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const BRAVE_PATH = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const BASE_URL = process.env.BASE_URL || 'https://lazynerds.vercel.app';
const OUT_DIR = '/Users/loki/.gemini/antigravity/brain/437e5cf8-93fe-431f-9762-d87dc339ccfe/stitch_screens';

async function main() {
  console.log('--- Launching Brave Browser for Full Experience Screen Capture ---');
  const browser = await puppeteer.launch({
    executablePath: BRAVE_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1600,1050'],
    defaultViewport: { width: 1600, height: 1050 },
  });

  const page = await browser.newPage();

  try {
    // 1. Login
    console.log('[1/7] Navigating to /login...');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('input[type="email"]');
    await page.type('input[type="email"]', 'lokeshnalabothula@gmail.com');
    await page.type('input[type="password"]', '12345678');
    await page.click('button[type="submit"]');

    console.log('  Waiting for redirect to /overview...');
    await page.waitForFunction(() => window.location.pathname === '/overview', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));

    // Capture Overview
    console.log('[2/7] Capturing /overview (Command Deck)...');
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_command_deck.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_command_deck.png');

    // Capture Radar
    console.log('[3/7] Navigating to /radar (Orbital Defense Radar)...');
    await page.goto(`${BASE_URL}/radar`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_orbital_radar.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_orbital_radar.png');

    // Capture Clients
    console.log('[4/7] Navigating to /clients (Client Directory Bento Grid)...');
    await page.goto(`${BASE_URL}/clients`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_client_directory.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_client_directory.png');

    // Capture Findings
    console.log('[5/7] Navigating to /findings (Vulnerability Pipeline)...');
    await page.goto(`${BASE_URL}/findings`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_vulnerability_pipeline.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_vulnerability_pipeline.png');

    // Capture Settings
    console.log('[6/7] Navigating to /settings (Cryptographic Enclave)...');
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_settings_enclave.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_settings_enclave.png');

    // Capture Audit
    console.log('[7/7] Navigating to /audit (Website Security Audit)...');
    await page.goto(`${BASE_URL}/audit`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(OUT_DIR, 'authenticated_website_audit.png'), fullPage: false });
    console.log('  ✓ Saved authenticated_website_audit.png');

    console.log('\nAll 6 authenticated screens captured with authentic Google Stitch design!');
  } catch (err) {
    console.error('Error during capture:', err);
  } finally {
    await browser.close();
  }
}

main();
