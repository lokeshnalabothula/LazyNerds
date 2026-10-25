#!/usr/bin/env python3
"""
Lazy Nerds FixOps — Standalone Docker-Capable Scanner Worker Daemon
===================================================================
A secure, decoupled worker daemon that executes automated security assessments
(Nuclei black-box scanner and Shannon AI pentester) on Docker-capable infrastructure.

Key Security & Operational Invariants:
1. Least Privilege: Executes tools inside isolated, resource-constrained Docker containers.
2. SSRF Defense: Enforces server-side destination validation before running any network probe.
3. Truthful Provenance: Clearly separates live scan findings from benchmark mock runs.
4. AI Guard: Fails honestly if LLM credits are unavailable; never fabricates results.
5. Zero Leaks: Redacts credentials and API keys in all telemetry and logs.
"""

import argparse
import ipaddress
import json
import logging
import os
import platform
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import urllib.error
import uuid
from typing import Any, Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [FixOpsWorker] %(message)s",
)
logger = logging.getLogger("fixops.worker")

# Import AI provider utilities from backend core if available
try:
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))
    from app.core.ai_provider import (
        parse_model_spec,
        resolve_provider_credentials,
        validate_ai_provider_preflight,
        sanitize_ai_error,
    )
except ImportError:
    def sanitize_ai_error(msg: str, **kwargs) -> str:
        clean = re.sub(r"(ci_live_[a-zA-Z0-9_\-]{16,})", "[REDACTED_KEY]", str(msg))
        clean = re.sub(r"(sk-[a-zA-Z0-9_\-]{16,})", "[REDACTED_KEY]", clean)
        clean = re.sub(r"(xai-[a-zA-Z0-9_\-]{16,})", "[REDACTED_KEY]", clean)
        clean = re.sub(r"(freellmapi-[a-zA-Z0-9_\-]{16,})", "[REDACTED_KEY]", clean)
        if "insufficient_balance" in clean or "402" in clean:
            return "AI provider billing error: Insufficient wallet balance on provider (HTTP 402). Please top up credits."
        return clean

    def validate_ai_provider_preflight(**kwargs) -> Tuple[bool, Optional[str]]:
        has_key = bool(os.getenv("SHANNON_AI_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("XAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))
        if not has_key:
            return False, "No valid AI credentials found in environment. Use Lab Benchmark mode for offline verification."
        return True, None

# ---------------------------------------------------------------------------
# Configuration Defaults
# ---------------------------------------------------------------------------
API_URL = os.getenv("FIXOPS_API_URL", "http://127.0.0.1:8000/api/v1").rstrip("/")
WORKER_TOKEN = os.getenv("FIXOPS_WORKER_TOKEN", "fixops_worker_secret_token_dev_2026")
WORKER_ID = os.getenv("FIXOPS_WORKER_ID", f"fixops-wkr-{platform.node()[:12]}-{uuid.uuid4().hex[:6]}")
POLL_INTERVAL = int(os.getenv("FIXOPS_POLL_INTERVAL", "5"))
MAX_CPUS = float(os.getenv("DOCKER_MAX_CPUS", "2.0"))
MAX_MEMORY = os.getenv("DOCKER_MAX_MEMORY", "2g")
ALLOW_LAB_TESTING = os.getenv("ALLOW_LAB_TESTING", "true").lower() in ("true", "1", "yes")

ACTIVE_CONTAINER: Optional[str] = None
RUNNING = True


# ---------------------------------------------------------------------------
# SSRF Preflight Guard
# ---------------------------------------------------------------------------
RESTRICTED_PORTS = {22, 25, 111, 135, 139, 445, 1433, 1521, 2375, 2376, 3306, 5432, 6379, 11211, 27017}

def validate_target_url_ssrf(url: str, allow_lab_testing: bool = True) -> Tuple[bool, str]:
    if not url or not isinstance(url, str):
        return False, "Target URL is required."
    clean_url = url.strip()
    try:
        parsed = urllib.parse.urlparse(clean_url)
    except Exception:
        return False, "Malformed target URL."

    if parsed.scheme.lower() not in ("http", "https"):
        return False, f"Unsupported URL scheme '{parsed.scheme}'. Only http and https are permitted."

    hostname = parsed.hostname
    if not hostname:
        return False, "Target URL missing valid host name."

    # Cloud metadata protection
    blocked_hosts = {
        "169.254.169.254", "instance-data", "metadata.google.internal",
        "metadata.internal", "fd00:ec2::254", "100.100.100.200",
    }
    if hostname.lower() in blocked_hosts:
        return False, f"SSRF blocked: Access to cloud metadata service '{hostname}' is strictly prohibited."

    # Port restriction
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port in RESTRICTED_PORTS:
        return False, f"SSRF blocked: Port {port} is restricted to protect internal infrastructure."

    # Loopback / private address check
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_loopback or ip.is_private:
            if allow_lab_testing and (ip.is_loopback or str(ip).startswith("127.")):
                return True, ""
            return False, f"SSRF blocked: Target IP '{ip}' is in private or loopback address space."
    except ValueError:
        pass

    if hostname.lower() in ("localhost", "127.0.0.1", "::1", "host.docker.internal"):
        if allow_lab_testing:
            return True, ""
        return False, "SSRF blocked: Localhost targets are forbidden in production."

    return True, ""


