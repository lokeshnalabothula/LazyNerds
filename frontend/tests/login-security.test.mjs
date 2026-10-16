import { test } from "node:test";
import assert from "node:assert";
import { z } from "zod";

const loginFormSchema = z.object({
  email: z.string().trim().min(1, "Email is required.").email("Invalid email format."),
  password: z.string().min(1, "Password is required."),
});

test("loginFormSchema accepts valid credentials", () => {
  const result = loginFormSchema.safeParse({
    email: "founder@lazynerds.com",
    password: "CorrectPassword123!",
  });
  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.email, "founder@lazynerds.com");
  }
});

test("loginFormSchema rejects invalid email format", () => {
  const result = loginFormSchema.safeParse({
    email: "not-an-email",
    password: "CorrectPassword123!",
  });
  assert.strictEqual(result.success, false);
});

test("loginFormSchema rejects empty password", () => {
  const result = loginFormSchema.safeParse({
    email: "founder@lazynerds.com",
    password: "",
  });
  assert.strictEqual(result.success, false);
});

test("URL sanitization strips sensitive credential parameters from search string", () => {
  const sanitizeUrlSearch = (searchString) => {
    const params = new URLSearchParams(searchString);
    params.delete("password");
    params.delete("email");
    return params.toString();
  };

  const leakedSearch = "?email=founder%40lazynerds.com&password=SuperSecretPassword123%21&redirect=%2Fclients";
  const cleanSearch = sanitizeUrlSearch(leakedSearch);

  assert.strictEqual(cleanSearch.includes("password"), false);
  assert.strictEqual(cleanSearch.includes("email"), false);
  assert.strictEqual(cleanSearch.includes("redirect=%2Fclients"), true);
});
