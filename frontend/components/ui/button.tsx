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
      "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] focus-visible:ring-offset-2 focus-visible:ring-offset-[#090A0D] disabled:pointer-events-none disabled:opacity-50 select-none text-sm cursor-pointer";

    const variantStyles = {
      primary:
        "gloss-yellow-btn text-[#090A0D] font-extrabold active:scale-[0.98] shadow-md",
      secondary:
        "btn-glass-secondary border border-[#222630] bg-[#161920]/80 text-[#F9FAFB] hover:border-[#F5C518]/30 hover:bg-[#1B1E24] shadow-xs font-medium",
      outline:
        "border border-[#222630] bg-transparent text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-[#161920] hover:border-[#F5C518]/30 shadow-xs font-medium",
      ghost:
        "bg-transparent text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/[0.05] font-medium",
      destructive:
        "bg-[#F43F5E]/15 text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white border border-[#F43F5E]/40 active:bg-[#BE123C] shadow-xs font-semibold",
      danger:
        "bg-[#F43F5E]/15 text-[#F43F5E] hover:bg-[#F43F5E] hover:text-white border border-[#F43F5E]/40 active:bg-[#BE123C] shadow-xs font-semibold",
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
