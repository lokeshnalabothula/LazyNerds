# Lazy Nerds FixOps Client Manager

**Lazy Nerds FixOps Client Manager** is an operational client management workspace for **Lazy Nerds**, a cybersecurity company. It provides the structured foundation for managing client organizations, authorized security points of contact, and scoping history, designed to anchor future cybersecurity platform modules (engagements, asset scopes, vulnerability findings, remediation tracking, and signed executive reports).

Built with a minimalist, developer-built technical aesthetic: clean dark-mode typography, high contrast, thin borders, Lucide iconography, and strictly no purple gradients, bloated templates, or fake metrics.

---

## 1. Features Implemented

### Core Client Workspace
- **Client Directory (`/clients`):** Paginated data table backed by PostgreSQL with real-time server-side pagination, debounced search (by company, contact name, or email), status filtering (`Active`, `Archived`, `All`), and sort allowlisting (`created_at`, `updated_at`, `company_name`).
- **Create Client Flow (`/clients/new` and in-app modal):** Dual-layer validation (Zod on client, Pydantic on backend), whitespace normalization, RFC email validation, and strict HTTP/HTTPS URL scheme filtering.
- **Unified Client Profile (`/clients/[clientId]`):** Centralized workspace displaying organization details, primary contact info, audit metadata, and internal notes.
- **Edit Client Flow (`/clients/[clientId]/edit`):** Prepopulated form with existing database records, partial update API support, automatic `updated_at` timestamps, and transactional persistence.
- **Archival & Restoration Lifecycle:** Safe archiving instead of permanent deletion. Preserves history and identifiers, excludes archived clients from default views, and supports one-click restoration.
- **Honest Module Placeholders:** Tabs for Engagements, Assets & Scope, Findings & Remediation, and Reports & Evidence display honest planned statuses and clear legal notices emphasizing that client registration does not authorize security testing against client infrastructure.

### Security & Governance
- **Authentication:** Bcrypt password hashing, signed JSON Web Tokens (JWT), and HttpOnly cookie session persistence (`/login`).
- **Authorization:** Server-side access control on all client mutation and read endpoints (HTTP 401/403).
- **Public Legal Pages (`/privacy` & `/terms`):** Structured legal documents with clearly marked corporate placeholders for legal counsel review.
- **Settings & Health Diagnostics (`/settings`):** Live database connection check, migration revision status, and user profile display.

---

## 2. Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, Lucide React, Zod, React Hook Form.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Psycopg 3, Alembic.
- **Database:** PostgreSQL 16 (relational schema with indexes, transactions, and UUID identifiers; SQLite support included for headless test isolation).
- **Package Managers:** `pnpm` (Node.js) & `uv` (Python).
- **Testing:** Pytest (24 backend & E2E tests) & Node.js Native Test Runner (8 frontend tests).

---

## 3. Repository Structure

```
LAZY NERD/
├── frontend/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout with brand metadata & favicon
│   │   ├── globals.css          # Design tokens & dark mode styling
│   │   ├── page.tsx             # Root redirect
│   │   ├── login/page.tsx       # Authentication page
│   │   ├── clients/             # Directory, create, profile, and edit
│   │   ├── privacy/page.tsx     # Privacy Policy
│   │   ├── terms/page.tsx       # Terms of Service
│   │   └── settings/page.tsx    # System diagnostics & account profile
│   ├── components/              # UI components, layout shell, modals, forms
│   ├── lib/                     # API client, auth context, utilities, validators
│   ├── types/                   # TypeScript interfaces
│   └── tests/                   # Frontend validation & formatter test suites
├── backend/
│   ├── app/
│   │   ├── api/v1/              # Versioned API routes (auth, clients, health)
│   │   ├── core/                # Configuration, security, and sanitized errors
│   │   ├── db/                  # SQLAlchemy session, engine pooling, Base
│   │   ├── models/              # Client & User SQLAlchemy models
│   │   ├── schemas/             # Pydantic v2 validation models
│   │   ├── services/            # Client & Auth business logic
│   │   ├── cli.py               # Management CLI (init-db, create-user, seed-demo)
│   │   └── main.py              # FastAPI application entry point
│   ├── migrations/              # Alembic migration revisions
│   ├── tests/                   # Pytest test suite (CRUD, search, auth, E2E)
│   ├── alembic.ini              # Alembic configuration
│   └── requirements.txt         # Python dependencies
├── docs/                        # Architecture, API, Security, Deployment specs
├── docker-compose.yml           # PostgreSQL 16 container definition
├── .env.example                 # Documented configuration template
├── .gitignore                   # Ignore rules for Python, Node, and environments
└── README.md                    # Project documentation
```

