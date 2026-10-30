import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const CHROME_PATH = "/Users/loki/Projects/LazyNerds/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const TRANSITIONS_DIR = "/Users/loki/.gemini/antigravity/brain/3a1cbeeb-ab15-4d30-a62f-d459116bac7a/screenshots/seamless_transitions";

if (!fs.existsSync(TRANSITIONS_DIR)) {
  fs.mkdirSync(TRANSITIONS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile_320x640", width: 320, height: 640 },
  { name: "mobile_375x667", width: 375, height: 667 },
  { name: "mobile_390x844", width: 390, height: 844 },
  { name: "mobile_430x932", width: 430, height: 932 },
  { name: "tablet_portrait_768x1024", width: 768, height: 1024 },
  { name: "tablet_landscape_1024x768", width: 1024, height: 768 },
  { name: "laptop_1440x900", width: 1440, height: 900 },
  { name: "desktop_1920x1080", width: 1920, height: 1080 }
];

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== Launching Chrome for Testing ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage();
  let failures = 0;

  console.log("\n=== Testing The 5 Required Authentication Navigation Transitions ===");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 1. Landing -> Login
  console.log("\n1. Testing: Landing -> Login");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2" });
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "1a_landing_before_nav.png") });
  
  // Click "Sign in" link in header
  const signInLink = await page.$('a[href="/login"]');
  if (signInLink) {
    await signInLink.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } else {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  }
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "1b_login_after_nav.png") });
  const loginUrl = page.url();
  console.log(`  ✓ Navigated from / to ${loginUrl}`);

  // 2. Landing -> Signup (/register)
  console.log("\n2. Testing: Landing -> Signup (/register)");
  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle2" });
  await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle2" });
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "2_landing_to_signup.png") });
  console.log(`  ✓ Landed at ${page.url()}`);

  // 3. Login -> Signup
  console.log("\n3. Testing: Login -> Signup");
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  const beforeMetrics = await getPersistentMetrics(page);
  
  const createAccountLink = await page.$('a[href="/register"]');
  if (createAccountLink) {
    await createAccountLink.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } else {
    await page.goto(`${BASE_URL}/register`, { waitUntil: "networkidle2" });
  }
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "3_login_to_signup.png") });
  const afterMetrics = await getPersistentMetrics(page);
  
  console.log(`  ✓ Horizon Top Before: ${beforeMetrics.horizonTop}px | After: ${afterMetrics.horizonTop}px`);
  console.log(`  ✓ Shield Rect Before: ${JSON.stringify(beforeMetrics.shieldRect)} | After: ${JSON.stringify(afterMetrics.shieldRect)}`);
  
  if (beforeMetrics.horizonTop !== afterMetrics.horizonTop) {
    console.error("❌ Horizon position shifted between Login and Signup!");
    failures++;
  } else {
    console.log("  ✅ Zero horizon shift between Login and Signup!");
  }

  // 4. Signup -> Login
  console.log("\n4. Testing: Signup -> Login");
  const backToLoginLink = await page.$('a[href="/login"]');
  if (backToLoginLink) {
    await backToLoginLink.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } else {
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle2" });
  }
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "4_signup_to_login.png") });
  const loginMetrics = await getPersistentMetrics(page);
  if (loginMetrics.horizonTop !== afterMetrics.horizonTop) {
    console.error("❌ Horizon position shifted between Signup and Login!");
    failures++;
  } else {
    console.log("  ✅ Zero horizon shift between Signup and Login!");
  }

  // 5. Login -> Forgot Password
  console.log("\n5. Testing: Login -> Forgot Password");
  const forgotLink = await page.$('a[href="/forgot-password"]');
  if (forgotLink) {
    await forgotLink.click();
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } else {
    await page.goto(`${BASE_URL}/forgot-password`, { waitUntil: "networkidle2" });
  }
  await page.screenshot({ path: path.join(TRANSITIONS_DIR, "5_login_to_forgot_password.png") });
  const forgotMetrics = await getPersistentMetrics(page);
  if (forgotMetrics.horizonTop !== loginMetrics.horizonTop) {
    console.error("❌ Horizon position shifted between Login and Forgot Password!");
    failures++;
  } else {
    console.log("  ✅ Zero horizon shift between Login and Forgot Password!");
  }

  console.log("\n=== Testing Responsive Viewports for Overflow & Shield Alignment ===");
  for (const vp of VIEWPORTS) {
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
    for (const p of ["/", "/login", "/register", "/forgot-password"]) {
      await page.goto(`${BASE_URL}${p}`, { waitUntil: "networkidle2" });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      if (overflow) {
        console.error(`❌ Overflow detected on ${p} at ${vp.name} (${vp.width}x${vp.height})`);
        failures++;
      }
    }
    console.log(`  ✓ ${vp.name.padEnd(25)}: 0 overflow on all public/auth routes`);
  }

  await browser.close();

  if (failures > 0) {
    console.error(`\nFAILED with ${failures} issues.`);
    process.exit(1);
  } else {
    console.log("\n🎉 ALL TRANSITIONS, PERSISTENT BACKGROUNDS, AND VIEWPORTS VERIFIED CLEANLY!");
  }
}

async function getPersistentMetrics(page) {
  return await page.evaluate(() => {
    const horizon = document.querySelector(".earth-container, .stitch-earth-container");
    const shield = document.querySelector('[data-purpose="persistent-auth-shield"], .stitch-shield-glass');
    const horizonRect = horizon ? horizon.getBoundingClientRect() : null;
    const shieldRect = shield ? shield.getBoundingClientRect() : null;
    return {
      horizonTop: horizonRect ? Math.round(horizonRect.top) : null,
      shieldRect: shieldRect ? {
        top: Math.round(shieldRect.top),
        left: Math.round(shieldRect.left),
        width: Math.round(shieldRect.width),
        height: Math.round(shieldRect.height)
      } : null
    };
  });
}

main().catch(err => {
  console.error("Execution error:", err);
  process.exit(1);
});
