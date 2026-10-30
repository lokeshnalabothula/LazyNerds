import React from "react";

interface FixOpsBackgroundProps {
  /**
   * Whether to display faint orbital concentric rings (used on the landing hero)
   * Defaults to false.
   */
  showRings?: boolean;
  /**
   * Optional custom CSS class for the background wrapper container
   */
  className?: string;
  /**
   * Optional child elements to render within the background container
   */
  children?: React.ReactNode;
}

/**
 * FixOpsBackground
 * Shared reusable atmospheric background component for Lazy Nerds FixOps.
 * Unifies the cosmic grid, vertical laser ray, technical reticle markers,
 * and the curved planetary earth limb with atmospheric lighting across
 * landing, login, registration, and recovery pages.
 */
export function FixOpsBackground({
  showRings = false,
  className = "",
  children,
}: FixOpsBackgroundProps) {
  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      data-purpose="background-layers"
    >
      {/* Deep technical grid lines */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:120px_120px]" />

      {/* Central Vertical Laser Ray */}
      <div className="vertical-axis-ray" />

      {/* Faint orbital coordinate concentric rings */}
      {showRings && (
        <>
          <div className="orbital-ring w-[920px] h-[920px] left-1/2 top-[34%] opacity-30" />
          <div className="orbital-ring w-[1280px] h-[1280px] left-1/2 top-[34%] opacity-20" />
        </>
      )}

      {/* Subtle reticle coordinate crosshair markers */}
      <div className="absolute top-[38%] left-[78px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
        + 45° 12&apos; N
      </div>
      <div className="absolute top-[41%] right-[68px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
        [X:00]
      </div>

      {/* Earth Limb & Atmospheric Arc */}
      <div className="earth-container stitch-earth-container">
        <div className="earth-surface-lights stitch-earth-surface-lights" />
        {/* Intense sub-surface dawn glow on center horizon with gentle cyber pulse */}
        <div className="horizon-glow-pulse absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[180px] bg-cyan-100/15 rounded-full blur-[48px]" />
        <div className="horizon-glow-pulse absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[70px] bg-white/40 rounded-full blur-[24px]" />
      </div>

      {children}
    </div>
  );
}

interface FixOpsAuthShieldProps {
  /**
   * Optional custom CSS scale or style override
   */
  className?: string;
}

/**
 * FixOpsAuthShield
 * Shared frosted specular cyber shield component positioned behind
 * authentication cards (login, register, forgot-password, reset-password).
 */
export function FixOpsAuthShield({ className = "" }: FixOpsAuthShieldProps) {
  return (
    <div
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0 ${className}`}
    >
      <div
        className="relative flex items-center justify-center origin-center opacity-85 transition-transform duration-300"
        style={{ transform: "scale(var(--auth-shield-scale, 0.78))" }}
      >
        {/* High-Definition SVG Cyber Shield Outline & Energy Contours */}
        <svg
          className="absolute inset-0 w-[580px] h-[610px] pointer-events-none z-10 overflow-visible"
          fill="none"
          viewBox="0 0 580 610"
        >
          <defs>
            {/* Chrome edge gradient for crest and flanks left */}
            <linearGradient id="shieldRimGradSharedLeft" x1="50%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.75" />
              <stop offset="65%" stopColor="#64748b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.85" />
            </linearGradient>

            {/* Chrome edge gradient for crest and flanks right */}
            <linearGradient id="shieldRimGradSharedRight" x1="50%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.75" />
              <stop offset="65%" stopColor="#64748b" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.85" />
            </linearGradient>

            {/* Traveling photon energy gradient left along perimeter */}
            <linearGradient id="photonCircuitGradLeftShared" x1="50%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#7bd0ff" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>

            {/* Traveling photon energy gradient right along perimeter */}
            <linearGradient id="photonCircuitGradRightShared" x1="50%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="35%" stopColor="#7bd0ff" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>

            {/* Inner specular rim gradient */}
            <linearGradient id="shieldInnerRimGradShared" x1="50%" x2="50%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
              <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
            </linearGradient>

            {/* Glow Filter for energy pulse */}
            <filter height="200%" id="beamGlowShared" width="200%" x="-50%" y="-50%">
              <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Left & Right Shield Outer Glow Strokes */}
          <path
            d="M 290 0 C 210 40 110 52 10 55 C 5 220 35 420 290 610"
            fill="none"
            opacity="0.65"
            stroke="url(#shieldRimGradSharedLeft)"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
          <path
            d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610"
            fill="none"
            opacity="0.65"
            stroke="url(#shieldRimGradSharedRight)"
            strokeLinecap="round"
            strokeWidth="1.8"
          />

          {/* Main High-Definition Inner Bevel Contours */}
          <path
            d="M 290 8 C 213 46 117 58 20 61"
            fill="none"
            opacity="0.75"
            stroke="url(#shieldInnerRimGradShared)"
            strokeWidth="1"
          />
          <path
            d="M 290 8 C 367 46 463 58 560 61"
            fill="none"
            opacity="0.75"
            stroke="url(#shieldInnerRimGradShared)"
            strokeWidth="1"
          />
          <path
            d="M 560 61 C 565 218 536 410 290 596 C 44 410 15 218 20 61"
            fill="none"
            opacity="0.4"
            stroke="url(#shieldInnerRimGradShared)"
            strokeWidth="1"
          />

          {/* Dual Synchronous Energy Pulses */}
          <path
            className="perimeter-pulse-beam-left"
            d="M 290 0 C 210 40 110 52 10 55 C 5 220 35 420 290 610"
            fill="none"
            filter="url(#beamGlowShared)"
            stroke="url(#photonCircuitGradLeftShared)"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
          <path
            className="perimeter-pulse-beam-right"
            d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610"
            fill="none"
            filter="url(#beamGlowShared)"
            stroke="url(#photonCircuitGradRightShared)"
            strokeLinecap="round"
            strokeWidth="3.2"
          />
        </svg>

        {/* Radiant Specular Apex Flare Star */}
        <div className="apex-flare" />

        {/* Shoulder Corner Flares */}
        <div className="corner-flare-left" />
        <div className="corner-flare-right" />

        {/* Bottom Convergence Flare */}
        <div className="bottom-apex-flare" />

        {/* Downward light beam projection towards central scroll axis */}
        <div className="convergence-projector-stream" />

        {/* Frosted Glass Shield Vector Fill */}
        <div className="stitch-shield-glass" />
      </div>
    </div>
  );
}

export default FixOpsBackground;
