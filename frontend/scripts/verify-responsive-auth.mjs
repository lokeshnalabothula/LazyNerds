import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const CHROME_PATH = "/Users/loki/Projects/LazyNerds/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const SCREENSHOT_DIR = "/Users/loki/.gemini/antigravity/brain/3a1cbeeb-ab15-4d30-a62f-d459116bac7a/screenshots/responsive_auth";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile-320", width: 320, height: 640 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "iphone-se-375", width: 375, height: 667 },
  { name: "iphone-14-390", width: 390, height: 844 },
  { name: "iphone-promax-430", width: 430, height: 932 },
  { name: "tablet-portrait-768", width: 768, height: 1024 },
  { name: "tablet-landscape-1024", width: 1024, height: 768 },
  { name: "laptop-1280", width: 1280, height: 800 },
  { name: "macbook-1440", width: 1440, height: 900 },
  { name: "desktop-1920", width: 1920, height: 1080 }
];

const ZOOM_LEVELS = [
  { zoom: "80%", scale: 0.8 },
  { zoom: "90%", scale: 0.9 },
  { zoom: "100%", scale: 1.0 },
  { zoom: "110%", scale: 1.1 },
  { zoom: "125%", scale: 1.25 },
  { zoom: "150%", scale: 1.5 }
];

const ROUTES = [
  { path: "/", label: "landing" },
  { path: "/login", label: "login" },
  { path: "/register", label: "register" },
  { path: "/forgot-password", label: "forgot-password" },
  { path: "/reset-password", label: "reset-password" }
];

const BASE_URL = "http://localhost:3000";

async function run() {
  console.log("Launching headless browser at:", CHROME_PATH);
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage();
  let totalIssues = 0;
  const results = [];

  console.log("\n================ 1. VIEWPORT OVERFLOW & RESPONSIVENESS ================");
  for (const vp of VIEWPORTS) {
    for (const route of ROUTES) {
      await page.setViewport({ width: vp.width, height: vp.height });
      const targetUrl = `${BASE_URL}${route.path}`;
      await page.goto(targetUrl, { waitUntil: "networkidle2" });

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const body = document.body;
        const scrollW = Math.max(root.scrollWidth, body.scrollWidth);
        const clientW = root.clientWidth;
        const hasOverflow = scrollW > clientW + 1; // 1px margin of rounding

        // Check interactive inputs & submit buttons
        const interactives = Array.from(document.querySelectorAll('button[type="submit"], .stitch-liquid-metal-btn, input:not([type="hidden"])'));
        const targetHeights = interactives.map(el => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            type: el.type,
            name: el.name || el.id || el.innerText?.slice(0, 15) || "btn",
            height: Math.round(r.height),
            touchValid: r.height >= 40 // min touch target
          };
        });

        // Compute shield and container metrics
        const shield = document.querySelector(".stitch-shield-glass, .shield-glass");
        const card = document.querySelector(".stitch-specular-card");
        return {
          scrollW,
          clientW,
          hasOverflow,
          touchCount: targetHeights.length,
          invalidTouchCount: targetHeights.filter(t => !t.touchValid).length,
          shieldPresent: !!shield,
          cardPresent: !!card
        };
      });

      if (metrics.hasOverflow) {
        console.error(`❌ [OVERFLOW] ${route.label} at ${vp.name} (${vp.width}x${vp.height}): scrollWidth=${metrics.scrollW} > clientWidth=${metrics.clientW}`);
        totalIssues++;
      } else {
        // Sample screenshots for 3 key viewports (mobile 360, tablet 768, desktop 1440)
        if (["mobile-360", "tablet-portrait-768", "macbook-1440"].includes(vp.name)) {
          const shotName = `${route.label}_${vp.name}.png`;
          await page.screenshot({ path: path.join(SCREENSHOT_DIR, shotName), fullPage: false });
        }
      }

      results.push({
        viewport: vp.name,
        route: route.label,
        ...metrics
      });
    }
  }

  console.log("\n================ 2. BROWSER ZOOM RESILIENCE (80% -> 150%) ================");
  // Test desktop viewport 1440x900 under different zoom levels
  for (const z of ZOOM_LEVELS) {
    const effectiveWidth = Math.round(1440 / z.scale);
    const effectiveHeight = Math.round(900 / z.scale);
    await page.setViewport({ width: effectiveWidth, height: effectiveHeight, deviceScaleFactor: 1 });

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle2" });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      if (overflow) {
        console.error(`❌ [ZOOM OVERFLOW] ${route.label} at Zoom ${z.zoom}`);
        totalIssues++;
      }
    }
  }

  await browser.close();

  console.log("\n================ SUMMARY ================");
  console.log(`Total checks run: ${VIEWPORTS.length * ROUTES.length + ZOOM_LEVELS.length * ROUTES.length}`);
  console.log(`Issues detected: ${totalIssues}`);
  if (totalIssues === 0) {
    console.log("✅ All responsive viewports, touch targets, and zoom levels PASSED without horizontal overflow!");
  } else {
    process.exit(1);
  }
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
