"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type OrbState =
  | "searching"
  | "solving"
  | "working"
  | "listening"
  | "connecting"
  | "breathing";

export type OrbSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ThinkingOrbProps {
  state?: OrbState;
  size?: OrbSize;
  label?: string;
  sublabel?: string;
  className?: string;
  showBadge?: boolean;
}

const sizeClasses: Record<OrbSize, { container: string; outer: string; core: string; inner: string; aperture: string }> = {
  xs: {
    container: "w-4 h-4",
    outer: "blur-[4px]",
    core: "w-3 h-3",
    inner: "w-1.5 h-1.5",
    aperture: "w-1 h-1",
  },
  sm: {
    container: "w-6 h-6",
    outer: "blur-[8px]",
    core: "w-4.5 h-4.5",
    inner: "w-2.5 h-2.5",
    aperture: "w-1.5 h-1.5",
  },
  md: {
    container: "w-12 h-12",
    outer: "blur-[12px]",
    core: "w-9 h-9",
    inner: "w-5 h-5",
    aperture: "w-2.5 h-2.5",
  },
  lg: {
    container: "w-16 h-16",
    outer: "blur-[14px]",
    core: "w-12 h-12",
    inner: "w-7 h-7",
    aperture: "w-3 h-3",
  },
  xl: {
    container: "w-20 h-20",
    outer: "blur-[18px]",
    core: "w-16 h-16",
    inner: "w-9 h-9",
    aperture: "w-4 h-4",
  },
};

export const ThinkingOrb: React.FC<ThinkingOrbProps> = ({
  state = "searching",
  size = "md",
  label,
  sublabel,
  className,
  showBadge = false,
}) => {
  const currentSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <div className={cn("relative flex items-center justify-center", currentSize.container)}>
        {/* Layer 1: External Diffuse Blur Ambient Halo */}
        <div
          className={cn(
            "absolute inset-0 rounded-full opacity-70",
            currentSize.outer,
            state === "searching" && "bg-[radial-gradient(circle,#00f0ff_0%,#3131c0_70%,transparent_100%)]",
            state === "solving" && "bg-[radial-gradient(circle,#ec4899_0%,#6366f1_70%,transparent_100%)]",
            state === "working" && "bg-[radial-gradient(circle,#00f0ff_0%,#00dbe9_70%,transparent_100%)]",
            state === "listening" && "bg-[radial-gradient(circle,#10b981_0%,#00f0ff_70%,transparent_100%)]",
            state === "connecting" && "bg-[radial-gradient(circle,#c0c1ff_0%,#6366f1_70%,transparent_100%)]",
            state === "breathing" && "bg-[radial-gradient(circle,#ffd9e4_0%,#b4146e_70%,transparent_100%)]"
          )}
        />

        {/* Layer 2: Spherical Glass Boundary & Rotating Conic Energy Core */}
        <div
          className={cn(
            "relative rounded-full bg-[#0d0e13]/90 border border-[#00f0ff]/40 p-0.5 flex items-center justify-center backdrop-blur-xl shadow-[inset_0_0_12px_rgba(0,240,255,0.3)]",
            currentSize.container
          )}
        >
          <div
            className={cn(
              "rounded-full animate-spin",
              currentSize.core,
              state === "searching" && "bg-[conic-gradient(from_0deg,#00f0ff,#3131c0,#00f0ff)] [animation-duration:2.2s]",
              state === "solving" && "bg-[conic-gradient(from_0deg,#ec4899,#00f0ff,#6366f1,#ec4899)] [animation-duration:1.2s]",
              state === "working" && "bg-[conic-gradient(from_0deg,#00dbe9,transparent,#00f0ff)] [animation-duration:4s]",
              state === "listening" && "bg-[conic-gradient(from_0deg,#10b981,#00f0ff,#10b981)] [animation-duration:3s]",
              state === "connecting" && "bg-[conic-gradient(from_0deg,#c0c1ff,#3131c0,#c0c1ff)] [animation-duration:2.5s]",
              state === "breathing" && "bg-[conic-gradient(from_0deg,#ffb0cd,#6366f1,#00f0ff)] [animation-duration:5s]"
            )}
          />

          {/* Layer 3: Central Aperture & Nucleus */}
          <div
            className={cn(
              "absolute rounded-full bg-[#0d0e13] border border-[#00f0ff] flex items-center justify-center shadow-[0_0_8px_rgba(0,240,255,0.8)]",
              currentSize.aperture
            )}
          >
            <div className="w-1 h-1 rounded-full bg-[#00f0ff] animate-ping" />
          </div>
        </div>
      </div>

      {/* Optional Badge Under Orb */}
      {showBadge && (
        <div className="mt-2.5 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0d0e13]/90 border border-white/10 shadow-sm backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f0ff] animate-pulse" />
          <span className="font-mono text-[9px] uppercase tracking-wider text-[#dbfcff]">
            {label || "NEURAL COGNITIVE ENGINE"}
          </span>
        </div>
      )}

      {/* Optional Text Labels */}
      {!showBadge && (label || sublabel) && (
        <div className="text-center mt-2 space-y-0.5">
          {label && (
            <div className="font-mono text-[10px] uppercase tracking-widest text-[#00f0ff] font-semibold">
              {label}
            </div>
          )}
          {sublabel && (
            <div className="text-[11px] text-[#849495] font-mono">
              {sublabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
