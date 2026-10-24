"use client";

import React from "react";
import { User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  fallbackText?: string;
  className?: string;
  ring?: boolean;
  priority?: boolean;
}

const SIZE_MAP = {
  xs: { box: "h-6 w-6 text-[10px]" },
  sm: { box: "h-8 w-8 text-xs" },
  md: { box: "h-10 w-10 text-xs" },
  lg: { box: "h-12 w-12 text-sm" },
  xl: { box: "h-16 w-16 text-base" },
  "2xl": { box: "h-24 w-24 text-lg" },
};

/**
 * Reusable, clean FixOps operator avatar component.
 * Displays clean text initials or a minimal user icon with Obsidian Cyber Precision styling.
 * Avoids decorative profile photos or mascots.
 */
export const Avatar: React.FC<AvatarProps> = ({
  alt = "Operator",
  size = "md",
  fallbackText,
  className,
  ring = true,
}) => {
  const sizeConfig = SIZE_MAP[size] || SIZE_MAP.md;

  // Extract up to 2 initials from fallbackText
  const getInitials = (text?: string): string => {
    if (!text) return "";
    const parts = text.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return "";
  };

  const initials = getInitials(fallbackText);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden shrink-0 select-none flex items-center justify-center bg-[#161920] text-zinc-100 font-mono font-bold border border-[#222630]",
        sizeConfig.box,
        ring && "shadow-xs border-[#F5C518]/30",
        className
      )}
      title={alt}
      aria-label={alt}
    >
      {initials ? (
        <span className="tracking-wider text-[#FFD84D]">{initials}</span>
      ) : (
        <UserIcon className="h-1/2 w-1/2 text-zinc-400" />
      )}
    </div>
  );
};