# ---------------------------------------------------------------------------
# API Communication Client
# ---------------------------------------------------------------------------
def api_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Any:
    url = f"{API_URL}{endpoint}"
    headers = {
        "X-Worker-Token": WORKER_TOKEN,
        "Content-Type": "application/json",
        "User-Agent": f"FixOpsWorker/{WORKER_ID}",
    }
    encoded_data = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded_data, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="replace")
        logger.error(f"API {method} {endpoint} returned {e.code}: {err_msg}")
        raise RuntimeError(f"API Error {e.code}: {err_msg}")
    except Exception as e:
        logger.error(f"API connection failure {method} {endpoint}: {e}")
        raise


# ---------------------------------------------------------------------------
# Output Parsers
# ---------------------------------------------------------------------------
def parse_nuclei_json_output(output_text: str) -> List[Dict[str, Any]]:
    findings = []
    if not output_text:
        return findings

    # Handles JSON array or NDJSON (line-delimited)
    lines = [line.strip() for line in output_text.splitlines() if line.strip()]
    raw_records = []
    if output_text.strip().startswith("["):
        try:
            raw_records = json.loads(output_text)
        except Exception:
            pass

    if not raw_records:
        for line in lines:
            try:
                raw_records.append(json.loads(line))
            except Exception:
                pass

    seen = set()
    for rec in raw_records:
        info = rec.get("info", {})
        title = info.get("name") or rec.get("template-id") or "Nuclei Security Finding"
        severity = info.get("severity", "info").lower()
        if severity not in ("critical", "high", "medium", "low", "info"):
            severity = "info"

        matched = rec.get("matched-at") or rec.get("host") or ""
        dedup_key = f"{title}:{matched}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        classification = info.get("classification", {})
        cve_id = None
        if "cve-id" in classification:
            cves = classification["cve-id"]
            cve_id = cves[0] if isinstance(cves, list) and cves else str(cves)

        cvss_score = classification.get("cvss-score")
        if cvss_score is not None:
            try:
                cvss_score = float(cvss_score)
            except Exception:
                cvss_score = None

        findings.append({
            "title": title[:255],
            "severity": severity,
            "cvss_score": cvss_score,
            "cve_id": cve_id,
            "description": info.get("description") or f"Finding detected by template {rec.get('template-id')}",
            "impact": f"Detected matching security pattern at endpoint: {matched}",
            "remediation_guidance": info.get("remediation") or "Investigate and apply vendor security updates.",
            "evidence": f"Matched target: {matched}\nCurl command: {rec.get('curl-command', 'N/A')}\nExtractor results: {json.dumps(rec.get('extracted-results', []))}",
            "references_url": ", ".join(info.get("reference", [])) if isinstance(info.get("reference"), list) else None,
            "remediation_notes": "[Source: Nuclei Black-Box Scanner]",
        })
    return findings


# ---------------------------------------------------------------------------
# Scan Execution Engines
# ---------------------------------------------------------------------------
def ensure_docker_network(network_name: str = "shannon-net") -> None:
    """Verifies that the isolated Docker bridge network exists, creating it if needed."""
    try:
        check = subprocess.run(["docker", "network", "inspect", network_name], capture_output=True, timeout=5)
        if check.returncode != 0:
            subprocess.run(["docker", "network", "create", "--driver", "bridge", network_name], capture_output=True, timeout=5)
            logger.info(f"Created isolated Docker network '{network_name}'.")
    except Exception as e:
        logger.warning(f"Could not verify/create Docker network '{network_name}': {e}")


