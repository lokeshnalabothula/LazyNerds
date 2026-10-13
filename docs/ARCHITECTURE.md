# LAZY NERDS FIXOPS CLIENT MANAGER — ARCHITECTURE SPECIFICATION

## 1. System Overview

**Lazy Nerds FixOps Client Manager** is the foundational client management and scoping workspace for Lazy Nerds, a cybersecurity firm. The system establishes a structured, secure, and extensible client directory to support future cybersecurity modules including security engagements, authorized target asset scoping, vulnerability findings, remediation tracking, and cryptographically signed deliverable reports.

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Frontend (App Router)            │
│  - /login                  - /clients                       │
│  - /clients/new            - /clients/[clientId]            │
│  - /clients/[clientId]/edit- /settings, /privacy, /terms    │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / JSON API (/api/v1)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Service                  │
│  - JWT / Cookie Auth         - Pydantic v2 Validation       │
│  - Strict CORS Controls      - Sanitized Error Handling     │
│  - Versioned API (/api/v1)   - Structured Logging           │
└──────────────────────────────┬──────────────────────────────┘
                               │ SQLAlchemy 2.x / Psycopg 3
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16 Database                   │
│  - clients (UUID, company, contact, status, timestamps)     │
│  - users   (UUID, email, bcrypt hash, role, is_active)      │
│  - Alembic Version Tracking                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack & Rationale

| Layer | Technology | Rationale |
|---|---|---|
| **Frontend Framework** | Next.js 15 (App Router), React 19 | Server-side rendering, strict routing, SEO and static export where useful. |
| **Language** | TypeScript (Strict Mode) | Strong type-safety, zero build warnings, matching backend DTO definitions. |
| **Styling** | Tailwind CSS (Zinc/Slate tokens + FixOps Emerald) | Minimalist, developer-built cybersecurity identity; strictly no purple gradients or decorative noise. |
| **Icons** | Lucide React | Uniform technical iconography; no emojis used as UI icons. |
| **Validation (Client)** | Zod & React Hook Form | Strict client-side form validation before transmission. |
| **Backend Framework** | FastAPI (Python 3.12) | Asynchronous execution, high throughput, automatic OpenAPI contract generation. |
| **Data Validation (Server)** | Pydantic v2 | Robust schema deserialization, type coercion, and injection boundary validation. |
| **ORM & Database Driver** | SQLAlchemy 2.0 & Psycopg 3 | Modern declarative ORM, connection pooling, prepared statements. |
| **Database Migrations** | Alembic | Tracked, reproducible schema revisions. |
| **Database Engine** | PostgreSQL 16 | Relational consistency, indexing, JSONB readiness, transaction isolation. |

---

## 3. Data Models & Entity Relationships

### 3.1 Initial Implemented Entities

#### `clients`
The core entity representing a client company or organization.
- `id` (`VARCHAR(36)` / UUID): Primary key generated via `uuid.uuid4()`.
- `company_name` (`VARCHAR(255)`, indexed): Unique organization name, trimmed, required.
- `primary_contact_name` (`VARCHAR(255)`): Designated contact person, trimmed, required.
- `primary_contact_email` (`VARCHAR(255)`, indexed): Normalized lowercase email address, required.
- `website` (`VARCHAR(500)`): HTTP or HTTPS URL only; dangerous schemes (`javascript:`, `data:`) strictly rejected.
- `phone` (`VARCHAR(50)`): Optional phone number.
- `industry` (`VARCHAR(100)`): Optional industry categorization.
- `notes` (`TEXT`): Confidential internal scoping notes; rendered as text, never HTML.
- `status` (`VARCHAR(20)`, indexed): Controlled status value (`active` or `archived`).
- `created_at` (`TIMESTAMPTZ`): UTC creation timestamp.
- `updated_at` (`TIMESTAMPTZ`): UTC modification timestamp.

#### `users`
Authorized Lazy Nerds personnel for administrative access.
- `id` (`VARCHAR(36)`): Primary key UUID.
- `email` (`VARCHAR(255)`, unique, indexed): Normalized email.
- `hashed_password` (`VARCHAR(255)`): Bcrypt salt and hash.
- `full_name` (`VARCHAR(255)`): Staff full name.
- `role` (`VARCHAR(50)`): Role descriptor (`founder`, `consultant`, `admin`).
- `is_active` (`BOOLEAN`): Account active state.
- `created_at` / `updated_at` (`TIMESTAMPTZ`): Audit timestamps.

### 3.2 Planned Future Entities
The architecture is structured so that the following entities can be connected via foreign keys to `clients.id`:
- `client_contacts`: Multiple contacts per client organization with individual authorization roles.
- `engagements`: Authorized security assessments (e.g. pentests, red team ops) referencing `client_id`.
- `assets`: Target infrastructure (domains, IPs, mobile apps, APIs) linked to client and engagement scope.
- `findings`: Validated security vulnerabilities referencing engagement and asset IDs.
- `remediation_records`: Verification workflow for remediated vulnerabilities.
- `evidence_records`: Cryptographic evidence artifacts attached to findings.

---

## 4. Authentication and Access Control

1. **Authentication Mechanism:**
   - Password verification using `bcrypt`.
   - Signed JSON Web Tokens (`HS256` in development, configurable algorithm in production).
   - Dual delivery:
     - `Authorization: Bearer <token>` header for programmatic API calls.
     - `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`fixops_access_token`) for browser clients.
2. **Authorization Enforcement:**
   - Enforced server-side on every protected endpoint via the FastAPI dependency `get_current_user`.
   - Unauthenticated requests receive HTTP 401 Unauthorized.
   - Inactive accounts receive HTTP 403 Forbidden.
3. **Session Termination:**
   - Calling `POST /api/v1/auth/logout` clears the browser cookie and invalidates local storage tokens.

---

## 5. Security & Boundary Architecture

- **Defense-in-Depth Validation:** All user inputs are validated independently by Zod on the frontend and Pydantic on the backend.
- **SQL Injection Prevention:** 100% of queries use SQLAlchemy parameterization.
- **Cross-Site Scripting (XSS) Prevention:** User notes and fields are rendered solely as text nodes, never using `dangerouslySetInnerHTML`.
- **CORS Protection:** Configured with an explicit whitelist of origins; wildcard origins (`*`) are disallowed.
- **Sanitized Errors:** Global exception handlers capture unhandled server errors and return a generic 500 error code with a safe message, preventing leakage of database passwords, internal file paths, or SQL queries.
- **Cybersecurity Scope Isolation:** The system explicitly distinguishes between registering a client and authorizing active penetration testing. Adding an asset or domain creates zero authorization for testing.
