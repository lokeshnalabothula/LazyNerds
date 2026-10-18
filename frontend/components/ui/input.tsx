import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-zinc-700 dark:text-zinc-300"
          >
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <input
          id={inputId}
          type={type}
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-md border border-[#E2E3E0] dark:border-[#262A32] bg-white dark:bg-[#111318] px-3 py-1.5 text-sm text-[#17191F] dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-[#666B73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F5C518] disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            error && "border-rose-500 focus-visible:ring-rose-500",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{hint}</p>
        )}
        {error && (
          <p className="text-[11px] font-medium text-rose-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
