"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { FixOpsBackground, FixOpsAuthShield } from "./fixops-background";

/**
 * Public routes that share the persistent FixOps atmospheric cosmic backdrop
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
  "/domain-verification",
  "/security-score",
];

/**
 * Public routes that display the unified centered specular cyber shield
 */
const PUBLIC_SHIELD_ROUTES = [
  "/",
  "/login",
  "/register",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/domain-verification",
  "/security-score",
];

/**
 * PersistentBackground
 * 
 * Sits in the RootLayout so it NEVER unmounts during client-side navigation
 * between Landing, Login, Registration, Forgot Password, and Reset Password.
 * 
 * Guarantees 100% visual identity parity:
 * - Identical obsidian cosmic grid, vertical laser ray, and orbital concentric rings
 * - Identical curved planetary Earth limb horizon and atmospheric dawn lighting
 * - Identical centered specular cyber shield with apex flare, energy pulses, and frosted glass fill
 * - Zero shift, zero flicker, zero restart across all public routes
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

  // Display shield consistently across Landing and all auth/recovery flows
  const hasShield = PUBLIC_SHIELD_ROUTES.some((route) =>
    route === "/" ? pathname === "/" : pathname.startsWith(route)
  );

  return (
    <div
      aria-hidden="true"
      className="persistent-background-root fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      data-purpose="persistent-background"
    >
      {/* Persistent atmospheric cosmic backdrop: grid, laser ray, horizon, rings & lighting */}
      <FixOpsBackground showRings={true} />

      {/* Persistent unified specular cyber shield:
          Anchored precisely to the center of the viewport behind the landing hero
          and authentication cards across /login, /register, /forgot-password, /reset-password.
          Because it is hosted here in RootLayout, it NEVER unmounts, jumps, or flashes. */}
      {hasShield && (
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
