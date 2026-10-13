# LAZY NERDS FIXOPS — APPLICATION SECURITY ARCHITECTURE

## 1. Threat Model & Security Posture

As an operational application supporting a cybersecurity consultancy, **FixOps Client Manager** treats confidentiality, data integrity, and strict authorization as core architectural requirements.

---

## 2. Input Handling & Data Validation

1. **Dual-Layer Validation:**
   - Client-side validation using **Zod** provides immediate user feedback.
   - Server-side validation using **Pydantic v2** guarantees strict schema compliance before any data reaches the database layer.
2. **Whitespace and Boundary Enforcement:**
   - Leading and trailing whitespace is stripped from all company names, contact names, and emails.
   - Whitespace-only submissions are strictly rejected with HTTP 422.
3. **URL Scheme Restrictions:**
   - Company website entries are strictly verified against an explicit regex requiring `http://` or `https://`.
   - Dangerous schemes such as `javascript:`, `data:`, or `file:` are categorically rejected.
4. **Text-Only Rendering (Anti-XSS):**
   - User notes and organization fields are rendered exclusively as text nodes in React. HTML execution or raw innerHTML insertion is completely prohibited.

---

## 3. Database & Query Safety

1. **Parameterized Execution:**
   - 100% of database operations use SQLAlchemy 2.0 ORM query builders and expression constructs.
   - No raw SQL string interpolation is performed anywhere in the codebase.
2. **Sorting Allowlist:**
   - The `/api/v1/clients` list endpoint enforces an explicit column allowlist (`company_name`, `created_at`, `updated_at`, `primary_contact_name`). Arbitrary column names or SQL fragments passed in the `sort_by` parameter are rejected with HTTP 400.
3. **Least-Privilege Database User:**
   - In production, PostgreSQL must run with a dedicated non-superuser role restricted strictly to the `fixops_db` schema.

---

## 4. Authentication & Session Security

1. **Password Hashing:**
   - Passwords are encrypted with `bcrypt` using cryptographically generated salts.
   - Passwords are never logged or stored in plaintext.
2. **JSON Web Tokens (JWT):**
   - Signed with `HS256` using a 256-bit secret key.
   - Tokens have a defined expiration time (`ACCESS_TOKEN_EXPIRE_MINUTES`).
   - Tokens are delivered via `HttpOnly`, `SameSite=Lax`, `Secure` cookies to defend against client-side script theft.
3. **Safe Error Handling:**
   - Unhandled exceptions trigger a global sanitized exception handler that returns HTTP 500 without leaking stack traces, database credentials, or internal environment variables.

---

## 5. Cybersecurity Legal & Scope Boundary

- **No Active Assessment by Association:**
  Registering an organization or adding a company domain to FixOps does **not** grant authorization or permission to conduct penetration tests, port scans, or intrusive vulnerability assessments.
- Active testing requires signed Statements of Work, Rules of Engagement (ROE), and verifiable ownership verification.
