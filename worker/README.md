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

## Operational Settings & Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `FIXOPS_WORKER_TOKEN` | `fixops_worker_secret_token_dev_2026` | Shared secret token required in `X-Worker-Token` header. |
| `WORKER_DISPATCH_MODE` | `auto` | Dispatch strategy: `auto`, `distributed` (decoupled polling worker nodes), or `embedded`. |
| `WORKER_LEASE_SECONDS` | `300` | Duration (in seconds) of the worker lease upon job claim and renewed on heartbeats/progress (5 minutes). |
| `WORKER_HEARTBEAT_TIMEOUT_SECONDS` | `180` | Heartbeat freshness threshold for active worker nodes (3 minutes). |
| `WORKER_MAX_RETRIES` | `2` | Maximum retry attempts for abandoned assessments before marking them permanently as failed. |
| `DOCKER_MAX_CPUS` | `2.0` | CPU execution cap enforced on scanner Docker containers. |
| `DOCKER_MAX_MEMORY` | `2g` | Memory cap enforced on scanner Docker containers. |
| `ALLOW_LAB_TESTING` | `true` | Allows loopback addresses (`127.0.0.1`, `localhost`) for offline sandbox verification. |

## Worker Ownership & State Transition Invariants

To guarantee data integrity and eliminate race conditions across multiple distributed worker nodes, FixOps enforces strict state machine rules:

1. **Claimant Ownership**:
   - When a worker claims an assessment (`POST /api/v1/workers/jobs/{id}/claim`), the record atomically stores `worker_id`, `claimed_at`, and `lease_expires_at`.
   - All subsequent mutation endpoints (`/progress`, `/complete`, `/fail`, `/heartbeat`) strictly verify that `payload.worker_id == assessment.worker_id`.
   - Requests from any other worker are rejected with **HTTP 403 Forbidden**.
2. **State Protection**:
   - Unclaimed jobs in `queued` status cannot receive progress, completion, or failure payloads without being claimed first (**HTTP 409 Conflict**).
   - Once an assessment transitions to terminal status (`completed` or `failed`), it is strictly immutable and cannot be overwritten by progress or completion attempts (**HTTP 409 Conflict**).

## Bounded Lease & Abandoned Worker Recovery

Distributed worker nodes may disconnect unexpectedly due to spot VM termination, host crashes, or network partitions. FixOps includes a resilient, bounded lease recovery subsystem:

1. **Lease Extension**:
   - Claiming a job sets an initial expiration (`lease_expires_at = now + WORKER_LEASE_SECONDS`).
   - Every progress update (`POST /jobs/{id}/progress`) or dedicated heartbeat (`POST /jobs/{id}/heartbeat` or `/heartbeat` with `active_job_ids`) automatically advances `lease_expires_at`.
2. **Automatic Detection & Re-queuing**:
   - Any running assessment whose lease has expired (`lease_expires_at < now`) is identified as abandoned.
   - If `retry_count < WORKER_MAX_RETRIES`: The assessment's `retry_count` is incremented, `worker_id` and leases are cleared, status is reset to `queued`, and audit logs record the recovery event. The job is immediately available for another healthy worker to pick up.
   - If `retry_count >= WORKER_MAX_RETRIES`: The assessment is permanently marked `failed`, `completed_at` is stamped, and failure diagnostics note worker loss.
3. **Execution Sweep Trigger**:
   - Recovery is evaluated automatically whenever workers poll for pending work (`GET /api/v1/workers/jobs/pending`).
   - Recovery can also be explicitly invoked via `POST /api/v1/workers/jobs/recover-abandoned`.
4. **Duplicate Execution Prevention**:
   - Uses transactional row-level locking (`with_for_update(skip_locked=True)` in PostgreSQL) to prevent competing workers from claiming or recovering the same assessment simultaneously.
   - If a disconnected worker later reconnects and attempts to report results on an assessment that was already recovered and re-assigned, its request is rejected with **HTTP 403 Forbidden**.

## Security & Isolation Controls

- **Resource Limits**: Every scanner container runs with `--cpus 2.0`, `--memory 2g`, and `--pids-limit 128`.
- **Capability Dropping**: `--cap-drop ALL` and `--security-opt no-new-privileges:true`.
- **Read-Only Mounts**: Source code repositories are mounted strictly read-only (`:ro`).
- **SSRF Defense**: Target URLs are validated before container dispatch. Cloud metadata IP ranges (`169.254.169.254`, etc.) and internal infrastructure ports (22, 5432, 6379, 27017, etc.) are strictly blocked.
- **Truthful Attribution**: Live exploits and findings are cleanly separated from benchmark runs (`[LAB BENCHMARK]`).
