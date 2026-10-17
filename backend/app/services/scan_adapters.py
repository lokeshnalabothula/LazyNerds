import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.finding import Assessment, Finding
from app.models.asset import Asset
from app.models.engagement import Engagement
from app.services.automation_engine import dispatch_event
from app.services.audit_service import log_audit

logger = logging.getLogger("fixops.adapters")


def normalize_severity(raw_severity: str) -> str:
    s = (raw_severity or "").strip().lower()
    if s in ("critical", "crit"):
        return "critical"
    elif s in ("high", "h"):
        return "high"
    elif s in ("medium", "med", "moderate"):
        return "medium"
    elif s in ("low", "l"):
        return "low"
    return "info"


def parse_nuclei_records(scan_data: Any) -> List[Dict[str, Any]]:
    """Parses Nuclei JSON array or newline-delimited JSON output."""
    items = []
    if isinstance(scan_data, str):
        lines = [line.strip() for line in scan_data.strip().splitlines() if line.strip()]
        for line in lines:
            try:
                item = json.loads(line)
                if isinstance(item, dict):
                    items.append(item)
            except Exception:
                continue
    elif isinstance(scan_data, list):
        items = scan_data
    elif isinstance(scan_data, dict):
        items = [scan_data]

    findings = []
    for item in items:
        info = item.get("info", {})
        title = info.get("name") or item.get("template-id") or "Unclassified Vulnerability"
        severity = normalize_severity(info.get("severity", "info"))
        
        classification = info.get("classification", {})
        cve_id = None
        if isinstance(classification, dict):
            cve_id = classification.get("cve-id")
            if isinstance(cve_id, list) and cve_id:
                cve_id = cve_id[0]

        cvss_score = None
        if isinstance(classification, dict) and "cvss-score" in classification:
            try:
                cvss_score = float(classification["cvss-score"])
            except (ValueError, TypeError):
                pass

        matched_at = item.get("matched-at") or item.get("host")
        curl_cmd = item.get("curl-command")
        evidence = f"Matched Target: {matched_at}"
        if curl_cmd:
            evidence += f"\nReplication: {curl_cmd}"

        refs = info.get("reference")
        ref_url = None
        if isinstance(refs, list) and refs:
            ref_url = str(refs[0])
        elif isinstance(refs, str):
            ref_url = refs

        findings.append({
            "title": str(title)[:255],
            "severity": severity,
            "cvss_score": cvss_score,
            "cve_id": str(cve_id)[:100] if cve_id else None,
            "description": info.get("description"),
            "impact": f"Allows attackers to exploit {title} against {matched_at or 'target'}",
            "remediation_guidance": info.get("remediation"),
            "evidence": evidence,
            "references_url": ref_url,
        })
    return findings


def parse_nmap_records(scan_data: Any) -> List[Dict[str, Any]]:
    """Parses structured port scan/service detection results."""
    items = []
    if isinstance(scan_data, str):
        try:
            items = json.loads(scan_data)
        except Exception:
            return []
    elif isinstance(scan_data, list):
        items = scan_data
    elif isinstance(scan_data, dict):
        items = [scan_data]

    findings = []
    for item in items:
        port = item.get("port")
        service = item.get("service", "unknown")
        state = item.get("state", "open")
        title = f"Exposed Service: {service} on port {port}/{item.get('protocol', 'tcp')}"
        
        findings.append({
            "title": title[:255],
            "severity": "low" if state == "open" else "info",
            "cvss_score": 3.5 if state == "open" else 0.0,
            "description": f"Port {port} running {service} was detected in an {state} state.",
            "impact": "Exposed services increase the attack surface and may be subject to unauthorized enumeration.",
            "remediation_guidance": f"Restrict access to port {port} via firewall or bind service to localhost if not required externally.",
            "evidence": json.dumps(item),
        })
    return findings


