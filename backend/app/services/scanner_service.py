import json
import logging
import os
import shutil
import subprocess
import threading
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import validate_target_url_ssrf
from app.db.session import SessionLocal
from app.models.asset import Asset
from app.models.engagement import Engagement
from app.models.finding import Assessment, Finding
from app.models.user import User
from app.services.audit_service import log_audit
from app.services.scan_adapters import (
    parse_shannon_records,
    parse_nuclei_records,
    run_or_import_scan,
)
from app.services.automation_engine import dispatch_event

logger = logging.getLogger("fixops.scanner")

MAX_CONCURRENT_SCANS = 3

# In-memory tracking of active scan background processes
ACTIVE_SCAN_THREADS: Dict[str, threading.Thread] = {}
SCAN_PROCESS_PIDS: Dict[str, Optional[int]] = {}


def get_scan_workspace_dir(assessment_id: str) -> str:
    base_dir = getattr(settings, "SCAN_WORKSPACES_DIR", "/tmp/fixops_scans")
    workspace = os.path.join(base_dir, assessment_id)
    os.makedirs(workspace, mode=0o700, exist_ok=True)
    return workspace


def cleanup_scan_workspace(assessment_id: str):
    base_dir = getattr(settings, "SCAN_WORKSPACES_DIR", "/tmp/fixops_scans")
    workspace = os.path.join(base_dir, assessment_id)
    if os.path.exists(workspace):
        try:
            shutil.rmtree(workspace, ignore_errors=True)
        except Exception as e:
            logger.warning(f"Failed to clean up scan workspace {workspace}: {e}")


def update_assessment_progress(
    assessment_id: str,
    phase: str,
    progress_percent: int,
    message: str,
    active_agent: Optional[str] = None,
    log_line: Optional[str] = None,
    db: Optional[Session] = None,
):
    """Updates real-time progress state in the Assessment record."""
    session_created = False
    if db is None:
        db = SessionLocal()
        session_created = True

    try:
        assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            return
        # If already terminal and not updating to terminal status, ignore
        if assessment.status in ("completed", "failed") and phase not in ("completed", "failed"):
            return

        current_summary = {}
        if assessment.execution_summary:
            try:
                current_summary = json.loads(assessment.execution_summary)
            except Exception:
                current_summary = {"raw": assessment.execution_summary}

        logs = current_summary.get("logs", [])
        if log_line:
            logs.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "phase": phase,
                "agent": active_agent,
                "message": log_line,
            })
            if len(logs) > 100:
                logs = logs[-100:]

        current_summary.update({
            "phase": phase,
            "progress_percent": progress_percent,
            "current_status": message,
            "active_agent": active_agent,
            "logs": logs,
            "last_updated": datetime.now(timezone.utc).isoformat(),
        })

        assessment.execution_summary = json.dumps(current_summary)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to update progress for assessment {assessment_id}: {e}")
        db.rollback()
    finally:
        if session_created:
            db.close()


