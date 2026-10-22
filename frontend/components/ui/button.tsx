import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "destructive" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:pointer-events-none disabled:opacity-50 select-none text-sm";

    const variantStyles = {
      primary:
        "gloss-yellow-btn text-[#111318] border border-[#F5C518]/60 font-bold",
      secondary:
        "bg-zinc-100 dark:bg-[#1B1E24] text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-[#262A32] border border-zinc-200 dark:border-zinc-800 shadow-xs",
      outline:
        "border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111318] text-zinc-900 dark:text-zinc-100 hover:border-[#F5C518]/50 hover:bg-zinc-50 dark:hover:bg-[#1B1E24] shadow-xs",
      ghost:
        "bg-transparent text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100",
      destructive:
        "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm border border-rose-500/40 font-semibold",
      danger:
        "bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 shadow-sm border border-rose-500/40 font-semibold",
    };

    const sizeStyles = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-10 px-5 text-sm gap-2",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
