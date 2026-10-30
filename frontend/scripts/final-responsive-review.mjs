import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const puppeteer = require("puppeteer-core");

const CHROME_PATH = "/Users/loki/Projects/LazyNerds/chrome/mac_arm-156.0.8078.80/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";
const SCREENSHOT_DIR = "/Users/loki/.gemini/antigravity/brain/3a1cbeeb-ab15-4d30-a62f-d459116bac7a/screenshots/final_review";

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "mobile_portrait_390x844", width: 390, height: 844, category: "mobile" },
  { name: "mobile_landscape_844x390", width: 844, height: 390, category: "mobile" },
  { name: "tablet_portrait_768x1024", width: 768, height: 1024, category: "tablet" },
  { name: "tablet_landscape_1024x768", width: 1024, height: 768, category: "tablet" },
  { name: "laptop_1440x900", width: 1440, height: 900, category: "laptop" },
  { name: "desktop_1920x1080", width: 1920, height: 1080, category: "desktop" }
];

const PAGES = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/register", name: "register" }
];

const ZOOM_LEVELS = [
  { zoom: "80%", factor: 0.8 },
  { zoom: "90%", factor: 0.9 },
  { zoom: "100%", factor: 1.0 },
  { zoom: "110%", factor: 1.1 },
  { zoom: "125%", factor: 1.25 },
  { zoom: "150%", factor: 1.5 }
];

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("=== 1. Launching Chrome for Testing ===");
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"]
  });

  const page = await browser.newPage();
  let failures = 0;

  console.log("\n=== 2. Testing Route Redirection: /signup -> /register ===");
  await page.goto(`${BASE_URL}/signup`, { waitUntil: "networkidle2" });
  const currentUrl = page.url();
  console.log(`Visited ${BASE_URL}/signup -> Landed at: ${currentUrl}`);
  if (currentUrl.endsWith("/register")) {
    console.log("✅ Canonical redirect passed: /signup correctly redirected to /register");
  } else {
    console.error(`❌ Redirect failed: Expected ${BASE_URL}/register, got ${currentUrl}`);
    failures++;
  }

  console.log("\n=== 3. Capturing Screenshots & Measuring Dimensions Across Viewports ===");
  const metricsReport = [];

  for (const vp of VIEWPORTS) {
    console.log(`\nTesting Viewport: ${vp.name} (${vp.width}x${vp.height})`);
    await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 2 });

    for (const pg of PAGES) {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: "networkidle2" });

      // Capture screenshot
      const shotPath = path.join(SCREENSHOT_DIR, `${pg.name}_${vp.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });

      // Measure layout metrics
      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const scrollW = root.scrollWidth;
        const clientW = root.clientWidth;
        const overflow = scrollW > clientW + 1;

        const shield = document.querySelector(".shield-assembly, .stitch-shield-glass, svg defs linearGradient");
        const card = document.querySelector(".stitch-specular-card");
        const horizon = document.querySelector(".earth-container, .stitch-earth-container");
        const headline = document.querySelector("h1");

        const horizonRect = horizon ? horizon.getBoundingClientRect() : null;
        const cardRect = card ? card.getBoundingClientRect() : null;
        const headlineStyle = headline ? window.getComputedStyle(headline) : null;

        return {
          scrollW,
          clientW,
          overflow,
          horizonTop: horizonRect ? Math.round(horizonRect.top) : null,
          horizonHeight: horizonRect ? Math.round(horizonRect.height) : null,
          cardWidth: cardRect ? Math.round(cardRect.width) : null,
          cardHeight: cardRect ? Math.round(cardRect.height) : null,
          fontSize: headlineStyle ? headlineStyle.fontSize : null,
          shieldFound: !!shield
        };
      });

      if (metrics.overflow) {
        console.error(`❌ Overflow detected on ${pg.name} at ${vp.name}! scrollWidth: ${metrics.scrollW}, clientWidth: ${metrics.clientW}`);
        failures++;
      } else {
        console.log(`  ✓ ${pg.name.padEnd(8)} | card: ${metrics.cardWidth ? `${metrics.cardWidth}px` : "N/A".padEnd(5)} | horizonTop: ${metrics.horizonTop}px | h1 font: ${metrics.fontSize} | overflow: none`);
      }

      metricsReport.push({
        viewport: vp.name,
        page: pg.name,
        ...metrics,
        screenshot: shotPath
      });
    }
  }

  console.log("\n=== 4. Browser Zoom Resilience (80% -> 150%) ===");
  for (const z of ZOOM_LEVELS) {
    const effW = Math.round(1440 / z.factor);
    const effH = Math.round(900 / z.factor);
    await page.setViewport({ width: effW, height: effH, deviceScaleFactor: 1 });

    for (const pg of PAGES) {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: "networkidle2" });
      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      });
      if (overflow) {
        console.error(`❌ Zoom overflow on ${pg.name} at ${z.zoom}`);
        failures++;
      }
    }
    console.log(`  ✓ Zoom level ${z.zoom.padEnd(5)} (effective ${effW}x${effH}) - All 3 pages clean`);
  }

  await browser.close();

  // Save metrics summary JSON
  const summaryFile = path.join(SCREENSHOT_DIR, "metrics_summary.json");
  fs.writeFileSync(summaryFile, JSON.stringify(metricsReport, null, 2), "utf8");

  console.log(`\nMetrics and screenshots recorded at: ${SCREENSHOT_DIR}`);
  if (failures > 0) {
    console.error(`FAILED with ${failures} issues.`);
    process.exit(1);
  } else {
    console.log("🎉 ALL RESPONSIVE, ZOOM, AND REDIRECT CHECKS PASSED PERFECTLY!");
  }
}

main().catch(err => {
  console.error("Test execution encountered an error:", err);
  process.exit(1);
});
