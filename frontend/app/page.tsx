"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

const SAMPLE_DOMAINS = [
  "https://apple.com",
  "https://stripe.com",
  "https://github.com",
  "https://google.com",
  "https://openai.com",
  "https://netflix.com",
  "https://spotify.com",
];

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [inputValue, setInputValue] = useState("");
  const [placeholderValue, setPlaceholderValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [statusHint, setStatusHint] = useState("Free initial scan · Domain verification required");

  const userInteractedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const domainIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);

  // Typewriter effect loop rotating through recognizable targets
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setPlaceholderValue(SAMPLE_DOMAINS[0]);
      return;
    }

    function tick() {
      if (userInteractedRef.current) {
        return;
      }

      const currentTarget = SAMPLE_DOMAINS[domainIndexRef.current];

      if (isDeletingRef.current) {
        charIndexRef.current--;
        setPlaceholderValue(currentTarget.substring(0, charIndexRef.current));
      } else {
        charIndexRef.current++;
        setPlaceholderValue(currentTarget.substring(0, charIndexRef.current));
      }

      let delay = isDeletingRef.current ? 38 : 75 + Math.random() * 40;

      if (!isDeletingRef.current && charIndexRef.current === currentTarget.length) {
        delay = 2600;
        isDeletingRef.current = true;
      } else if (isDeletingRef.current && charIndexRef.current === 0) {
        isDeletingRef.current = false;
        domainIndexRef.current = (domainIndexRef.current + 1) % SAMPLE_DOMAINS.length;
        delay = 550;
      }

      timeoutRef.current = setTimeout(tick, delay);
    }

    timeoutRef.current = setTimeout(tick, 1000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleFocus = () => {
    setIsFocused(true);
    userInteractedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!inputValue.trim()) {
      userInteractedRef.current = false;
      charIndexRef.current = 0;
      isDeletingRef.current = false;
      timeoutRef.current = setTimeout(() => {
        const currentTarget = SAMPLE_DOMAINS[domainIndexRef.current];
        charIndexRef.current = 1;
        setPlaceholderValue(currentTarget.substring(0, 1));
      }, 800);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    userInteractedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setInputValue(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let query = inputValue.trim();
    if (!query) {
      query = placeholderValue || SAMPLE_DOMAINS[0];
      setInputValue(query);
    }

    userInteractedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setIsScanning(true);
    const domainClean = query.replace(/^https?:\/\//, "");
    setStatusHint(`Analyzing ${domainClean} endpoints...`);

    // Ensure scheme is present for router
    const finalUrl = /^https?:\/\//i.test(query) ? query : `https://${query}`;

    setTimeout(() => {
      setIsScanning(false);
      setStatusHint("Scan initiated · Verifying DNS & SSL records");
      router.push(`/audit?url=${encodeURIComponent(finalUrl)}`);
    }, 1200);
  };

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen flex flex-col justify-between relative antialiased overflow-x-hidden bg-[#030407] text-[#e2e8f0] font-sans selection:bg-[#7bd0ff]/20 selection:text-[#7bd0ff]"
    >
      {/* ------------------------------------------------------------------- */}
      {/* ATMOSPHERIC BACKGROUND LAYERS                                       */}
      {/* ------------------------------------------------------------------- */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
        data-purpose="background-layers"
      >
        {/* Deep grid lines / faint technical grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:120px_120px]" />

        {/* Central Vertical Ray */}
        <div className="vertical-axis-ray" />

        {/* Faint orbital coordinate concentric circles */}
        <div className="orbital-ring w-[920px] h-[920px] left-1/2 top-[34%] opacity-30" />
        <div className="orbital-ring w-[1280px] h-[1280px] left-1/2 top-[34%] opacity-20" />

        {/* Subtle side reticle crosshair markers */}
        <div className="absolute top-[38%] left-[78px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
          + 45° 12&apos; N
        </div>
        <div className="absolute top-[41%] right-[68px] text-[10px] tracking-widest text-white/10 font-mono hidden md:block">
          [X:00]
        </div>

        {/* Earth Limb & Atmospheric Arc */}
        <div className="earth-container">
          <div className="earth-surface-lights" />
          {/* Intense sub-surface dawn glow on center horizon with gentle cyber pulse */}
          <div className="horizon-glow-pulse absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[180px] bg-cyan-100/15 rounded-full blur-[48px]" />
          <div className="horizon-glow-pulse absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[70px] bg-white/40 rounded-full blur-[24px]" />
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* NAVIGATION HEADER                                                   */}
      {/* ------------------------------------------------------------------- */}
      <header
        className="relative z-30 w-full px-4 sm:px-12 py-5 sm:py-7 flex items-center justify-between"
        data-purpose="top-navigation"
      >
        {/* Brand Logo */}
        <Link
          href="/"
          aria-label="Lazy Nerds FixOps Home"
          className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus:ring-1 focus:ring-white/30 rounded px-1 shrink-0"
        >
          {/* Minimalist geometric shield logo with inner notch */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md bg-white flex items-center justify-center shadow-[0_0_12px_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:scale-105 shrink-0">
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[#040609]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L4 5V11.09C4 16.14 7.41 20.85 12 22C16.59 20.85 20 16.14 20 11.09V5L12 2ZM12 16.5C9.51 16.5 7.5 14.49 7.5 12C7.5 9.51 9.51 7.5 12 7.5V16.5Z" />
            </svg>
          </div>
          <span className="text-[15px] sm:text-[17px] font-semibold tracking-tight text-white flex items-center whitespace-nowrap">
            Lazy Nerds
            <span className="text-[#848c9c] font-normal ml-1.5 font-sans">FixOps</span>
          </span>
        </Link>

        {/* Sign In / Console Pill Button */}
        <nav aria-label="Primary Navigation" className="shrink-0">
          {user ? (
            <Link
              href="/overview"
              className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 whitespace-nowrap shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>Console</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 whitespace-nowrap shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-white/90 shadow-[0_0_6px_rgba(255,255,255,0.8)]" />
              <span>Sign in</span>
            </Link>
          )}
        </nav>
      </header>

      {/* ------------------------------------------------------------------- */}
      {/* HERO MAIN SECTION                                                   */}
      {/* ------------------------------------------------------------------- */}
      <main
        className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-2 pb-10 sm:pb-14"
        data-purpose="hero-content"
      >
        {/* Frosted Glass Shield Vector Wrapper */}
        <div className="relative flex items-center justify-center w-full max-w-[92vw] sm:max-w-[80vw] md:max-w-[780px] lg:max-w-[920px] xl:max-w-[1100px]">
          {/* Background Shield Silhouette */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none z-0">
            {/* Scaled & Enhanced Shield Assembly (Fluid ~60% Viewport Scale) */}
            <div
              className="shield-assembly relative flex items-center justify-center transition-transform duration-300 origin-center"
              style={{ transform: "scale(var(--shield-scale, 1))" }}
            >
              {/* Crisp SVG Outer & Inner Bevel Contours */}
              <svg
                className="absolute inset-0 w-[580px] h-[610px] pointer-events-none z-10 overflow-visible"
                fill="none"
                viewBox="0 0 580 610"
              >
                <defs>
                  {/* Chrome edge gradient for crest and flanks left */}
                  <linearGradient id="fullBorderGradLeft" x1="50%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.75" />
                    <stop offset="65%" stopColor="#64748b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.85" />
                  </linearGradient>

                  {/* Chrome edge gradient for crest and flanks right */}
                  <linearGradient id="fullBorderGradRight" x1="50%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                    <stop offset="25%" stopColor="#cbd5e1" stopOpacity="0.75" />
                    <stop offset="65%" stopColor="#64748b" stopOpacity="0.45" />
                    <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.85" />
                  </linearGradient>

                  {/* Traveling photon energy gradient left along entire perimeter */}
                  <linearGradient id="photonCircuitGradLeft" x1="50%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="35%" stopColor="#7bd0ff" stopOpacity="0.95" />
                    <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                  </linearGradient>

                  {/* Traveling photon energy gradient right along entire perimeter */}
                  <linearGradient id="photonCircuitGradRight" x1="50%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="35%" stopColor="#7bd0ff" stopOpacity="0.95" />
                    <stop offset="70%" stopColor="#38bdf8" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
                  </linearGradient>

                  {/* Inner specular rim gradient */}
                  <linearGradient id="shieldInnerRim" x1="50%" x2="50%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                    <stop offset="40%" stopColor="#ffffff" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.15" />
                  </linearGradient>

                  {/* Glow Filter for energy trail */}
                  <filter height="200%" id="beamGlow" width="200%" x="-50%" y="-50%">
                    <feGaussianBlur in="SourceGraphic" result="blur" stdDeviation="3" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>

                  {/* Standard SVG Clip Path for WebKit / Safari cross-browser stability */}
                  <clipPath id="shieldClip">
                    <path d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610 C 35 420 5 220 10 55 C 110 52 210 40 290 0 Z" />
                  </clipPath>
                </defs>

                {/* Static / Base Full Symmetrical Outer Perimeter Strokes */}
                <path
                  className="full-perimeter-left"
                  d="M 290 0 C 210 40 110 52 10 55 C 5 220 35 420 290 610"
                  fill="none"
                  opacity="0.65"
                  stroke="url(#fullBorderGradLeft)"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />
                <path
                  className="full-perimeter-right"
                  d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610"
                  fill="none"
                  opacity="0.65"
                  stroke="url(#fullBorderGradRight)"
                  strokeLinecap="round"
                  strokeWidth="1.8"
                />

                {/* Inner Bevel contours starting from apex symmetrically */}
                <path
                  className="crest-inner-stroke"
                  d="M 290 8 C 213 46 117 58 20 61"
                  fill="none"
                  opacity="0.75"
                  stroke="url(#shieldInnerRim)"
                  strokeWidth="1"
                />
                <path
                  className="crest-inner-stroke"
                  d="M 290 8 C 367 46 463 58 560 61"
                  fill="none"
                  opacity="0.75"
                  stroke="url(#shieldInnerRim)"
                  strokeWidth="1"
                />
                <path
                  d="M 560 61 C 565 218 536 410 290 596 C 44 410 15 218 20 61"
                  fill="none"
                  opacity="0.4"
                  stroke="url(#shieldInnerRim)"
                  strokeWidth="1"
                />

                {/* Dual Synchronous Extended Energy Beams: Slowly trace down contours from Apex (0%) to Tip (50%) */}
                <path
                  className="perimeter-pulse-beam-left"
                  d="M 290 0 C 210 40 110 52 10 55 C 5 220 35 420 290 610"
                  fill="none"
                  filter="url(#beamGlow)"
                  stroke="url(#photonCircuitGradLeft)"
                  strokeLinecap="round"
                  strokeWidth="3.2"
                />
                <path
                  className="perimeter-pulse-beam-right"
                  d="M 290 0 C 370 40 470 52 570 55 C 575 220 545 420 290 610"
                  fill="none"
                  filter="url(#beamGlow)"
                  stroke="url(#photonCircuitGradRight)"
                  strokeLinecap="round"
                  strokeWidth="3.2"
                />
              </svg>

              {/* Apex Flare crosshair with synchronized breathing shimmer (Top Apex) */}
              <div className="apex-flare" />

              {/* Outer Corner Flares (Left & Right Shoulders) */}
              <div className="corner-flare-left" />
              <div className="corner-flare-right" />

              {/* Bottom Convergence Flare where dual beams meet at lower tip (50% mark) */}
              <div className="bottom-apex-flare" />

              {/* Downward light beam projection connecting shield tip towards central scroll axis */}
              <div className="convergence-projector-stream" />

              {/* Frosted Glass Shield Vector */}
              <div className="shield-glass" />
            </div>
          </div>

          {/* Foreground Centered Content */}
          <div className="relative z-10 w-full flex flex-col items-center text-center pt-4 sm:pt-6 md:pt-10">
            {/* Eyebrow Tagline with delicate hairline rules */}
            <div
              className="flex items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-5 w-full max-w-[220px] sm:max-w-sm"
              data-purpose="category-eyebrow"
            >
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/30 to-white/50" />
              <span className="text-[9px] sm:text-[11px] lg:text-[12px] font-medium tracking-[0.2em] sm:tracking-[0.24em] text-white/70 uppercase">
                CYBERSECURITY AUDIT
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/30 to-white/50" />
            </div>

            {/* Main Headline */}
            <h1 className="text-[28px] xs:text-[32px] sm:text-5xl md:text-6xl lg:text-[76px] xl:text-[88px] 2xl:text-[96px] font-medium tracking-[-0.035em] leading-[1.06] text-white text-transparent bg-clip-text bg-gradient-to-b from-white via-[#f0f3f8] to-[#9fa9b7] mb-3 sm:mb-4 max-w-[290px] sm:max-w-[520px] md:max-w-[660px] lg:max-w-[820px] xl:max-w-[960px]">
              Know what’s<br />exposed.
            </h1>

            {/* Supporting Subheadline */}
            <p className="text-[13px] sm:text-base lg:text-[18px] xl:text-[20px] font-normal tracking-wide text-[#949dae] mb-5 sm:mb-7 lg:mb-9 xl:mb-10">
              Verify. Scan. Secure.
            </p>

            {/* Interactive Domain Scan Input Capsule */}
            <div className="w-full max-w-[260px] xs:max-w-[280px] sm:max-w-[460px] md:max-w-[540px] lg:max-w-[620px] xl:max-w-[700px] px-1 sm:px-2 mb-3 sm:mb-4" data-purpose="scan-form-container" suppressHydrationWarning>
              <form
                id="auditForm"
                onSubmit={handleSubmit}
                suppressHydrationWarning
                className={`capsule-pill rounded-full p-1.5 sm:p-2 pl-3 sm:pl-6 pr-1.5 sm:pr-2 flex items-center transition-all duration-300 min-h-[42px] sm:min-h-[50px] lg:min-h-[56px] xl:min-h-[62px] ${
                  isScanning ? "scanning-active" : ""
                } ${isFocused ? "ring-1 ring-white/25" : ""}`}
              >
                {/* Globe Icon */}
                <div aria-hidden="true" className="text-white/60 mr-2 sm:mr-3 shrink-0">
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M2 12h20" strokeLinecap="round" strokeLinejoin="round" />
                    <path
                      d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                {/* Input Wrapper (Clean Typewriter Display) */}
                <div className="relative w-full flex items-center overflow-hidden">
                  <input
                    id="domainInput"
                    name="target_domain"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={placeholderValue}
                    aria-label="Website domain to audit"
                    autoComplete="off"
                    spellCheck="false"
                    suppressHydrationWarning
                    className="w-full bg-transparent border-0 text-white placeholder-white/35 focus:ring-0 text-[13px] sm:text-[16px] lg:text-[17px] xl:text-[18px] font-normal tracking-normal py-1 sm:py-2.5 px-0 select-text outline-none"
                  />
                </div>

                {/* Submit Button (Chrome Liquid Pill) */}
                <button
                  id="scanSubmitBtn"
                  type="submit"
                  aria-label="Start cybersecurity audit scan"
                  className="chrome-button shrink-0 w-11 sm:w-16 md:w-[76px] lg:w-[84px] xl:w-[94px] h-8 sm:h-10 md:h-12 lg:h-[44px] xl:h-[48px] rounded-full flex items-center justify-center text-slate-900 group cursor-pointer"
                >
                  {isScanning ? (
                    <svg
                      id="spinnerIcon"
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-900 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <svg
                      id="arrowIcon"
                      className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 transform group-hover:translate-x-0.5 transition-transform stroke-[2.2]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </form>
            </div>

            {/* Verification Notice / Sub-label */}
            <div
              className="flex items-center justify-center gap-2 text-white/50 text-[11px] sm:text-[12px] lg:text-[13px] font-normal tracking-normal"
              data-purpose="terms-hint"
            >
              <svg
                className="w-3.5 h-3.5 text-white/60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span id="statusHintText">{statusHint}</span>
            </div>
          </div>
        </div>
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* INTERACTIVE SCROLL PROMPT                                           */}
      {/* ------------------------------------------------------------------- */}
      <div
        className="relative z-20 flex flex-col items-center pb-6 group cursor-pointer"
        data-purpose="scroll-prompt"
        onClick={() => {
          if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            try {
              window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
            } catch {
              window.scrollTo(0, window.innerHeight);
            }
          }
        }}
      >
        <div className="flex flex-col items-center justify-center overflow-visible">
          <div className="h-5 flex items-center justify-center overflow-visible">
            <svg
              className="w-5 h-5 text-white/80 animate-falling-arrow overflow-visible filter drop-shadow-[0_0_8px_rgba(125,208,255,0.6)]"
              fill="none"
              viewBox="0 0 24 24"
            >
              <defs>
                <linearGradient id="scrollChevronGrad" x1="0%" x2="100%" y1="0%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#cbd5e1" stopOpacity="0.75" />
                  <stop offset="100%" stopColor="#7bd0ff" stopOpacity="0.95" />
                </linearGradient>
              </defs>
              <path
                d="M7 9.5L12 14.5L17 9.5"
                stroke="url(#scrollChevronGrad)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.4"
              />
              <circle cx="12" cy="14.5" fill="#ffffff" opacity="0.85" r="0.6" />
            </svg>
          </div>
          <span className="inline-flex items-center text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.24em] text-white/80 px-3 py-1 mt-1 rounded-full border border-white/20 bg-white/[0.04] backdrop-blur-md shadow-[0_0_12px_rgba(255,255,255,0.04)] select-none transition-all duration-300 group-hover:text-white group-hover:border-white/40 group-hover:bg-white/[0.08]">
            Scroll to explore
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* SITE FOOTER                                                         */}
      {/* ------------------------------------------------------------------- */}
      <footer
        className="relative z-20 border-t border-white/[0.08] px-4 sm:px-12 py-4 sm:py-5 flex items-center justify-between text-[11px] sm:text-[13px] text-white/45 font-normal"
        data-purpose="site-footer"
      >
        <div>Lazy Nerds © 2026</div>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="hover:text-white/80 transition-colors">
            Privacy
          </Link>
          <span className="text-white/20 select-none">|</span>
          <Link href="/terms" className="hover:text-white/80 transition-colors">
            Terms
          </Link>
        </div>
      </footer>
    </div>
  );
}
