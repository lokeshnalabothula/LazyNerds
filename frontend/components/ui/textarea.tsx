import React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-zinc-700 dark:text-[#D1D5DB]"
          >
            {label}
            {props.required && <span className="text-[#F43F5E] ml-0.5">*</span>}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          className={cn(
            "flex min-h-[80px] w-full rounded-lg border border-[#E2E3E0] dark:border-[#222630] bg-white dark:bg-[#111318] px-3 py-2 text-xs text-[#17191F] dark:text-[#F9FAFB] placeholder:text-zinc-400 dark:placeholder:text-[#6B7280] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F5C518] focus-visible:border-[#F5C518]/60 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs",
            error && "border-[#F43F5E] focus-visible:ring-[#F43F5E] focus-visible:border-[#F43F5E]",
            className
          )}
          {...props}
        />
        {hint && !error && (
          <p className="text-[11px] text-zinc-500 dark:text-[#9CA3AF]">{hint}</p>
        )}
        {error && (
          <p className="text-[11px] font-medium text-[#F43F5E]">{error}</p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
