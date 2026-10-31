"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { FixOpsBackground } from "@/components/ui/fixops-background";

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
      if (placeholderValue) {
        query = placeholderValue;
        setInputValue(query);
      } else {
        setStatusHint("Please enter a domain to verify (e.g. acroba-cloud.com)");
        return;
      }
    }

    userInteractedRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Normalize domain candidate: strip protocol, path, port, query
    let domainCandidate = query.trim().replace(/^https?:\/\//i, "");
    domainCandidate = domainCandidate.split("/")[0].split("?")[0].split("#")[0].split(":")[0].trim();

    // Validate domain format (must not be empty and must be valid host)
    const domainRegex = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$|^127\.0\.0\.1$/i;
    if (!domainCandidate || !domainRegex.test(domainCandidate)) {
      setStatusHint("Invalid domain format. Enter a valid domain name (e.g. acroba-cloud.com)");
      return;
    }

    setIsScanning(true);
    setStatusHint(`Validating ${domainCandidate} · Preparing domain challenge...`);

    setTimeout(() => {
      setIsScanning(false);
      router.push(`/domain-verification?domain=${encodeURIComponent(domainCandidate)}`);
    }, 600);
  };

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen flex flex-col justify-between relative antialiased overflow-x-hidden bg-transparent text-[#e2e8f0] font-sans selection:bg-[#7bd0ff]/20 selection:text-[#7bd0ff]"
    >
      {/* ------------------------------------------------------------------- */}
      {/* ATMOSPHERIC BACKGROUND LAYERS                                       */}
      {/* ------------------------------------------------------------------- */}
      {/* Persistent atmospheric background provided by RootLayout PersistentBackground */}

      {/* ------------------------------------------------------------------- */}
      {/* NAVIGATION HEADER                                                   */}
      {/* ------------------------------------------------------------------- */}
      <header
        className="relative z-30 w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-5 sm:py-6 flex items-center justify-between"
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
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 whitespace-nowrap shrink-0"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
              <span>Console</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full border border-white/20 bg-white/[0.03] backdrop-blur-md text-[12px] sm:text-[13px] font-medium text-white/90 hover:text-white hover:border-white/40 hover:bg-white/[0.08] transition-all duration-200 whitespace-nowrap shrink-0"
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
        className="relative z-20 flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10 my-auto w-full"
        data-purpose="hero-content"
      >
        <div className="relative w-full max-w-[min(680px,calc(100vw-2rem))] mx-auto flex flex-col items-center text-center px-2 sm:px-4">
          {/* Eyebrow Tagline with delicate hairline rules */}
            <div
              className="hero-stagger-1 flex items-center justify-center gap-2 sm:gap-4 mb-2.5 sm:mb-4 lg:mb-5 w-full max-w-[200px] xs:max-w-[240px] sm:max-w-sm"
              data-purpose="category-eyebrow"
            >
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-white/30 to-white/50" />
              <span className="text-[9px] xs:text-[10px] sm:text-[11px] lg:text-[13px] font-medium tracking-[0.18em] sm:tracking-[0.24em] text-white/70 uppercase whitespace-nowrap">
                CYBERSECURITY AUDIT
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-white/30 to-white/50" />
            </div>

            {/* Main Headline */}
            <h1 className="hero-stagger-2 text-[clamp(1.75rem,5vw+0.5rem,5.5rem)] font-medium tracking-[-0.035em] leading-[1.08] text-white text-transparent bg-clip-text bg-gradient-to-b from-white via-[#f0f3f8] to-[#9fa9b7] mb-2 sm:mb-3 lg:mb-4 max-w-[90%] mx-auto">
              Know what’s<br />exposed.
            </h1>

            {/* Supporting Subheadline */}
            <p className="hero-stagger-3 text-[clamp(0.8125rem,1.1vw+0.5rem,1.25rem)] font-normal tracking-wide text-[#949dae] mb-4 sm:mb-6 lg:mb-8 max-w-[85%] mx-auto">
              Verify. Scan. Secure.
            </p>

            {/* Interactive Domain Scan Input Capsule */}
            <div className="hero-stagger-4 w-full max-w-[min(680px,calc(100vw-2.5rem))] px-0.5 sm:px-2 mb-2.5 sm:mb-4 mx-auto" data-purpose="scan-form-container" suppressHydrationWarning>
              <form
                id="auditForm"
                action="/domain-verification"
                method="GET"
                onSubmit={handleSubmit}
                suppressHydrationWarning
                className={`capsule-pill rounded-full p-1 sm:p-2 pl-3 sm:pl-6 pr-1 sm:pr-2 flex items-center transition-all duration-300 min-h-[44px] sm:min-h-[52px] lg:min-h-[58px] ${
                  isScanning ? "scanning-active" : ""
                } ${isFocused ? "ring-1 ring-white/25" : ""}`}
              >
                {/* Globe Icon */}
                <div aria-hidden="true" className="text-white/60 mr-2 sm:mr-3 shrink-0 flex items-center justify-center">
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
                    name="domain"
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
                    className="w-full bg-transparent border-0 text-white placeholder-white/35 focus:ring-0 text-[12px] sm:text-[15px] lg:text-[17px] font-normal tracking-normal py-1 sm:py-2 px-0 select-text outline-none"
                  />
                </div>

                {/* Submit Button (Chrome Liquid Pill) */}
                <button
                  id="scanSubmitBtn"
                  type="submit"
                  aria-label="Start cybersecurity audit scan"
                  className="chrome-button shrink-0 min-w-[44px] min-h-[44px] px-3 sm:px-5 rounded-full flex items-center justify-center text-slate-900 group cursor-pointer"
                >
                  {isScanning ? (
                    <svg
                      id="spinnerIcon"
                      className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-slate-900 animate-spin pointer-events-none"
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
                      className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 transform group-hover:translate-x-0.5 transition-transform stroke-[2.2] pointer-events-none"
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
              className="flex items-center justify-center gap-1.5 sm:gap-2 text-white/50 text-[9px] xs:text-[10px] sm:text-[12px] lg:text-[13px] font-normal tracking-normal max-w-[85%]"
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
      </main>

      {/* ------------------------------------------------------------------- */}
      {/* SITE FOOTER                                                         */}
      {/* ------------------------------------------------------------------- */}
      <footer
        className="relative z-20 w-full max-w-7xl mx-auto border-t border-white/[0.08] px-4 sm:px-8 lg:px-12 py-4 sm:py-5 flex items-center justify-between text-[11px] sm:text-[13px] text-white/45 font-normal"
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