def run_nuclei_scan(job: Dict[str, Any], workspace: str) -> Tuple[List[Dict[str, Any]], Any]:
    global ACTIVE_CONTAINER
    target_url = job["target_url"]
    assessment_id = job.get("assessment_id") or job.get("id")
    container_name = f"fixops-nuclei-{assessment_id[:8]}"
    output_file = os.path.join(workspace, "nuclei_output.json")

    # Ensure isolated network exists prior to container launch
    ensure_docker_network("shannon-net")

    # Docker target resolution for local loopback
    docker_target = target_url
    if "127.0.0.1" in docker_target or "localhost" in docker_target:
        docker_target = docker_target.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal")

    # Send progress: pre-recon / starting
    api_request(
        f"/workers/jobs/{assessment_id}/progress",
        method="POST",
        data={
            "worker_id": WORKER_ID,
            "phase": "pre-recon",
            "progress_percent": 20,
            "current_status": "Starting Nuclei container sandbox with persistent templates...",
            "active_agent": "nuclei-sandbox",
            "log_chunk": f"Target normalized: {docker_target} on bridge network",
        },
    )

    cmd = [
        "docker", "run", "--rm",
        "--name", container_name,
        "--network", "shannon-net",
        "--cpus", str(MAX_CPUS),
        "--memory", MAX_MEMORY,
        "--pids-limit", "128",
        "--security-opt", "no-new-privileges:true",
        "--cap-drop", "ALL",
        "-v", f"{workspace}:/app/output",
        "-v", "fixops-nuclei-templates:/root/nuclei-templates",
        "projectdiscovery/nuclei:latest",
        "-u", docker_target,
        "-json-export", "/app/output/nuclei_output.json",
        "-silent",
        "-timeout", "10",
        "-tags", "cve,misconfig,tech,exposure",
    ]

    ACTIVE_CONTAINER = container_name
    try:
        api_request(
            f"/workers/jobs/{assessment_id}/progress",
            method="POST",
            data={
                "worker_id": WORKER_ID,
                "phase": "vuln_analysis",
                "progress_percent": 60,
                "current_status": "Executing vulnerability assessment checks against target surface...",
                "active_agent": "nuclei-scanner",
                "log_chunk": f"Command dispatched to Docker: {' '.join(cmd[:6])} ...",
            },
        )
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    finally:
        ACTIVE_CONTAINER = None

    if os.path.exists(output_file):
        with open(output_file, "r", encoding="utf-8") as f:
            raw_text = f.read()
        findings = parse_nuclei_json_output(raw_text)
        return findings, raw_text
    else:
        return [], {"status": "no_findings_file", "stdout": proc.stdout, "stderr": proc.stderr}


def run_shannon_scan(job: Dict[str, Any], workspace: str) -> Tuple[List[Dict[str, Any]], Any]:
    assessment_id = job.get("assessment_id") or job.get("id")
    target_url = job["target_url"]
    source_repo = job.get("source_repo")
    is_mock = job.get("benchmark_mode", False)

    if is_mock:
        api_request(
            f"/workers/jobs/{assessment_id}/progress",
            method="POST",
            data={
                "worker_id": WORKER_ID,
                "phase": "recon",
                "progress_percent": 40,
                "current_status": "Running benchmark test suite against verified lab endpoints...",
                "active_agent": "lab-benchmark",
                "log_chunk": f"Benchmark evaluation on {target_url}",
            },
        )
        time.sleep(1)
        mock_findings = [
            {
                "title": "SQL Injection in Product Search API",
                "severity": "high",
                "cvss_score": 8.6,
                "cve_id": "CWE-89",
                "description": "Unsanitized user parameter 'query' in product search is concatenated into SQL statement.",
                "impact": "Arbitrary database read/write access.",
                "remediation_guidance": "Use parameterized prepared statements.",
                "evidence": f"POST {target_url}/api/products/search with query=\"' OR '1'='1\"",
                "remediation_notes": "[LAB BENCHMARK] Simulated test finding from benchmark suite.",
            }
        ]
        return mock_findings, {"status": "benchmark_mock", "count": 1}

    # Live Shannon AI Scan: Check AI credentials
    is_valid_provider, preflight_err = validate_ai_provider_preflight(verify_network=True)
    if not is_valid_provider:
        raise RuntimeError(preflight_err)

    raise RuntimeError(
        "Live Shannon AI scan credits are currently disabled to prevent unapproved API billing. "
        "Use Lab Benchmark mode or enable credits once provider billing is funded."
    )


