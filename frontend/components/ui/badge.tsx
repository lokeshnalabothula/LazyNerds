import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "active"
    | "archived"
    | "neutral"
    | "warning"
    | "danger"
    | "primary"
    | "critical"
    | "high"
    | "medium"
    | "low"
    | "remediated";
  size?: "sm" | "md";
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  children,
  variant = "neutral",
  size = "md",
  ...props
}) => {
  const baseStyles =
    "inline-flex items-center font-medium rounded-full border transition-colors select-none font-mono text-[11px]";

  const sizeStyles = {
    sm: "px-2 py-0.5 text-[10px] gap-1",
    md: "px-2.5 py-0.5 text-xs gap-1.5",
  };

  const variantStyles = {
    active:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    remediated:
      "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    archived:
      "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
    neutral:
      "bg-white/[0.04] text-[#9CA3AF] border-white/[0.08]",
    warning:
      "bg-amber-500/10 text-amber-400 border-amber-500/25",
    medium:
      "bg-amber-500/10 text-amber-400 border-amber-500/25",
    danger:
      "bg-rose-500/10 text-rose-400 border-rose-500/25",
    critical:
      "bg-rose-500/10 text-rose-400 border-rose-500/25 font-bold",
    high:
      "bg-orange-500/10 text-orange-400 border-orange-500/25 font-semibold",
    low:
      "bg-blue-500/10 text-blue-400 border-blue-500/25",
    primary:
      "bg-[#F5C518]/15 text-[#FFD84D] border-[#F5C518]/30 font-semibold",
  };

  return (
    <span
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {(variant === "active" || variant === "remediated") && (
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34D399]" aria-hidden="true" />
      )}
      {(variant === "critical" || variant === "danger") && (
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shadow-[0_0_6px_#F43F5E]" aria-hidden="true" />
      )}
      {variant === "high" && (
        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" aria-hidden="true" />
      )}
      {variant === "archived" && (
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" aria-hidden="true" />
      )}
      {children}
    </span>
  );
};
