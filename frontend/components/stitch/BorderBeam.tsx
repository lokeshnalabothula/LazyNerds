"use client";

import React from "react";
import { cn } from "@/lib/utils";

export type BorderBeamPreset = "colorful" | "ocean" | "mono" | "sunset";

interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  preset?: BorderBeamPreset;
  children: React.ReactNode;
  className?: string;
  intensity?: "subtle" | "normal" | "vibrant";
}

export const BorderBeam: React.FC<BorderBeamProps> = ({
  preset = "colorful",
  children,
  className,
  intensity = "normal",
  ...props
}) => {
  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/[0.08] bg-[#0d0e13]/80 backdrop-blur-2xl transition-all duration-300",
        // Preset-specific glow border animations
        preset === "colorful" && "border-beam-colorful",
        preset === "ocean" && "border-beam-ocean",
        preset === "mono" && "border-beam-mono",
        preset === "sunset" && "border-beam-sunset",
        // Glow shadow
        intensity === "vibrant" && "shadow-[0_0_30px_rgba(0,240,255,0.18)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
