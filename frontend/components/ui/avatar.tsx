"use client";

import React, { useState } from "react";
import Image from "next/image";
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
  xs: { box: "h-6 w-6 text-[10px]", pixels: 24 },
  sm: { box: "h-8 w-8 text-xs", pixels: 32 },
  md: { box: "h-10 w-10 text-xs", pixels: 40 },
  lg: { box: "h-12 w-12 text-sm", pixels: 48 },
  xl: { box: "h-16 w-16 text-base", pixels: 64 },
  "2xl": { box: "h-24 w-24 text-lg", pixels: 96 },
};

/**
 * Reusable, resilient FixOps operator avatar component.
 * Provides consistent styling, subtle glossy yellow borders, aspect-ratio preservation,
 * and graceful fallback to stylized initials when image paths fail or are unavailable.
 */
export const Avatar: React.FC<AvatarProps> = ({
  src = "/profile-sm.png",
  alt = "Operator Avatar",
  size = "md",
  fallbackText,
  className,
  ring = true,
  priority = false,
}) => {
  const [imageError, setImageError] = useState(false);
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
        "relative rounded-full overflow-hidden shrink-0 select-none flex items-center justify-center bg-[#1B1E24] text-zinc-100 font-mono font-semibold",
        sizeConfig.box,
        ring && "border border-[#F5C518]/40 shadow-xs ring-1 ring-[#F5C518]/20",
        className
      )}
      title={alt}
      aria-label={alt}
    >
      {!imageError && src ? (
        <Image
          src={src}
          alt={alt}
          width={sizeConfig.pixels}
          height={sizeConfig.pixels}
          priority={priority}
          onError={() => setImageError(true)}
          className="object-cover w-full h-full"
        />
      ) : initials ? (
        <span className="tracking-wider text-[#FFD84D]">{initials}</span>
      ) : (
        <UserIcon className="h-1/2 w-1/2 text-zinc-400" />
      )}
    </div>
  );
};
