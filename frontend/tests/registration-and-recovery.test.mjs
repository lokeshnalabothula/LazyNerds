import { test } from "node:test";
import assert from "node:assert";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const registerSchema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters").max(255),
  email: z.string().trim().email("Please provide a valid corporate email address").toLowerCase(),
  password: passwordSchema,
  phone: z.string().max(50).optional().nullable(),
  job_title: z.string().max(100).optional().nullable(),
  company_name: z.string().trim().min(2, "Company name must be at least 2 characters").max(255),
  website: z.string().max(500).optional().nullable(),
  industry: z.string().max(100).optional().nullable(),
  company_size: z.string().max(50).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  primary_domains: z.string().max(2000).optional().nullable(),
  requested_services: z.string().max(2000).optional().nullable(),
  scope_description: z.string().max(4000).optional().nullable(),
});

test("registration schema accepts valid client onboarding data", () => {
  const result = registerSchema.safeParse({
    full_name: "  Sarah Connor  ",
    email: "  Sarah@SkynetDefense.com  ",
    password: "SecurePass123!@#",
    company_name: "  Skynet Defense Systems  ",
    website: "https://skynetdefense.com",
    industry: "Defense & Critical Infrastructure",
    company_size: "101-500 employees",
    country: "India",
    primary_domains: "defense.skynet.com, api.skynet.com",
    requested_services: "Automated FixOps & Vulnerability Management",
    scope_description: "Cloud endpoints, Kubernetes clusters, and API gateways.",
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.full_name, "Sarah Connor");
    assert.strictEqual(result.data.email, "sarah@skynetdefense.com");
    assert.strictEqual(result.data.company_name, "Skynet Defense Systems");
  }
});

test("registration schema rejects weak passwords", () => {
  // Too short
  assert.strictEqual(passwordSchema.safeParse("Aa1!").success, false);
  // Missing uppercase
  assert.strictEqual(passwordSchema.safeParse("password123!").success, false);
  // Missing lowercase
  assert.strictEqual(passwordSchema.safeParse("PASSWORD123!").success, false);
  // Missing number
  assert.strictEqual(passwordSchema.safeParse("Password!@#").success, false);
  // Missing special char
  assert.strictEqual(passwordSchema.safeParse("Password123").success, false);
});

test("reset password schema validates confirmation match", () => {
  const valid = resetPasswordSchema.safeParse({
    password: "MySecurePassword1!",
    confirmPassword: "MySecurePassword1!",
  });
  assert.strictEqual(valid.success, true);

  const mismatch = resetPasswordSchema.safeParse({
    password: "MySecurePassword1!",
    confirmPassword: "DifferentPassword2@",
  });
  assert.strictEqual(mismatch.success, false);
  if (!mismatch.success) {
    assert.strictEqual(mismatch.error.errors[0].message, "Passwords do not match");
  }
});

test("registration schema rejects empty company name or invalid email", () => {
  const emptyCompany = registerSchema.safeParse({
    full_name: "John Doe",
    email: "john@valid.com",
    password: "ValidPassword123!",
    company_name: "  ",
  });
  assert.strictEqual(emptyCompany.success, false);

  const invalidEmail = registerSchema.safeParse({
    full_name: "John Doe",
    email: "not-an-email",
    password: "ValidPassword123!",
    company_name: "Valid Corp",
  });
  assert.strictEqual(invalidEmail.success, false);
});