def parse_generic_records(scan_data: Any) -> List[Dict[str, Any]]:
    items = []
    if isinstance(scan_data, str):
        try:
            parsed = json.loads(scan_data)
            items = parsed if isinstance(parsed, list) else [parsed]
        except Exception:
            return [{
                "title": "Manual Assessment Finding",
                "severity": "medium",
                "description": scan_data[:1000],
            }]
    elif isinstance(scan_data, list):
        items = scan_data
    elif isinstance(scan_data, dict):
        items = [scan_data]

    findings = []
    for item in items:
        findings.append({
            "title": str(item.get("title", "Discovered Vulnerability"))[:255],
            "severity": normalize_severity(item.get("severity", "medium")),
            "cvss_score": float(item["cvss_score"]) if item.get("cvss_score") is not None else None,
            "cve_id": str(item.get("cve_id"))[:100] if item.get("cve_id") else None,
            "description": item.get("description"),
            "impact": item.get("impact"),
            "remediation_guidance": item.get("remediation_guidance") or item.get("remediation"),
            "evidence": item.get("evidence"),
            "references_url": item.get("references_url"),
        })
    return findings


def run_or_import_scan(
    db: Session,
    engagement_id: str,
    tool_name: str,
    scan_data: Any,
    target_asset_id: Optional[str] = None,
    auto_create_findings: bool = True,
    current_user_email: Optional[str] = None,
) -> Assessment:
    # 1. Validate engagement exists
    eng = db.query(Engagement).filter(Engagement.id == engagement_id).first()
    if not eng:
        raise ValueError("Referenced engagement does not exist.")

    # 2. Strict Scope Enforcement: Target asset must be in_scope
    if target_asset_id:
        asset = db.query(Asset).filter(Asset.id == target_asset_id).first()
        if not asset:
            raise ValueError("Target asset does not exist.")
        if not asset.in_scope:
            raise ValueError(
                f"Scope violation: Asset '{asset.name}' is marked out-of-scope. "
                "Assessments and scans against out-of-scope targets are strictly prohibited."
            )
        if asset.authorization_status == "unauthorized":
            raise ValueError(
                f"Authorization violation: Asset '{asset.name}' authorization is unauthorized."
            )

    tool_lower = tool_name.strip().lower()
    if "nuclei" in tool_lower:
        parsed_findings = parse_nuclei_records(scan_data)
    elif "nmap" in tool_lower:
        parsed_findings = parse_nmap_records(scan_data)
    else:
        parsed_findings = parse_generic_records(scan_data)

    assessment = Assessment(
        engagement_id=engagement_id,
        name=f"{tool_name.upper()} Assessment - {datetime.now(timezone.utc).strftime('%b %d, %Y %H:%M')}",
        assessment_tool=tool_name,
        status="completed",
        target_asset_ids=json.dumps([target_asset_id]) if target_asset_id else None,
        findings_count=len(parsed_findings),
        execution_summary=f"Successfully imported {len(parsed_findings)} finding(s) via {tool_name} adapter.",
        raw_output=str(scan_data)[:5000] if scan_data else None,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)

    if auto_create_findings:
        for f_data in parsed_findings:
            finding = Finding(
                engagement_id=engagement_id,
                asset_id=target_asset_id,
                assessment_id=assessment.id,
                title=f_data["title"],
                severity=f_data["severity"],
                cvss_score=f_data.get("cvss_score"),
                status="open",
                cve_id=f_data.get("cve_id"),
                description=f_data.get("description"),
                impact=f_data.get("impact"),
                remediation_guidance=f_data.get("remediation_guidance"),
                evidence=f_data.get("evidence"),
                references_url=f_data.get("references_url"),
            )
            db.add(finding)
            db.commit()
            db.refresh(finding)

            # Trigger automation event
            dispatch_event(
                db=db,
                event_type="on_finding_created",
                context={
                    "finding_id": finding.id,
                    "title": finding.title,
                    "severity": finding.severity,
                    "engagement_id": engagement_id,
                    "asset_id": target_asset_id,
                    "cve_id": finding.cve_id,
                },
                trigger_source=f"finding:{finding.title}",
            )

    if current_user_email:
        log_audit(
            db=db,
            user_email=current_user_email,
            action="RUN_SCAN_ADAPTER",
            resource_type="assessment",
            resource_id=assessment.id,
            details=f"Executed/imported {tool_name} scan. Created {len(parsed_findings)} findings.",
        )

    return assessment
