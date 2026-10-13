import { test } from "node:test";
import assert from "node:assert";
import { z } from "zod";

const urlRegex = /^https?:\/\/(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,63}\.?|localhost|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(?::\d+)?(?:\/.*)?$/i;

const clientFormSchema = z.object({
  company_name: z
    .string()
    .trim()
    .min(1, "Company name is required.")
    .max(255),
  primary_contact_name: z
    .string()
    .trim()
    .min(1, "Primary contact name is required.")
    .max(255),
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
  phone: z.string().trim().max(50).optional().nullable(),
  industry: z.string().trim().max(100).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  created_at: z.string().optional().nullable(),
});

test("client validation accepts valid client input", () => {
  const result = clientFormSchema.safeParse({
    company_name: "  Acme Cybersecurity Inc  ",
    primary_contact_name: "  Jane Doe  ",
    primary_contact_email: "  Jane.Doe@Acme.COM  ",
    website: "https://acme.com",
    phone: "+1-555-0199",
    industry: "Fintech",
    notes: "Confidential scoping notes",
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.company_name, "Acme Cybersecurity Inc");
    assert.strictEqual(result.data.primary_contact_name, "Jane Doe");
    assert.strictEqual(result.data.primary_contact_email, "jane.doe@acme.com");
  }
});

test("client validation rejects empty company name", () => {
  const result = clientFormSchema.safeParse({
    company_name: "   ",
    primary_contact_name: "Jane Doe",
    primary_contact_email: "jane@acme.com",
  });
  assert.strictEqual(result.success, false);
});

test("client validation rejects invalid email", () => {
  const result = clientFormSchema.safeParse({
    company_name: "Acme Inc",
    primary_contact_name: "Jane Doe",
    primary_contact_email: "invalid-email-string",
  });
  assert.strictEqual(result.success, false);
});

test("client validation rejects malicious javascript: URL scheme", () => {
  const result = clientFormSchema.safeParse({
    company_name: "Acme Inc",
    primary_contact_name: "Jane Doe",
    primary_contact_email: "jane@acme.com",
    website: "javascript:alert(1)",
  });
  assert.strictEqual(result.success, false);
});

test("client validation accepts null or empty website", () => {
  const result = clientFormSchema.safeParse({
    company_name: "Acme Inc",
    primary_contact_name: "Jane Doe",
    primary_contact_email: "jane@acme.com",
    website: "",
  });
  assert.strictEqual(result.success, true);
});

test("client validation accepts custom onboarding created_at timestamp", () => {
  const result = clientFormSchema.safeParse({
    company_name: "Retrofit Security",
    primary_contact_name: "Bob Builder",
    primary_contact_email: "bob@retrofit.io",
    created_at: "2025-01-15T09:30:00.000Z",
  });
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.created_at, "2025-01-15T09:30:00.000Z");
  }
});
