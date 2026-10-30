import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes accessible without authentication.
 * Per specification: ONLY Landing (/), Login (/login), and Register (/register)
 * are publicly accessible. All other routes are protected and require authentication.
 */
const PUBLIC_PATHS = new Set(["/", "/login", "/register"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Pass through static files, Next.js internal assets, and API routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname === "/apple-icon.png" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // 2. Check for the authentication token cookie
  const token = request.cookies.get("fixops_access_token")?.value;
  const isAuthenticated = Boolean(token && token.trim().length > 0);

  // 3. If authenticated user tries to access /login or /register, redirect to dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    const redirectParam = request.nextUrl.searchParams.get("redirect");
    let target = "/overview";
    if (
      redirectParam &&
      redirectParam.startsWith("/") &&
      !redirectParam.startsWith("//") &&
      redirectParam !== "/login" &&
      redirectParam !== "/register"
    ) {
      target = redirectParam;
    }
    const dashboardUrl = new URL(target, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 4. If path is in the strictly permitted public routes list, allow access
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 5. For ALL other routes (/register/status, /overview, /clients, /domains, /assets, /findings,
  // /reports, /settings, /audit, /privacy, /terms, etc.), require authentication.
  // If not authenticated, redirect to /login with preserved redirect path.
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    const redirectTarget = pathname + (request.nextUrl.search || "");
    loginUrl.searchParams.set("redirect", redirectTarget);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files with extensions (.css, .js, .png, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
