# Lazy Nerds FixOps Client Manager & Security Operations Platform

**Lazy Nerds FixOps** is a full-lifecycle security operations and client management platform built for **Lazy Nerds**, a cybersecurity company. It unifies client organizations, role-based access control, security engagements with legal Rules of Engagement (RoE), target asset scoping, vulnerability findings management, distributed containerized scanning (Nuclei and Shannon AI pentester), remediation automation, and signed executive reporting.

Built with a developer-first technical aesthetic: clean dark-mode typography, high contrast, thin borders, Lucide iconography, and strictly no purple gradients, bloated templates, or fake metrics.

---

## 1. Features Implemented

### Client Organization Management
- **Client Directory (`/clients`):** Paginated data table backed by PostgreSQL with server-side pagination, debounced search (by company name, contact, or email), status filtering (`Active`, `Archived`, `All`), and sort allowlisting.
- **Create & Edit Flows (`/clients/new`, `/clients/[clientId]/edit`):** Multi-step wizard and modals with dual-layer validation (Zod client-side, Pydantic backend), whitespace normalization, RFC email validation, and strict URL scheme filtering (`http`/`https` only).
- **Safe Archival & Restoration:** Soft-delete lifecycle that preserves historical identifiers and relations, excludes archived clients from default views, and allows one-click restoration.

### Role-Based Access Control & User Onboarding
- **Multi-Tenant Roles (`/register`, `/users`):** Built-in support for `admin`, `pentester`, and `client_viewer` roles with server-side privilege enforcement across all API endpoints.
- **Self-Service Registration & Onboarding:** Secure client organization self-registration with automatic role assignment and audit logging.
- **Authentication & Sessions:** Bcrypt password hashing, signed JSON Web Tokens (JWT), HttpOnly cookie session management, and secure password reset token workflows.

### Security Engagements Lifecycle
- **Engagement Scoping & Tracking (`/engagements`):** Comprehensive engagement management across assessment types (Web Application Pentest, Network Vulnerability Assessment, Cloud Review, Red Team Simulation).
- **Rules of Engagement (RoE) Verification:** Explicit RoE tracking ensuring testing is never initiated without verified legal authorization (`draft`, `pending`, `confirmed`).
- **Timeline & Date Sequencing:** Form and API validation guaranteeing `due_date >= start_date`, phase progress tracking, and immutable terminal states (`completed`, `cancelled`).

### Target Asset Management & SSRF Protection
- **Asset Scoping (`/assets`):** Association of in-scope domains, IP addresses, web applications, and source repositories to specific client engagements.
- **Multi-Layer SSRF Guard:** Server-side destination validation blocking cloud metadata IP ranges (`169.254.169.254`, AWS/GCP internal metadata), loopback/private IP addresses in production mode, and restricted internal ports (22, 5432, 6379, 27017, etc.) before any network probe.

### Vulnerability Findings & Scanner Orchestration
- **Findings Repository (`/findings`):** Structured vulnerability tracking with CVSS v3.1 scoring, severity classifications (Critical, High, Medium, Low, Info), CWE/CVE cross-referencing, remediation guidance, reproduction evidence, and status tracking (`open`, `in_progress`, `remediated`, `accepted_risk`, `false_positive`).
- **Scanner Adapters (`/scanners`):** Native orchestration of Nuclei black-box scanning and Shannon AI source-assisted pentesting, with SARIF 2.1.0 standard report ingestion.
- **Truthful Provenance & AI Guards:** Clean demarcation separating live verified exploits from synthetic benchmark runs (`[LAB BENCHMARK]`), ensuring honest reporting without fabricated AI findings.

### Distributed Scanner Worker Subsystem
- **Decoupled Worker Architecture (`worker/fixops_worker.py`):** Standalone worker daemon executing automated scans inside isolated, resource-constrained Docker containers (`--cpus 2.0`, `--memory 2g`, `--cap-drop ALL`, read-only mounts).
- **Claimant Ownership & State Protection:** Atomic job claiming that locks assessment execution to a specific `worker_id`. Mutation endpoints (`/progress`, `/complete`, `/fail`, `/heartbeat`) strictly reject non-claimant requests with HTTP 403 Forbidden. Completed, failed, or unclaimed jobs cannot be overwritten (HTTP 409 Conflict).
- **Bounded Lease & Abandoned Worker Recovery:** Configurable worker leases (`WORKER_LEASE_SECONDS`) renewed on progress and heartbeats. Automatic background sweeps (`recover_abandoned_assessments`) re-queue abandoned jobs within retry limits (`WORKER_MAX_RETRIES`) or mark them permanently failed upon worker loss, protected by row-level locking.

### Remediation Automation & Executive Reporting
- **Event-Driven Automation Engine (`/automations`):** Real-time webhook dispatching on platform events (`on_finding_created`, severity-based routing, rule matching) with delivery auditing.
- **Executive & Technical Reporting (`/reports`):** Automated compilation of executive summary reports with CVSS risk distributions, engagement highlights, and remediation progress metrics.

---

## 2. Technology Stack

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript (strict), Tailwind CSS, Lucide React, Zod, React Hook Form.
- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0, Psycopg 3, Alembic.
- **Worker Daemon:** Python 3.12, Docker daemon, pinned Nuclei container (`v3.11.1`), isolated bridge network (`shannon-net`).
- **Database:** PostgreSQL 16 (relational schema with indexes, transactions, and UUID identifiers; SQLite support included for headless test isolation).
- **Testing:** Pytest (141 backend automated tests) & Node.js Native Test Runner (61 frontend automated tests).