# ---------------------------------------------------------------------------
# Job Execution Routine
# ---------------------------------------------------------------------------
def process_job(job: Dict[str, Any]):
    assessment_id = job.get("assessment_id") or job.get("id")
    scan_mode = job.get("scan_mode", "blackbox")
    target_url = job.get("target_url")
    logger.info(f"Processing job {assessment_id} (mode={scan_mode}, target={target_url})")

    # SSRF verification on worker
    is_safe, ssrf_err = validate_target_url_ssrf(target_url, allow_lab_testing=ALLOW_LAB_TESTING)
    if not is_safe:
        api_request(
            f"/workers/jobs/{assessment_id}/fail",
            method="POST",
            data={
                "worker_id": WORKER_ID,
                "error_message": f"Worker SSRF validation blocked target: {ssrf_err}",
                "error_logs": f"Target URL: {target_url}",
            },
        )
        return

    workspace = tempfile.mkdtemp(prefix=f"fixops-job-{assessment_id[:8]}-")
    try:
        if scan_mode == "source_assisted" or job.get("assessment_tool") == "shannon":
            findings, raw_output = run_shannon_scan(job, workspace)
        else:
            findings, raw_output = run_nuclei_scan(job, workspace)

        # Upload complete results
        logger.info(f"Job {assessment_id} finished successfully. Ingesting {len(findings)} findings.")
        api_request(
            f"/workers/jobs/{assessment_id}/complete",
            method="POST",
            data={
                "worker_id": WORKER_ID,
                "findings": findings,
                "raw_output": raw_output,
                "deliverables": {
                    "worker_node": WORKER_ID,
                    "findings_count": len(findings),
                    "execution_timestamp": time.time(),
                },
            },
        )
    except Exception as e:
        clean_err = sanitize_ai_error(str(e))
        logger.error(f"Execution failed for job {assessment_id}: {clean_err}", exc_info=True)
        try:
            api_request(
                f"/workers/jobs/{assessment_id}/fail",
                method="POST",
                data={
                    "worker_id": WORKER_ID,
                    "error_message": clean_err,
                    "error_logs": f"Exception encountered on worker {WORKER_ID}: {clean_err}",
                },
            )
        except Exception as api_err:
            logger.error(f"Failed to report failure to backend: {api_err}")
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


# ---------------------------------------------------------------------------
# Signal Handling
# ---------------------------------------------------------------------------
def handle_shutdown(signum, frame):
    global RUNNING, ACTIVE_CONTAINER
    logger.info("Shutdown signal received. Stopping worker daemon gracefully...")
    RUNNING = False
    if ACTIVE_CONTAINER:
        try:
            logger.info(f"Terminating active Docker container: {ACTIVE_CONTAINER}")
            subprocess.run(["docker", "rm", "-f", ACTIVE_CONTAINER], capture_output=True, timeout=5)
        except Exception:
            pass
    sys.exit(0)


# ---------------------------------------------------------------------------
# Main Daemon Loop
# ---------------------------------------------------------------------------
def main():
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info(f"FixOps Scanner Worker starting. ID: {WORKER_ID}")
    logger.info(f"Target Backend API: {API_URL}")
    logger.info(f"Max Resources: {MAX_CPUS} CPUs, {MAX_MEMORY} RAM")

    # Initial Docker readiness check
    docker_bin = shutil.which("docker")
    if not docker_bin:
        logger.error("CRITICAL: Docker binary not found in PATH. Docker worker requires an active Docker daemon.")
    else:
        try:
            res = subprocess.run(["docker", "info"], capture_output=True, text=True, timeout=5)
            if res.returncode == 0:
                logger.info("Docker daemon verified and responsive.")
                ensure_docker_network("shannon-net")
            else:
                logger.warning(f"Docker daemon check returned non-zero code {res.returncode}")
        except Exception as e:
            logger.warning(f"Docker daemon connectivity test warning: {e}")

    consecutive_errors = 0
    while RUNNING:
        try:
            # 1. Heartbeat
            hb = api_request(
                "/workers/heartbeat",
                method="POST",
                data={
                    "worker_id": WORKER_ID,
                    "hostname": platform.node(),
                    "status": "online",
                    "docker_available": bool(docker_bin),
                    "nuclei_available": True,
                    "shannon_available": False,
                    "active_jobs_count": 0,
                    "max_concurrent_jobs": 2,
                    "version": "1.0.0",
                },
            )
            consecutive_errors = 0

            # 2. Poll for pending jobs
            pending = api_request("/workers/jobs/pending?limit=1", method="GET")
            jobs = pending.get("jobs", [])
            if jobs:
                candidate = jobs[0]
                job_id = candidate["id"]
                logger.info(f"Found queued job {job_id} ({candidate.get('name')}). Attempting to claim...")
                try:
                    claimed = api_request(
                        f"/workers/jobs/{job_id}/claim",
                        method="POST",
                        data={"worker_id": WORKER_ID},
                    )
                    logger.info(f"Claimed job {job_id} successfully. Disagreeing with idle state.")
                    process_job(claimed)
                except RuntimeError as re_err:
                    logger.warning(f"Failed to claim job {job_id} (might have been claimed by another worker): {re_err}")

        except Exception as loop_err:
            consecutive_errors += 1
            if consecutive_errors % 6 == 1:
                logger.warning(f"Worker heartbeat/poll cycle failed: {loop_err}")

        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    main()
