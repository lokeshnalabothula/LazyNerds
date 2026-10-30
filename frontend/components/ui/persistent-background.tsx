"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FixOpsBackground, FixOpsAuthShield } from "./fixops-background";

/**
 * Public routes that share the persistent FixOps atmospheric background
 */
const PUBLIC_AUTH_ROUTES = [
  "/",
  "/login",
  "/register",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
];

/**
 * Routes that display the centered specular auth shield behind the card
 */
const AUTH_ROUTES = [
  "/login",
  "/register",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

/**
 * PersistentBackground
 * 
 * Sits in the RootLayout so it NEVER unmounts during client-side navigation
 * between public and authentication pages. This eliminates background
 * flashes, prevents shield repositioning/restarting, and keeps the planetary
 * horizon, lasers, and lighting completely rock-solid.
 */
export function PersistentBackground() {
  const pathname = usePathname();

  // Match root or any sub-path of public routes
  const isPublicRoute = PUBLIC_AUTH_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );

  if (!isPublicRoute) {
    return null;
  }

  const isLanding = pathname === "/";
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  return (
    <div
      aria-hidden="true"
      className="persistent-background-root fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      data-purpose="persistent-background"
    >
      {/* Persistent atmospheric cosmic backdrop: grid, laser ray, horizon & lighting */}
      <FixOpsBackground showRings={isLanding} />

      {/* Persistent specular cyber shield:
          Anchored precisely to the center of the viewport behind authentication
          cards across /login, /register, /forgot-password, /reset-password.
          Because it is hosted here in RootLayout, it NEVER unmounts or flashes
          when the user navigates between authentication steps. */}
      {isAuthRoute && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 transition-opacity duration-300"
          data-purpose="persistent-auth-shield"
        >
          <FixOpsAuthShield />
        </div>
      )}
    </div>
  );
}

export default PersistentBackground;
