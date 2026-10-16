import { test } from "node:test";
import assert from "node:assert";
import { z } from "zod";

const engagementFormSchema = z
  .object({
    client_id: z.string().trim().min(1, "Client selection is required."),
    name: z.string().trim().min(1, "Engagement title is required.").max(255),
    assessment_type: z.string().trim().min(1, "Assessment type is required."),
    status: z.string().min(1, "Status is required."),
    start_date: z.string().optional().nullable(),
    due_date: z.string().optional().nullable(),
    description: z.string().max(10000).optional().nullable(),
    scope_summary: z.string().max(10000).optional().nullable(),
    authorization_status: z.string().min(1, "Authorization status is required."),
    assigned_to: z.string().max(255).optional().nullable(),
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

test("engagement validation accepts valid input", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "c1111111-2222-3333-4444-555555555555",
    name: "  External Penetration Test Q4  ",
    assessment_type: "External Network Pen Test",
    status: "draft",
    start_date: "2026-11-01",
    due_date: "2026-11-15",
    description: "External network black-box test.",
    scope_summary: "192.0.2.0/24, example.com",
    authorization_status: "not_confirmed",
    assigned_to: "tester@lazynerds.com",
  });

  assert.strictEqual(result.success, true);
  if (result.success) {
    assert.strictEqual(result.data.name, "External Penetration Test Q4");
    assert.strictEqual(result.data.status, "draft");
    assert.strictEqual(result.data.authorization_status, "not_confirmed");
    assert.strictEqual(result.data.client_id, "c1111111-2222-3333-4444-555555555555");
  }
});

test("engagement validation rejects empty or whitespace name", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "c1111111-2222-3333-4444-555555555555",
    name: "    ",
    assessment_type: "Web App Pen Test",
    status: "draft",
    authorization_status: "not_confirmed",
  });
  assert.strictEqual(result.success, false);
});

test("engagement validation rejects missing client_id", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "   ",
    name: "Valid Engagement Name",
    assessment_type: "Web App Pen Test",
    status: "draft",
    authorization_status: "not_confirmed",
  });
  assert.strictEqual(result.success, false);
});

test("engagement validation rejects due date before start date", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "c1111111-2222-3333-4444-555555555555",
    name: "Invalid Schedule Test",
    assessment_type: "API Security Assessment",
    status: "draft",
    authorization_status: "not_confirmed",
    start_date: "2026-11-20",
    due_date: "2026-11-10",
  });
  assert.strictEqual(result.success, false);
  if (!result.success) {
    const issue = result.error.issues.find((i) => i.path.includes("due_date"));
    assert.ok(issue);
    assert.strictEqual(issue.message, "Due date cannot precede start date.");
  }
});

test("engagement validation accepts equal start and due date (single-day audit)", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "c1111111-2222-3333-4444-555555555555",
    name: "One Day Firewall Review",
    assessment_type: "Configuration Review",
    status: "draft",
    authorization_status: "not_confirmed",
    start_date: "2026-11-15",
    due_date: "2026-11-15",
  });
  assert.strictEqual(result.success, true);
});

test("engagement validation requires status and authorization_status", () => {
  const result = engagementFormSchema.safeParse({
    client_id: "c1111111-2222-3333-4444-555555555555",
    name: "Defaults Check Engagement",
    assessment_type: "Vulnerability Assessment",
    status: "",
    authorization_status: "",
  });
  assert.strictEqual(result.success, false);
});

test("completed engagements are terminal and cannot transition to cancelled or draft", () => {
  const isTerminalCompleted = (currentStatus, targetStatus) => {
    if (currentStatus === "completed" && targetStatus !== "completed") {
      return false;
    }
    return true;
  };

  assert.strictEqual(isTerminalCompleted("completed", "cancelled"), false);
  assert.strictEqual(isTerminalCompleted("completed", "draft"), false);
  assert.strictEqual(isTerminalCompleted("completed", "in_progress"), false);
  assert.strictEqual(isTerminalCompleted("completed", "completed"), true);
  assert.strictEqual(isTerminalCompleted("in_progress", "cancelled"), true);
  assert.strictEqual(isTerminalCompleted("draft", "cancelled"), true);
});
