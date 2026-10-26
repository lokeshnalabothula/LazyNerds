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
      "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080B] disabled:pointer-events-none disabled:opacity-50 select-none text-sm cursor-pointer";

    const variantStyles = {
      primary:
        "rounded-xl bg-white text-black hover:bg-white/90 shadow-md font-semibold tracking-tight active:scale-[0.98] transition-all",
      secondary:
        "rounded-xl border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:border-white/25 shadow-xs font-medium transition-all",
      outline:
        "rounded-xl border border-white/15 bg-white/[0.03] text-neutral-300 hover:text-white hover:bg-white/[0.08] hover:border-white/25 shadow-xs font-medium transition-all",
      ghost:
        "rounded-xl bg-transparent text-neutral-400 hover:text-white hover:bg-white/[0.06] font-medium transition-all",
      destructive:
        "rounded-xl bg-[#F43F5E]/15 text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white border border-[#F43F5E]/40 active:bg-[#BE123C] shadow-xs font-semibold transition-all",
      danger:
        "rounded-xl bg-[#F43F5E]/15 text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white border border-[#F43F5E]/40 active:bg-[#BE123C] shadow-xs font-semibold transition-all",
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
