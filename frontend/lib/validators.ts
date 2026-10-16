import { z } from "zod";

const urlRegex = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/.*)?$/i;

export const clientFormSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(255, "Company name must not exceed 255 characters."),
  primary_contact_name: z
    .string()
    .trim()
    .min(1, "Primary contact name is required.")
    .max(255, "Primary contact name must not exceed 255 characters."),
  primary_contact_email: z
    .string()
    .trim()
    .min(1, "Contact email is required.")
    .email("Enter a valid email address.")
    .transform((val) => val.toLowerCase()),
  website: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((val) => {
      if (!val || val.length === 0) return true;
      return urlRegex.test(val);
    }, "Enter a valid HTTP or HTTPS website URL."),
  phone: z
    .string()
    .trim()
    .max(50, "Phone number must not exceed 50 characters.")
    .optional()
    .nullable(),
  industry: z
    .string()
    .trim()
    .max(100, "Industry must not exceed 100 characters.")
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(5000, "Notes must not exceed 5,000 characters.")
    .optional()
    .nullable(),
  created_at: z
    .string()
    .optional()
    .nullable(),
});

export type ClientFormData = z.infer<typeof clientFormSchema>;

export const loginFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address."),
  password: z
    .string()
    .min(1, "Password is required."),
});

export type LoginFormData = z.infer<typeof loginFormSchema>;

export const engagementFormSchema = z
  .object({
    client_id: z
      .string()
      .trim()
      .min(1, "Client selection is required."),
    name: z
      .string()
      .trim()
      .min(1, "Engagement title is required.")
      .max(255, "Engagement title must not exceed 255 characters."),
    assessment_type: z
      .string()
      .trim()
      .min(1, "Assessment type is required."),
    status: z
      .string()
      .min(1, "Status is required."),
    start_date: z
      .string()
      .optional()
      .nullable(),
    due_date: z
      .string()
      .optional()
      .nullable(),
    description: z
      .string()
      .max(10000, "Description must not exceed 10,000 characters.")
      .optional()
      .nullable(),
    scope_summary: z
      .string()
      .max(10000, "Scope summary must not exceed 10,000 characters.")
      .optional()
      .nullable(),
    authorization_status: z
      .string()
      .min(1, "Authorization status is required."),
    assigned_to: z
      .string()
      .max(255, "Assigned assessor must not exceed 255 characters.")
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.due_date) {
        return data.due_date >= data.start_date;
      }
      return true;
    },
    {
      message: "Due date cannot precede start date.",
      path: ["due_date"],
    }
  );

export type EngagementFormData = z.infer<typeof engagementFormSchema>;
