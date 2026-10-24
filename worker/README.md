# Lazy Nerds FixOps — Scanner Worker Architecture & Deployment

This directory contains the standalone, Docker-capable worker daemon for **Lazy Nerds FixOps**.

## Overview

FixOps' web API runs in cloud sandboxes (e.g. Render Web Services) that do not have access to a Docker daemon. The FixOps scanning architecture decouples job creation from execution:

1. **Web Backend (Render)**: Validates target scope, confirms client authorization, performs initial SSRF preflight, and records assessments in the database with status `queued`.
2. **Worker Daemon (This Service)**: Runs on Docker-capable infrastructure (developer workstation, dedicated on-premise runner, or an isolated worker VM). It authenticates to the FixOps backend via a secret token, claims queued jobs, executes them inside isolated Docker containers, streams telemetry, and submits findings.

```
+-------------------------------------------------------+
| FixOps Frontend (Vercel) / Backend (Render)           |
|   - Scope Validation & Authorization Enforcement      |
|   - Preflight SSRF Guard                              |
|   - Queues Assessment: status = 'queued'              |
+---------------------------+---------------------------+
                            |
           X-Worker-Token   |   Poll: GET /api/v1/workers/jobs/pending
                            v   Claim: POST /api/v1/workers/jobs/:id/claim
+-------------------------------------------------------+
| FixOps Scanner Worker Node                            |
|   - Worker SSRF Re-validation                         |
|   - Isolated Docker Containers (--cpus, --memory, ro) |
|   - Native Nuclei Black-Box Scanner                   |
|   - Shannon AI Pentester (when AI credits funded)     |
|   - Streams Live Telemetry to Backend                 |
|   - Ingests Findings: POST /api/v1/workers/jobs/:id/complete
+-------------------------------------------------------+
```

## Setup & Prerequisites

Run the automated setup script on the worker host:

```bash
chmod +x worker/setup_worker.sh
./worker/setup_worker.sh
```

This ensures:
- Docker daemon is responsive.
- Isolated bridge network `shannon-net` is created.
- Pinned Nuclei container (`projectdiscovery/nuclei:v3.11.1`) is pulled.
- Persistent template cache volume `fixops-nuclei-templates` is pre-warmed.

## Running the Worker

Set the required environment variables and launch the worker daemon:

```bash
export FIXOPS_API_URL="https://lazynerds-backend.onrender.com/api/v1"  # Or http://127.0.0.1:8000/api/v1
export FIXOPS_WORKER_TOKEN="<your-worker-secret-token>"
python3 worker/fixops_worker.py
```

## Security & Isolation Controls

- **Resource Limits**: Every scanner container runs with `--cpus 2.0`, `--memory 2g`, and `--pids-limit 128`.
- **Capability Dropping**: `--cap-drop ALL` and `--security-opt no-new-privileges:true`.
- **Read-Only Mounts**: Source code repositories are mounted strictly read-only (`:ro`).
- **SSRF Defense**: Target URLs are validated before container dispatch. Cloud metadata IP ranges (`169.254.169.254`, etc.) and internal infrastructure ports (22, 5432, 6379, 27017, etc.) are strictly blocked.
- **Truthful Attribution**: Live exploits and findings are cleanly separated from benchmark runs (`[LAB BENCHMARK]`).
