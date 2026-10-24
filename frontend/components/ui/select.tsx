import React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, id, options, ...props }, ref) => {
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
        <select
          id={inputId}
          ref={ref}
          className={cn(
            "flex h-9 w-full rounded-lg border border-[#E2E3E0] dark:border-[#222630] bg-white dark:bg-[#111318] px-3 py-1.5 text-xs text-[#17191F] dark:text-[#F9FAFB] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#F5C518] focus-visible:border-[#F5C518]/60 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shadow-xs",
            error && "border-[#F43F5E] focus-visible:ring-[#F43F5E]",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#111318] text-[#F9FAFB]">
              {opt.label}
            </option>
          ))}
        </select>
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

Select.displayName = "Select";
