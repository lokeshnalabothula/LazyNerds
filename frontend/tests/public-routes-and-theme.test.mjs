import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

test("Public Routes Security & Routing Policy", async (t) => {
  const middlewarePath = path.join(rootDir, "middleware.ts");
  assert.ok(fs.existsSync(middlewarePath), "middleware.ts must exist in frontend root");

  const middlewareContent = fs.readFileSync(middlewarePath, "utf-8");

  await t.test("PUBLIC_PATHS strictly permits only '/', '/login', and '/signup'", () => {
    // Assert PUBLIC_PATHS definition
    const publicPathsMatch = middlewareContent.match(/PUBLIC_PATHS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    assert.ok(publicPathsMatch, "PUBLIC_PATHS Set must be defined in middleware.ts");

    const paths = publicPathsMatch[1]
      .split(",")
      .map((p) => p.trim().replace(/['"]/g, ""))
      .filter(Boolean);

    assert.deepEqual(
      paths.sort(),
      ["/", "/login", "/signup"].sort(),
      "PUBLIC_PATHS must contain exactly '/', '/login', and '/signup'"
    );
  });

  await t.test("middleware redirects unauthenticated requests on protected routes to /login", () => {
    assert.match(
      middlewareContent,
      /loginUrl\.searchParams\.set\("redirect",\s*redirectTarget\)/,
      "Unauthenticated users must be redirected to /login with preserved redirect param"
    );
    assert.match(
      middlewareContent,
      /NextResponse\.redirect\(loginUrl\)/,
      "Unauthenticated users must receive a redirect response"
    );
  });

  await t.test("middleware redirects authenticated users away from /login and /signup to /overview", () => {
    assert.match(
      middlewareContent,
      /pathname === "\/login"\s*\|\|\s*pathname === "\/signup"/,
      "Authenticated users visiting /login or /signup must be intercepted"
    );
    assert.match(
      middlewareContent,
      /target\s*=\s*redirectParam|\/overview/,
      "Authenticated users must be redirected to /overview or safe target"
    );
  });

  await t.test("middleware inspects fixops_access_token cookie", () => {
    assert.match(
      middlewareContent,
      /request\.cookies\.get\("fixops_access_token"\)/,
      "Middleware must check the fixops_access_token cookie for authentication"
    );
  });
});

test("Theme Consistency Across Public Pages (/, /login, /signup)", async (t) => {
  const landingPath = path.join(rootDir, "app", "page.tsx");
  const loginPath = path.join(rootDir, "app", "login", "page.tsx");
  const signupPath = path.join(rootDir, "app", "signup", "page.tsx");

  assert.ok(fs.existsSync(landingPath), "Landing page app/page.tsx must exist");
  assert.ok(fs.existsSync(loginPath), "Login page app/login/page.tsx must exist");
  assert.ok(fs.existsSync(signupPath), "Signup page app/signup/page.tsx must exist");

  const landingCode = fs.readFileSync(landingPath, "utf-8");
  const loginCode = fs.readFileSync(loginPath, "utf-8");
  const signupCode = fs.readFileSync(signupPath, "utf-8");

  await t.test("Obsidian bedrock dark palette (#030407 / #07080b) is used across public pages", () => {
    assert.ok(
      landingCode.includes("#030407") || landingCode.includes("#040609") || landingCode.includes("#07080b"),
      "Landing page must use obsidian bedrock dark palette"
    );
    assert.ok(
      loginCode.includes("#030407") || loginCode.includes("#040609"),
      "Login page must use obsidian bedrock dark palette"
    );
    assert.ok(
      signupCode.includes("#030407") || signupCode.includes("#040609"),
      "Signup page must use obsidian bedrock dark palette"
    );
  });

  await t.test("Stitch specular card structure is maintained across login and signup", () => {
    assert.match(loginCode, /stitch-specular-card/, "Login page must use stitch-specular-card chassis");
    assert.match(signupCode, /stitch-specular-card/, "Signup page must use stitch-specular-card chassis");
  });

  await t.test("Liquid metal CTA button is maintained across login and signup", () => {
    assert.match(loginCode, /stitch-liquid-metal-btn/, "Login page must use stitch-liquid-metal-btn CTA");
    assert.match(signupCode, /stitch-liquid-metal-btn/, "Signup page must use stitch-liquid-metal-btn CTA");
  });

  await t.test("Vertical laser axis ray and atmospheric lighting exist across public pages", () => {
    assert.match(landingCode, /vertical-axis-ray/, "Landing page must feature vertical-axis-ray");
    assert.match(loginCode, /vertical-axis-ray/, "Login page must feature vertical-axis-ray");
    assert.match(signupCode, /vertical-axis-ray/, "Signup page must feature vertical-axis-ray");
  });
});

test("Public Page Navigation & Action Isolation", async (t) => {
  const landingPath = path.join(rootDir, "app", "page.tsx");
  const loginPath = path.join(rootDir, "app", "login", "page.tsx");
  const signupPath = path.join(rootDir, "app", "signup", "page.tsx");

  const landingCode = fs.readFileSync(landingPath, "utf-8");
  const loginCode = fs.readFileSync(loginPath, "utf-8");
  const signupCode = fs.readFileSync(signupPath, "utf-8");

  await t.test("Landing page exposes /login and /signup in top navigation", () => {
    assert.match(landingCode, /href="\/login"/, "Landing page must link to /login");
    assert.match(landingCode, /href="\/signup"/, "Landing page must link to /signup");
    assert.match(landingCode, />Sign in</, "Landing page must display 'Sign in' link");
    assert.match(landingCode, />Sign up</, "Landing page must display 'Sign up' link");
  });

  await t.test("Login page links to /signup and / (Back to scan)", () => {
    assert.match(loginCode, /href="\/signup"/, "Login page must link to /signup");
    assert.match(loginCode, /href="\/"/, "Login page must link to /");
  });

  await t.test("Signup page links to /login and / (Back to scan)", () => {
    assert.match(signupCode, /href="\/login"/, "Signup page must link to /login");
    assert.match(signupCode, /href="\/"/, "Signup page must link to /");
  });

  await t.test("Authenticated navigation (FloatingNav, AppShell) is NOT imported in public pages", () => {
    assert.doesNotMatch(landingCode, /FloatingNav|AppShell/, "Landing page must not render FloatingNav or AppShell");
    assert.doesNotMatch(loginCode, /FloatingNav|AppShell/, "Login page must not render FloatingNav or AppShell");
    assert.doesNotMatch(signupCode, /FloatingNav|AppShell/, "Signup page must not render FloatingNav or AppShell");
  });
});