---

## 3. Repository Structure

```
LAZY NERD/
├── frontend/                    # Next.js 15 frontend application
│   ├── app/                     # App router pages (clients, engagements, assets, findings, etc.)
│   ├── components/              # UI components, layout shell, modals, wizards
│   ├── lib/                     # API client, auth context, formatters, validators
│   ├── types/                   # TypeScript interfaces
│   └── tests/                   # 60 frontend unit and integration tests
├── backend/                     # FastAPI backend service
│   ├── app/
│   │   ├── api/v1/              # Versioned API routes (auth, clients, engagements, workers, etc.)
│   │   ├── core/                # Config, security, SSRF preflight, error sanitization
│   │   ├── db/                  # SQLAlchemy session, engine pooling, Base
│   │   ├── models/              # Relational models (Client, Engagement, Asset, Finding, Assessment, User)
│   │   ├── schemas/             # Pydantic v2 validation and serialization schemas
│   │   ├── services/            # Business logic (scanner, worker, audit, automation, auth)
│   │   └── cli.py               # Management CLI
│   ├── migrations/              # Alembic revisions (001 through 005_scanner_worker_ownership_and_leases)
│   └── tests/                   # 129 Pytest automated tests
├── worker/                      # Decoupled Docker-capable scanner worker daemon
│   ├── fixops_worker.py         # Worker daemon polling, claiming, and executing scans
│   ├── setup_worker.sh          # Worker node environment preflight & Docker cache setup
│   └── README.md                # Worker operational architecture & lease settings
├── lab/                         # Offline testing lab & vulnerable mock benchmark targets
├── docs/                        # Architecture, API, Security, and Launch Gate specifications
│   ├── PRE_LAUNCH_GATE.md       # Mandatory pre-launch audit checklist & blockers
│   ├── ARCHITECTURE.md          # System architecture and data flow
│   └── SECURITY.md              # Threat model and defensive controls
├── docker-compose.yml           # PostgreSQL 16 container definition
└── README.md                    # Project documentation
```

---

## 4. Local Development Setup

### Prerequisites
- macOS or Linux
- Node.js 18+ and `pnpm`
- Python 3.10+ (Python 3.12 recommended)
- Docker and Docker Compose (required for scanner execution and local PostgreSQL)

---

### Step 1: Clone and Configure Environment

```bash
cd "LAZY NERD"
cp .env.example .env
```

---

### Step 2: Set Up Backend

1. Navigate to the backend directory and activate virtual environment:
   ```bash
   cd backend
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Initialize database migrations:
   ```bash
   # Option A: With Docker PostgreSQL:
   docker compose up -d postgres
   alembic upgrade head

   # Option B: Local SQLite (instant dev):
   DATABASE_URL="sqlite:///./fixops_dev.db" python -m app.cli init-db
   ```
3. Create the initial administrator account:
   ```bash
   python -m app.cli create-user --email founder@lazynerds.com --password "SecureAdminPassword123!" --name "Lazy Nerds Admin" --role admin
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
   *Backend will be live at `http://127.0.0.1:8000` with Swagger docs at `http://127.0.0.1:8000/docs`.*

---

### Step 3: Set Up Scanner Worker Node

In a separate terminal on a Docker-capable machine:

```bash
chmod +x worker/setup_worker.sh
./worker/setup_worker.sh

export FIXOPS_API_URL="http://127.0.0.1:8000/api/v1"
export FIXOPS_WORKER_TOKEN="fixops_worker_secret_token_dev_2026"
python3 worker/fixops_worker.py
```

---

### Step 4: Set Up Frontend

In a separate terminal window:

```bash
cd frontend
pnpm install
pnpm dev
```
*Frontend workspace will be live at `http://localhost:3000`.*

---

## 5. Running Automated Tests

### Backend Test Suite (Pytest)
Executes 141 automated tests including auth, role permissions, engagements, assets, finding deduplication, scanner adapters, worker ownership, bounded lease recovery, error sanitization, and end-to-end workflows:
```bash
cd backend
.venv/bin/pytest tests -v
```

### Frontend Test Suite (Node.js Test Runner)
Executes 61 automated tests verifying Zod schemas, multi-step wizards, responsive layouts, 204 response handling, and timezone formatters:
```bash
cd frontend
pnpm test
```

---

## 6. Pre-Launch Gate & Readiness Status

Refer to [`docs/PRE_LAUNCH_GATE.md`](docs/PRE_LAUNCH_GATE.md) for the verified launch audit.

- **Local Application Readiness:** **100% COMPLETE**. All features, API routes, database schemas, worker daemons, and 202 automated tests (141 backend + 61 frontend) are fully verified and passing.
- **Production Launch Blockers:** Production public release remains strictly gated on human/operations prerequisites:
  1. Corporate legal review of placeholder clauses (`[COMPANY LEGAL ENTITY]`, `[REGISTERED JURISDICTION]`, `[LEGAL COUNSEL CONTACT]`).
  2. Production cloud VPC hosting and least-privilege PostgreSQL user provisioning.
  3. Production TLS certificate termination.
  4. Custom domain DNS record configuration for `lazynerds.com`.
