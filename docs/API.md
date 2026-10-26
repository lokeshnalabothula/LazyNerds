# LAZY NERDS FIXOPS CLIENT MANAGER — API CONTRACT REFERENCE

Base URL: `/api/v1`

All responses are serialized as standard JSON (`application/json`) unless requesting file downloads.
All protected endpoints require either a valid `Authorization: Bearer <token>` header or an authenticated `fixops_access_token` HttpOnly session cookie.

---

## 1. System Health & Diagnostics (`Health`)

### `GET /health`
Returns system status, active commit hash, environment, worker dispatch mode, and PostgreSQL connection state.
- **Authentication:** Public
- **Response `200 OK`:**
```json
{
  "status": "ok",
  "service": "Lazy Nerds FixOps Client Manager",
  "version": "1.0.0",
  "commit": "5966e3214c54da6d63fe725b73d0d46230d25e57",
  "environment": "production",
  "worker_dispatch_mode": "auto",
  "database": "connected",
  "timestamp": "2026-10-26T08:00:00.000000Z"
}
```

---

## 2. Authentication & Credential Lifecycle (`Authentication`)

### `POST /auth/login`
Authenticates authorized personnel, returns a time-bounded JWT, and issues an HttpOnly cookie.
- **Authentication:** Public
- **Request Body:**
```json
{
  "email": "operator@lazynerds.com",
  "password": "SecurePassword123!"
}
```
- **Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
  "token_type": "bearer",
  "user": {
    "id": "f9533e1f-236b-4079-9677-33f624d87fd0",
    "email": "operator@lazynerds.com",
    "full_name": "Security Operator",
    "role": "founder",
    "is_active": true,
    "client_id": null,
    "created_at": "2026-10-26T00:00:00Z"
  }
}
```
- **Cookie Set:** `fixops_access_token=<jwt>; HttpOnly; SameSite=Lax; Path=/`

### `GET /auth/me`
Retrieves identity profile for the current authenticated session.
- **Authentication:** Required (`401` if unauthenticated)
- **Response `200 OK`:** Returns `User` object.

### `POST /auth/change-password`
Updates the authenticated user's password following strict policy verification (minimum 10 characters, mixed case, and number).
- **Authentication:** Required
- **Request Body:**
```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePassword456!"
}
```

### `POST /auth/forgot-password`
Dispatches a password reset recovery token via configured email provider (or mock in development).
- **Authentication:** Public
- **Request Body:** `{"email": "user@example.com"}`

### `POST /auth/reset-password`
Validates reset token and sets a new password.
- **Authentication:** Public
- **Request Body:** `{"token": "secure-uuid-token", "new_password": "NewSecurePassword456!"}`

### `POST /auth/logout`
Terminates session and clears HttpOnly session cookie.
- **Authentication:** Public
- **Response `200 OK`:** `{"message": "Successfully signed out."}`

---

## 3. Client Onboarding & Registration Queue (`Registrations`)

### `POST /registrations/register`
Self-service onboarding portal for prospective cybersecurity clients. Isolated in `pending` queue until founder approval.
- **Authentication:** Public
- **Request Body:**
```json
{
  "company_name": "Acme Defense Corp",
  "contact_name": "Jane Doe",
  "email": "jane@acmedefense.com",
  "password": "StrongPassword2026!",
  "website": "https://acmedefense.com",
  "industry": "Aerospace & Defense",
  "notes": "External assessment interest."
}
```

### `GET /registrations/status`
Allows client applicants to check the progress of their registration application.
- **Authentication:** Public
- **Query Parameters:** `email` (string)

### `GET /registrations`
Lists pending registrations for administrative review.
- **Authentication:** Founder role only (`403` for non-founders)

### `POST /registrations/{registration_id}/review`
Approves or rejects a pending client registration. On approval, automatically provisions the client organization and linked user account.
- **Authentication:** Founder role only
- **Request Body:** `{"decision": "approved", "rejection_reason": null}`

---

## 4. Client Directory & Tenancy (`Clients`)

### `GET /clients`
Retrieves paginated clients with debounced search, filtering, and strict sorting allowlist.
- **Authentication:** Required
- **Query Parameters:** `page`, `page_size`, `search`, `status` (`active`, `archived`, `all`), `sort_by`, `sort_order`.

### `POST /clients`
Creates a new client record transactionally.
- **Authentication:** Employee or Founder required

### `GET /clients/{client_id}`
Retrieves client details. Clients can only access their own organization record.
- **Authentication:** Required

### `PATCH /clients/{client_id}`
Partial update of client metadata.
- **Authentication:** Employee or Founder required

### `POST /clients/{client_id}/archive` & `POST /clients/{client_id}/restore`
Soft-archives or restores a client organization.

---

## 5. Security Engagements & Website Audit (`Engagements`)

### `GET /engagements`
Lists engagements with multi-criteria filtering (`status`, `assessment_type`, `client_id`, `authorization_status`).
- **Authentication:** Required

### `POST /engagements`
Provisions an engagement with mandatory Rules of Engagement (RoE) attestation.
- **Authentication:** Employee or Founder required

### `GET /engagements/{engagement_id}` & `PATCH /engagements/{engagement_id}`
Retrieves or updates engagement scope. Completed/cancelled engagements are terminal and immutable.

### `POST /engagements/audit`
Launches an automated website assessment on an authorized target URL with fail-closed SSRF protection.
- **Authentication:** Required
- **Request Body:**
```json
{
  "url": "https://example.com",
  "client_id": "e4b3c2a1-0000-0000-0000-000000000000",
  "engagement_id": null,
  "scan_mode": "blackbox",
  "confirmed_authorization": true,
  "notes": "Website audit probe"
}
```

---

## 6. Target Assets Management (`Assets`)

### `GET /assets`
Lists in-scope target assets (web applications, domains, IP scopes, APIs). Filterable by `engagement_id` and `client_id`.

### `POST /assets`
Registers a new asset within an engagement boundary.
- **Authentication:** Employee or Founder required

### `GET /assets/{asset_id}`, `PATCH /assets/{asset_id}`, `DELETE /assets/{asset_id}`
Asset lifecycle operations.

---

## 7. Findings Register & Assessments (`Findings`)

### `GET /findings`
Retrieves vulnerability registry with severity (`critical`, `high`, `medium`, `low`, `info`) and status (`open`, `confirmed`, `in_remediation`, `remediated`, `false_positive`) filtering.

### `POST /findings`
Manually logs a verified vulnerability finding with CVE, CVSS, and remediation guidance.

### `GET /findings/{finding_id}` & `PATCH /findings/{finding_id}`
Vulnerability dossier retrieval and remediation status mutation.

### `POST /findings/{finding_id}/verifications`
Appends a retest verification record verifying fix effectiveness.

### `POST /findings/launch-scan`
Queues an automated blackbox security assessment.
- **Request Body:** `{"asset_id": "uuid", "scan_type": "nuclei", "mode": "blackbox"}`

### `POST /findings/import-scan`
Imports raw tool output (Nuclei JSON / Shannon reports).

### `GET /findings/assessments/{assessment_id}`
Polls assessment execution status, progress percentage, and live telemetry log lines.

---

## 8. Decoupled Worker Subsystem (`Workers`)

### `GET /workers/jobs/pending`
Lists queued scanner assessments ready for distributed execution.
- **Authentication:** Worker token (`X-Worker-Token` or `Authorization: Bearer <token>`)

### `POST /workers/jobs/{job_id}/claim`
Atomically claims a pending job with a lease timeout (`WORKER_LEASE_SECONDS`).

### `POST /workers/jobs/{job_id}/progress`
Transmits real-time heartbeat, percentage progress, and log lines. Fences claimant identity.

### `POST /workers/jobs/{job_id}/complete`
Ingests discovered findings and marks assessment as `completed`.

### `POST /workers/jobs/{job_id}/fail`
Reports scanner failure with sanitized error descriptions.

---

## 9. Remediation Automations (`Automation`)

### `GET /automation/rules` & `POST /automation/rules`
Manages event-driven remediation workflows (webhook dispatch on critical finding discovery, SLA alerts).

### `GET /automation/executions`
Audit history of automated rule triggers, delivery status, and response latency.

---

## 10. Executive Reports (`Reports`)

### `GET /reports` & `POST /reports`
Generates comprehensive executive summary and technical vulnerability reports in JSON and Markdown formats.

### `GET /reports/{report_id}/download`
Serves downloadable report document (`text/markdown` or `text/html`).

---

## 11. Notifications Center (`Notifications`)

### `GET /notifications`
Retrieves operational notifications and unread count for current user.

### `POST /notifications/{id}/read` & `POST /notifications/read-all`
Dismisses or marks alerts as read.

---

## 12. Operational Audit Logs (`Audit Logs`)

### `GET /audit-logs`
Immutable append-only administrative ledger. Records operator actions, authentication events, client mutations, and scan launches.
- **Authentication:** Founder only

---

## 13. Operational Overview & Metrics (`Overview`)

### `GET /overview/metrics`
Aggregates high-level telemetry: active client count, active engagements, open vulnerabilities by severity, and recent audit activity.
- **Authentication:** Required (scoped to client tenancy for client role).
