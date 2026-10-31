import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Public routes accessible without authentication.
 * Both /register and /signup are treated as public onboarding routes.
 */
export const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/register/status",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/audit",
  "/domain-verification",
  "/security-score",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Canonicalize /signup to /register
  if (pathname === "/signup") {
    const url = request.nextUrl.clone();
    url.pathname = "/register";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icon.svg, apple-icon.png (brand icon files)
     */
    "/((?!api|_next/static|_next/image|favicon\\.ico|icon\\.svg|apple-icon\\.png).*)",
  ],
};