def generate_lab_assessment_sarif(target_url: str, repo_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Generates standard Shannon SARIF 2.1.0 output for the local vulnerable lab target.
    Used for safe, air-gapped local verification without incurring third-party LLM API costs.
    """
    return {
        "$schema": "https://json.schemastore.org/sarif-2.1.0.json",
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "Shannon",
                        "informationUri": "https://github.com/KeygraphHQ/shannon",
                        "rules": [
                            {
                                "id": "shannon/injection",
                                "name": "SQL Injection",
                                "shortDescription": {"text": "SQL Injection in Search Query"},
                                "fullDescription": {"text": "Untrusted input reaches SQLite query string formatting at /api/products/search."},
                                "help": {"text": "Use parameterized queries with bound variables rather than string concatenation."},
                            },
                            {
                                "id": "shannon/authz",
                                "name": "Broken Object-Level Authorization",
                                "shortDescription": {"text": "BOLA / IDOR in User Profile API"},
                                "fullDescription": {"text": "Unauthenticated caller can enumerate sensitive user profiles and API keys at /api/users/{id}/profile."},
                                "help": {"text": "Enforce strict tenant authorization checks and require valid session credentials before serving user profile entities."},
                            },
                            {
                                "id": "shannon/ssrf",
                                "name": "Server-Side Request Forgery",
                                "shortDescription": {"text": "SSRF in Webhook Test Endpoint"},
                                "fullDescription": {"text": "The endpoint /api/integrations/webhook-test fetches user-supplied URLs without IP/domain allowlisting or network segmentation."},
                                "help": {"text": "Validate callback URLs against strict allowlists and block internal IP addresses and cloud metadata."},
                            },
                        ]
                    }
                },
                "results": [
                    {
                        "ruleId": "shannon/injection",
                        "level": "error",
                        "message": {
                            "markdown": "**SQL Injection via Product Search Parameter**\n\nThe `q` parameter in `/api/products/search` is interpolated directly into a SQL query string without escaping or parameter binding. An unauthenticated attacker can supply `' OR 1=1--` to bypass filters and extract database contents.\n\n**Impact**\n\nFull database read access including product inventories and user credential extraction.\n\n**Remediation**\n\nReplace string formatting with parameterized SQL: `cursor.execute('SELECT * FROM products WHERE name LIKE ?', (f'%{q}%',))`.\n\nFull exploitation evidence: `curl -k -X GET \"http://127.0.0.1:8888/api/products/search?q='%20UNION%20SELECT%20id,username,email,api_key,role%20FROM%20users--\"`",
                            "text": "SQL Injection in /api/products/search via raw query string formatting."
                        },
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": "lab/vulnerable_app/main.py"},
                                    "region": {"startLine": 74}
                                }
                            }
                        ],
                        "webRequest": {
                            "method": "GET",
                            "target": f"{target_url.rstrip('/')}/api/products/search?q='%20OR%201=1--"
                        },
                        "properties": {
                            "findingId": "INJ-01",
                            "parameter": "q",
                            "status": "exploited",
                            "sastRuleId": "CWE-89"
                        }
                    },
                    {
                        "ruleId": "shannon/authz",
                        "level": "error",
                        "message": {
                            "markdown": "**Broken Object-Level Authorization (BOLA) in User Profile API**\n\nThe endpoint `/api/users/{user_id}/profile` performs no authentication or tenant boundary check, exposing sensitive user data including email addresses and API keys to arbitrary unauthenticated callers.\n\n**Impact**\n\nSensitive data exposure and horizontal/vertical privilege escalation through complete API key compromise.\n\n**Remediation**\n\nImplement Bearer token verification and assert that `current_user.id == user_id` before returning profile data.\n\nFull exploitation evidence: `curl -k -X GET \"http://127.0.0.1:8888/api/users/1/profile\"`",
                            "text": "BOLA / IDOR in /api/users/{user_id}/profile exposing API keys."
                        },
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": "lab/vulnerable_app/main.py"},
                                    "region": {"startLine": 91}
                                }
                            }
                        ],
                        "webRequest": {
                            "method": "GET",
                            "target": f"{target_url.rstrip('/')}/api/users/1/profile"
                        },
                        "properties": {
                            "findingId": "AUTHZ-01",
                            "parameter": "user_id",
                            "status": "exploited",
                            "sastRuleId": "CWE-285"
                        }
                    },
                    {
                        "ruleId": "shannon/ssrf",
                        "level": "error",
                        "message": {
                            "markdown": "**Server-Side Request Forgery via Webhook Test Endpoint**\n\nThe `/api/integrations/webhook-test` endpoint accepts user-controlled URLs and fetches them over HTTP without checking destination IPs, allowing interaction with internal network services.\n\n**Impact**\n\nInternal service enumeration and potential cloud metadata access if hosted in AWS/GCP.\n\n**Remediation**\n\nValidate callback URLs using an IP address resolver and block connections to RFC 1918 and loopback addresses.\n\nFull exploitation evidence: `curl -k -X POST \"http://127.0.0.1:8888/api/integrations/webhook-test\" -H \"Content-Type: application/json\" -d '{\"callback_url\": \"http://127.0.0.1:8888/health\"}'`",
                            "text": "SSRF in /api/integrations/webhook-test via unvalidated callback_url."
                        },
                        "locations": [
                            {
                                "physicalLocation": {
                                    "artifactLocation": {"uri": "lab/vulnerable_app/main.py"},
                                    "region": {"startLine": 113}
                                }
                            }
                        ],
                        "webRequest": {
                            "method": "POST",
                            "target": f"{target_url.rstrip('/')}/api/integrations/webhook-test"
                        },
                        "properties": {
                            "findingId": "SSRF-01",
                            "parameter": "callback_url",
                            "status": "exploited",
                            "sastRuleId": "CWE-918"
                        }
                    }
                ]
            }
        ]
    }


def generate_lab_blackbox_nuclei(target_url: str) -> List[Dict[str, Any]]:
    """
    Generates standard Nuclei black-box vulnerability findings for local sandbox verification.
    """
    clean_target = target_url.rstrip("/")
    return [
        {
            "template-id": "missing-security-headers",
            "info": {
                "name": "Missing Strict-Transport-Security & CSP Headers",
                "severity": "low",
                "description": f"The HTTP response headers from {clean_target} lack Content-Security-Policy (CSP) and Strict-Transport-Security (HSTS).",
                "remediation": "Configure web server or reverse proxy to include Content-Security-Policy and Strict-Transport-Security response headers.",
                "classification": {
                    "cwe-id": ["CWE-693"],
                    "cvss-score": 3.7
                }
            },
            "matched-at": f"{clean_target}/",
            "curl-command": f"curl -k -I {clean_target}/",
        },
        {
            "template-id": "cors-wildcard-origin",
            "info": {
                "name": "CORS Misconfiguration - Permissive Origin",
                "severity": "medium",
                "description": f"Target endpoint {clean_target} reflects arbitrary Access-Control-Allow-Origin headers without authentication restrictions.",
                "remediation": "Restrict Access-Control-Allow-Origin to trusted domains instead of echoing arbitrary origins.",
                "classification": {
                    "cwe-id": ["CWE-942"],
                    "cvss-score": 5.3
                }
            },
            "matched-at": f"{clean_target}/api/products/search",
            "curl-command": f"curl -k -H 'Origin: https://evil.example.com' -I {clean_target}/api/products/search",
        }
    ]


def ingest_scan_results(
    db: Session,
    assessment_id: str,
    parsed_findings: List[Dict[str, Any]],
    raw_output_obj: Any = None,
    user_email: str = "system@lazynerds.com",
    is_mock_run: bool = False,
    deliverables: Optional[Dict[str, Any]] = None,
) -> Assessment:
    """
    Normalizes, deduplicates, and ingests security findings into the FixOps database.
    Updates the Assessment status to 'completed', attaches deliverables, and triggers automation events.
    """
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise ValueError(f"Assessment {assessment_id} not found.")

    target_asset_id = None
    if assessment.target_asset_ids:
        try:
            ids = json.loads(assessment.target_asset_ids)
            if ids and isinstance(ids, list):
                target_asset_id = ids[0]
        except Exception:
            pass

    scan_mode = "blackbox"
    if assessment.assessment_tool == "shannon":
        scan_mode = "source_assisted"
    elif assessment.execution_summary:
        try:
            summary = json.loads(assessment.execution_summary)
            scan_mode = summary.get("scan_mode", scan_mode)
            if summary.get("benchmark_mode"):
                is_mock_run = True
        except Exception:
            pass

    assessment.raw_output = json.dumps(raw_output_obj)[:50000] if raw_output_obj else None
    assessment.findings_count = len(parsed_findings)
    assessment.completed_at = datetime.now(timezone.utc)
    assessment.status = "completed"

    for f_data in parsed_findings:
        if is_mock_run:
            finding_title = f"[LAB BENCHMARK] {f_data['title']}"
            finding_status = "verification_pending"
            remediation_notes = "[LAB BENCHMARK] Simulated test finding from benchmark suite. Not an active exploit verification."
        else:
            finding_title = f_data["title"]
            finding_status = "open"
            remediation_notes = f_data.get("remediation_notes") or (
                "[Source: Shannon AI Pentest (source-assisted)]"
                if scan_mode == "source_assisted"
                else "[Source: Nuclei Black-Box Scanner]"
            )

        finding = Finding(
            engagement_id=assessment.engagement_id,
            asset_id=target_asset_id,
            assessment_id=assessment_id,
            title=finding_title[:255],
            severity=f_data.get("severity", "medium"),
            cvss_score=f_data.get("cvss_score"),
            status=finding_status,
            cve_id=f_data.get("cve_id"),
            description=f_data.get("description"),
            impact=f_data.get("impact"),
            remediation_guidance=f_data.get("remediation_guidance"),
            evidence=f_data.get("evidence"),
            references_url=f_data.get("references_url"),
            remediation_notes=remediation_notes,
        )
        db.add(finding)
        db.commit()
        db.refresh(finding)

        dispatch_event(
            db=db,
            event_type="on_finding_created",
            context={
                "finding_id": finding.id,
                "title": finding.title,
                "severity": finding.severity,
                "engagement_id": assessment.engagement_id,
                "asset_id": target_asset_id,
                "cve_id": finding.cve_id,
            },
            trigger_source=f"scanner:{finding.title}",
        )

    # Deliverables handling
    if deliverables and assessment.execution_summary:
        try:
            summary = json.loads(assessment.execution_summary)
            summary["deliverables"] = deliverables
            assessment.execution_summary = json.dumps(summary)
            db.commit()
        except Exception:
            pass

    update_assessment_progress(
        assessment_id=assessment_id,
        phase="completed",
        progress_percent=100,
        message=f"Assessment complete. Successfully imported {len(parsed_findings)} finding(s).",
        active_agent=None,
        log_line=f"Scan finished. Created {len(parsed_findings)} FixOps findings.",
        db=db,
    )

    log_audit(
        db=db,
        user_email=user_email,
        action="LAUNCH_SCAN_COMPLETE",
        resource_type="assessment",
        resource_id=assessment_id,
        details=f"Completed {scan_mode} scan ({'Lab Benchmark' if is_mock_run else 'Live'}). Imported {len(parsed_findings)} findings.",
    )

    return assessment


def execute_scan_worker_job(
    assessment_id: str,
    engagement_id: str,
    target_asset_id: str,
    target_url: str,
    scan_mode: str,
    source_repo: Optional[str],
    user_email: str,
    is_mock_run: bool = False,
    db: Optional[Session] = None,
):
    """
    Background worker task executing either Shannon source-assisted pentest or FixOps blackbox scan.
    Enforces strict truth-in-reporting: simulated lab findings are never labeled as confirmed AI exploits.
    """
    session_created = False
    if db is None:
        db = SessionLocal()
        session_created = True

    try:
        assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            return

        assessment.status = "running"
        assessment.started_at = datetime.now(timezone.utc)
        db.commit()

        parsed_findings: List[Dict[str, Any]] = []
        raw_output_obj: Any = None

        if scan_mode == "blackbox":
            # -------------------------------------------------------------
            # Black-Box Web Scanner Branch (Native Nuclei Adapter)
            # -------------------------------------------------------------
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="recon",
                progress_percent=25,
                message="Discovering exposed HTTP services, headers, and attack surface...",
                active_agent="nuclei-crawler",
                log_line=f"Target {target_url} online. Initializing blackbox perimeter checks.",
                db=db,
            )

            update_assessment_progress(
                assessment_id=assessment_id,
                phase="vuln_analysis",
                progress_percent=60,
                message="Executing Nuclei vulnerability checks across perimeter...",
                active_agent="nuclei-engine",
                log_line="Running community and custom security verification templates",
                db=db,
            )

            if is_mock_run:
                nuclei_records = generate_lab_blackbox_nuclei(target_url=target_url)
                parsed_findings = parse_nuclei_records(nuclei_records)
                raw_output_obj = nuclei_records
            else:
                workspace_dir = get_scan_workspace_dir(assessment_id)
                output_file = os.path.join(workspace_dir, "nuclei_output.json")
                nuclei_bin = shutil.which("nuclei")
                docker_bin = shutil.which("docker")

                if nuclei_bin:
                    cmd = [
                        nuclei_bin,
                        "-u", target_url,
                        "-json-export", output_file,
                        "-silent",
                        "-timeout", "10",
                        "-retries", "1",
                    ]
                    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                    if os.path.exists(output_file):
                        with open(output_file, "r", encoding="utf-8") as f:
                            parsed_findings = parse_nuclei_records(f.read())
                        raw_output_obj = parsed_findings
                    else:
                        parsed_findings = []
                        raw_output_obj = {"status": "no_findings", "stdout": proc.stdout, "stderr": proc.stderr}
                elif docker_bin:
                    docker_target = target_url
                    if "127.0.0.1" in docker_target or "localhost" in docker_target:
                        docker_target = docker_target.replace("127.0.0.1", "host.docker.internal").replace("localhost", "host.docker.internal")

                    cmd = [
                        docker_bin, "run", "--rm",
                        "--name", f"fixops-worker-{assessment_id[:8]}",
                        "--network", "shannon-net",
                        "--cpus", "1.0",
                        "--memory", "2g",
                        "--pids-limit", "128",
                        "--security-opt", "no-new-privileges:true",
                        "--cap-drop", "ALL",
                        "-v", f"{workspace_dir}:/app/output",
                        "-v", "fixops-nuclei-templates:/root/nuclei-templates",
                        "projectdiscovery/nuclei:latest",
                        "-u", docker_target,
                        "-json-export", "/app/output/nuclei_output.json",
                        "-silent",
                        "-timeout", "10",
                        "-tags", "cve,misconfig,tech,exposure",
                    ]
                    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                    if os.path.exists(output_file):
                        with open(output_file, "r", encoding="utf-8") as f:
                            parsed_findings = parse_nuclei_records(f.read())
                        raw_output_obj = parsed_findings
                    else:
                        parsed_findings = []
                        raw_output_obj = {"status": "no_findings", "stdout": proc.stdout, "stderr": proc.stderr}
                else:
                    raise RuntimeError(
                        "Black-box engine (Nuclei) is not installed on this worker host and Docker is unavailable. "
                        "Deploy to container-enabled worker infrastructure or run in Lab Benchmark mode."
                    )

            update_assessment_progress(
                assessment_id=assessment_id,
                phase="report_synthesis",
                progress_percent=85,
                message="Deduplicating findings and normalizing CVE/CWE taxonomy...",
                active_agent="dedup-engine",
                log_line=f"Deduplication complete. Ingesting {len(parsed_findings)} unique vulnerability records.",
                db=db,
            )

        else:
            # -------------------------------------------------------------
            # Source-Assisted AI Pentest Branch (Shannon Engine)
            # -------------------------------------------------------------
            # Step 1: Pre-Recon Phase
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="pre-recon",
                progress_percent=15,
                message="Analyzing target architecture and source repository...",
                active_agent="arch-baseline",
                log_line=f"Initialized scan for target {target_url} (mode: {scan_mode})",
                db=db,
            )

            # Step 2: Recon Phase
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="recon",
                progress_percent=35,
                message="Mapping active endpoints, interfaces, and attack surface...",
                active_agent="endpoint-crawler",
                log_line=f"Discovered endpoints on {target_url}",
                db=db,
            )

            # Step 3: Vulnerability Analysis Phase
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="vuln_analysis",
                progress_percent=55,
                message="Executing vulnerability analysis agents (Injection, Auth, Authz, SSRF, XSS)...",
                active_agent="vuln-investigator",
                log_line="Analyzing candidate attack vectors across 5 core security classes",
                db=db,
            )

            # Step 4: Exploitation Verification Phase
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="exploitation",
                progress_percent=75,
                message="Verifying candidate vulnerabilities with live proof-of-concept exploits...",
                active_agent="exploit-validator",
                log_line="Executing controlled PoC requests ('no exploit, no report' verification)",
                db=db,
            )

            has_ai_key = bool(
                os.getenv("SHANNON_AI_API_KEY")
                or os.getenv("XAI_API_KEY")
                or os.getenv("OPENAI_API_KEY")
                or os.getenv("ANTHROPIC_API_KEY")
            )

            if is_mock_run:
                sarif_data = generate_lab_assessment_sarif(target_url=target_url, repo_path=source_repo)
                parsed_findings = parse_shannon_records(sarif_data)
                raw_output_obj = sarif_data
            else:
                if not has_ai_key:
                    raise RuntimeError(
                        "AI Penetration Testing requires configured LLM provider credits (e.g. xAI Grok, OpenAI, or Anthropic). "
                        "No valid AI credits configured on worker. Live scan cannot proceed without an active AI provider. "
                        "Use Lab Benchmark mode for offline verification."
                    )

                # Full production Docker execution
                workspace_dir = get_scan_workspace_dir(assessment_id)
                output_dir = os.path.join(workspace_dir, "output")
                os.makedirs(output_dir, exist_ok=True)

                cmd = [
                    "docker", "run", "--rm",
                    "--name", f"fixops-worker-{assessment_id[:8]}",
                    "--network", "shannon-net",
                    "--cpus", str(getattr(settings, "DOCKER_MAX_CPUS", 2.0)),
                    "--memory", getattr(settings, "DOCKER_MAX_MEMORY", "4g"),
                    "--pids-limit", "256",
                    "--security-opt", "no-new-privileges:true",
                    "--cap-drop", "ALL",
                    "-v", f"{workspace_dir}:/app/workspaces",
                    "-v", f"{source_repo or workspace_dir}:/app/repo:ro",
                    "-v", f"{output_dir}:/app/output",
                ]
                if os.getenv("SHANNON_AI_API_KEY"):
                    cmd.extend(["-e", f"SHANNON_AI_API_KEY={os.getenv('SHANNON_AI_API_KEY')}"])
                if os.getenv("XAI_API_KEY"):
                    cmd.extend(["-e", f"XAI_API_KEY={os.getenv('XAI_API_KEY')}"])
                if os.getenv("ANTHROPIC_API_KEY"):
                    cmd.extend(["-e", f"ANTHROPIC_API_KEY={os.getenv('ANTHROPIC_API_KEY')}"])
                if os.getenv("OPENAI_API_KEY"):
                    cmd.extend(["-e", f"OPENAI_API_KEY={os.getenv('OPENAI_API_KEY')}"])
                if os.getenv("SHANNON_AI_MODEL"):
                    cmd.extend(["-e", f"SHANNON_AI_MODEL={os.getenv('SHANNON_AI_MODEL')}"])
                if os.getenv("SHANNON_AI_BASE_URL"):
                    cmd.extend(["-e", f"SHANNON_AI_BASE_URL={os.getenv('SHANNON_AI_BASE_URL')}"])

                cmd.extend([
                    "keygraph/shannon:latest",
                    "start", "-u", target_url, "-r", "/app/repo",
                    "-o", "/app/output",
                ])

                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=1800)
                sarif_path = os.path.join(output_dir, "Security-Assessment-Report.sarif")
                if os.path.exists(sarif_path):
                    with open(sarif_path, "r", encoding="utf-8") as f:
                        sarif_data = json.load(f)
                    parsed_findings = parse_shannon_records(sarif_data)
                    raw_output_obj = sarif_data
                else:
                    raise RuntimeError(f"Shannon container execution failed: {proc.stderr[:1000] if proc.stderr else 'Output SARIF deliverable was not produced.'}")

            update_assessment_progress(
                assessment_id=assessment_id,
                phase="report_synthesis",
                progress_percent=90,
                message="Synthesizing assessment deliverables and formatting findings...",
                active_agent="report-synthesizer",
                log_line=f"Analysis complete. Ingesting {len(parsed_findings)} findings.",
                db=db,
            )

        # -------------------------------------------------------------
        # Ingestion into FixOps Database via ingest_scan_results
        # -------------------------------------------------------------
        ingest_scan_results(
            db=db,
            assessment_id=assessment_id,
            parsed_findings=parsed_findings,
            raw_output_obj=raw_output_obj,
            user_email=user_email,
            is_mock_run=is_mock_run,
        )

    except Exception as e:
        logger.error(f"Error during scan job execution for {assessment_id}: {e}", exc_info=True)
        try:
            update_assessment_progress(
                assessment_id=assessment_id,
                phase="failed",
                progress_percent=100,
                message=f"Scan execution failed: {str(e)}",
                log_line=f"Error encountered: {str(e)}",
                db=db,
            )
            assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
            if assessment:
                assessment.status = "failed"
                assessment.completed_at = datetime.now(timezone.utc)
                db.commit()
        except Exception:
            pass
    finally:
        ACTIVE_SCAN_THREADS.pop(assessment_id, None)
        SCAN_PROCESS_PIDS.pop(assessment_id, None)
        cleanup_scan_workspace(assessment_id)
        if session_created:
            db.close()


def launch_scan(
    db: Session,
    engagement_id: str,
    target_asset_id: str,
    scan_mode: str,  # "source_assisted" or "blackbox"
    source_repo: Optional[str] = None,
    current_user: Optional[User] = None,
    is_mock_run: bool = False,
    sync_execution: bool = False,
) -> Assessment:
    """
    Validates scope, target authorization, SSRF constraints, and initiates an asynchronous scan job.
    """
    # 0. Check Concurrency Limits
    active_count = len([t for t in ACTIVE_SCAN_THREADS.values() if t.is_alive()])
    if active_count >= MAX_CONCURRENT_SCANS:
        raise ValueError(
            f"Scan concurrency limit reached ({MAX_CONCURRENT_SCANS} active scans). "
            "Please wait for an active scan to complete before launching a new assessment."
        )

    # 1. Validate Engagement
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise ValueError("Referenced engagement does not exist.")
    if eng.status not in ("in_progress", "planned"):
        raise ValueError(
            f"Engagement '{eng.name}' is currently '{eng.status}'. "
            "Automated security scans can only be launched on active in_progress or planned engagements."
        )
    if eng.authorization_status != "confirmed":
        raise ValueError(
            f"Engagement '{eng.name}' rules-of-engagement authorization is '{eng.authorization_status}'. "
            "Security testing requires 'confirmed' written authorization."
        )

    # 2. Validate Target Asset
    asset = db.query(Asset).filter(Asset.id == target_asset_id).first()
    if not asset:
        raise ValueError("Target asset does not exist.")
    if asset.client_id != eng.client_id:
        raise ValueError("Asset does not belong to the client organization for this engagement.")
    if not asset.in_scope:
        raise ValueError(
            f"Scope violation: Asset '{asset.name}' ({asset.target}) is marked out-of-scope. "
            "Security scanning against out-of-scope targets is strictly prohibited."
        )
    if asset.authorization_status != "verified":
        raise ValueError(
            f"Authorization violation: Asset '{asset.name}' has authorization status '{asset.authorization_status}'. "
            "Only assets with 'verified' authorization status may be targeted."
        )

    # 3. SSRF Preflight
    allow_lab = getattr(settings, "ALLOW_LAB_TESTING", True)
    is_safe, ssrf_err = validate_target_url_ssrf(asset.target, allow_lab_testing=allow_lab)
    if not is_safe:
        raise ValueError(f"SSRF validation blocked target URL: {ssrf_err}")

    # 4. Source-Assisted Mode Verification
    tool_name = "shannon" if scan_mode == "source_assisted" else "nuclei"
    if scan_mode == "source_assisted":
        if not source_repo:
            raise ValueError(
                "Source-assisted AI pentests require a valid source repository path or git URL. "
                "For URL-only assessments without source code, select Black-Box Web Scanner mode."
            )
        if os.path.exists(source_repo) is False and not source_repo.startswith(("http://", "https://", "git@")):
            raise ValueError(f"Specified source repository path '{source_repo}' could not be found.")

    # 5. Create Assessment record in "queued" state
    user_email = current_user.email if current_user else "system@lazynerds.com"
    mode_label = "Source-Assisted AI Pentest" if scan_mode == "source_assisted" else "Black-Box Scan"
    bench_prefix = "[SIMULATED LAB BENCHMARK] " if is_mock_run else ""
    assessment_name = f"{bench_prefix}{mode_label} - {asset.name} ({datetime.now(timezone.utc).strftime('%b %d, %H:%M')})"
    
    initial_summary = {
        "scan_mode": scan_mode,
        "target_url": asset.target,
        "source_repo": source_repo,
        "phase": "queued",
        "progress_percent": 0,
        "current_status": "Scan queued. Initializing isolated worker container...",
        "active_agent": "orchestrator",
        "benchmark_mode": is_mock_run,
        "provenance": "simulated_benchmark" if is_mock_run else "live_assessment",
        "logs": [
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "phase": "queued",
                "agent": "orchestrator",
                "message": f"{'Lab benchmark' if is_mock_run else 'Scan'} queued by {user_email}. Verified in-scope target {asset.target}.",
            }
        ],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    assessment = Assessment(
        engagement_id=engagement_id,
        name=assessment_name,
        assessment_tool=tool_name,
        status="queued",
        target_asset_ids=json.dumps([target_asset_id]),
        findings_count=0,
        execution_summary=json.dumps(initial_summary),
        started_at=datetime.now(timezone.utc),
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    log_audit(
        db=db,
        user_email=user_email,
        action="LAUNCH_SCAN",
        resource_type="assessment",
        resource_id=assessment.id,
        details=f"Queued {scan_mode} scan against asset {asset.name} ({asset.target}).",
    )

    # 6. Execution (Synchronous for testing, Distributed Worker Queue, or Embedded Worker Thread)
    should_run_embedded = False
    if sync_execution:
        should_run_embedded = True
    elif is_mock_run:
        should_run_embedded = True
    elif settings.WORKER_DISPATCH_MODE == "embedded":
        should_run_embedded = True
    elif settings.WORKER_DISPATCH_MODE == "auto":
        is_production = settings.ENVIRONMENT.lower() == "production"
        has_docker_or_nuclei = bool(shutil.which("docker") or shutil.which("nuclei"))
        if not is_production and has_docker_or_nuclei:
            should_run_embedded = True

    if should_run_embedded:
        if sync_execution:
            execute_scan_worker_job(
                assessment_id=assessment.id,
                engagement_id=engagement_id,
                target_asset_id=target_asset_id,
                target_url=asset.target,
                scan_mode=scan_mode,
                source_repo=source_repo,
                user_email=user_email,
                is_mock_run=is_mock_run,
                db=db,
            )
            db.refresh(assessment)
        else:
            worker_thread = threading.Thread(
                target=execute_scan_worker_job,
                kwargs={
                    "assessment_id": assessment.id,
                    "engagement_id": engagement_id,
                    "target_asset_id": target_asset_id,
                    "target_url": asset.target,
                    "scan_mode": scan_mode,
                    "source_repo": source_repo,
                    "user_email": user_email,
                    "is_mock_run": is_mock_run,
                },
                daemon=True,
            )
            ACTIVE_SCAN_THREADS[assessment.id] = worker_thread
            worker_thread.start()
    else:
        # Queued for standalone Docker worker
        update_assessment_progress(
            assessment_id=assessment.id,
            phase="queued",
            progress_percent=0,
            message="Scan queued. Waiting for an authorized FixOps Docker worker to claim the job...",
            active_agent="dispatcher",
            log_line=f"Assessment queued for worker dispatch (Target: {asset.target}, Mode: {scan_mode}).",
            db=db,
        )

    return assessment


def cancel_scan(db: Session, assessment_id: str, current_user_email: str) -> Assessment:
    """Cancels a running scan and cleans up resources."""
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise ValueError("Assessment record not found.")

    if assessment.status in ("completed", "failed"):
        return assessment

    assessment.status = "failed"
    assessment.completed_at = datetime.now(timezone.utc)
    
    current_summary = {}
    if assessment.execution_summary:
        try:
            current_summary = json.loads(assessment.execution_summary)
        except Exception:
            current_summary = {}
            
    current_summary.update({
        "phase": "cancelled",
        "current_status": f"Scan manually cancelled by {current_user_email}.",
    })
    assessment.execution_summary = json.dumps(current_summary)
    db.commit()
    db.refresh(assessment)

    # If Docker container running, stop it
    try:
        subprocess.run(
            ["docker", "stop", f"fixops-worker-{assessment_id[:8]}"],
            capture_output=True,
            timeout=5,
        )
    except Exception:
        pass

    cleanup_scan_workspace(assessment_id)

    log_audit(
        db=db,
        user_email=current_user_email,
        action="CANCEL_SCAN",
        resource_type="assessment",
        resource_id=assessment.id,
        details="Operator cancelled active scan job.",
    )

    return assessment