---

## 4. Local Development Setup

### Prerequisites
- macOS or Linux
- Node.js 18+ and `pnpm` (or `npm`)
- Python 3.10+ (Python 3.12 recommended) and `uv` (or standard `venv`)
- Optional: Docker and Docker Compose (for local PostgreSQL)

---

### Step 1: Clone and Configure Environment

```bash
cd "LAZY NERD"
cp .env.example .env
```

---

### Step 2: Set Up Backend

1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Initialize the database schema:
   - **Option A: With Docker PostgreSQL:**
     ```bash
     docker compose up -d postgres
     alembic upgrade head
     ```
   - **Option B: Local Standalone (SQLite for instant dev):**
     ```bash
     DATABASE_URL="sqlite:///./fixops_dev.db" python -m app.cli init-db
     ```
4. Create the initial authorized staff account:
   ```bash
   python -m app.cli create-user --email founder@lazynerds.com --password "AdminFixOps2026!" --name "Lazy Nerds Founder"
   ```
5. *(Optional)* Seed demonstration client data:
   ```bash
   python -m app.cli seed-demo
   ```
6. Start the FastAPI backend server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *The backend will be live at `http://127.0.0.1:8000` with Swagger docs at `http://127.0.0.1:8000/docs`.*

---

### Step 3: Set Up Frontend

1. Open a new terminal window:
   ```bash
   cd frontend
   pnpm install
   ```
2. Start the Next.js development server:
   ```bash
   pnpm dev
   ```
   *The frontend workspace will be live at `http://localhost:3000`.*

3. Navigate to `http://localhost:3000/login` and log in with:
   - **Email:** `founder@lazynerds.com`
   - **Password:** `AdminFixOps2026!`

---

## 5. Running Automated Tests

### Backend Test Suite (Pytest)
Executes 24 automated tests including CRUD validation, unauthorized request handling, error sanitization, and the 12-step end-to-end client lifecycle:
```bash
cd backend
.venv/bin/pytest tests -v
```

### Frontend Test Suite
Executes unit tests verifying Zod form validation rules and date formatters:
```bash
cd frontend
pnpm test
```

---

## 6. Building the Production Frontend

Compile TypeScript and build the static/dynamic Next.js application:
```bash
cd frontend
pnpm build
```

---

## 7. CLI Management Utility

The backend CLI utility provides essential operational commands:
```bash
cd backend
# Initialize database tables
python -m app.cli init-db

# Create an authorized user
python -m app.cli create-user --email user@example.com --password "SecurePass123!" --name "Consultant Name" --role "consultant"

# Seed explicit demo clients (clearly labeled with DEMO tags)
python -m app.cli seed-demo
```

---

## 8. Pre-Launch Gate & Readiness Status

Refer to [`docs/PRE_LAUNCH_GATE.md`](docs/PRE_LAUNCH_GATE.md) for the verified launch audit.
- **Application Logic & Security:** 100% verified and tested.
- **Production Pre-requisites:** Requires company legal counsel review of placeholder clauses in [`docs/PRE_LAUNCH_GATE.md`](docs/PRE_LAUNCH_GATE.md) and custom domain DNS provisioning prior to public production release.
