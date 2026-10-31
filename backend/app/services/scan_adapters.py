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
    """
    Parses Nuclei JSON array or newline-delimited JSON output.
    Performs deduplication based on (title, matched_at, cve_id/cwe_id) to eliminate duplicate matches.
    """
    items = []
    if isinstance(scan_data, str):
        trimmed = scan_data.strip()
        try:
            parsed = json.loads(trimmed)
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                items = [parsed]
        except Exception:
            # Fall back to parsing as JSONL (newline-delimited JSON)
            lines = [line.strip() for line in trimmed.splitlines() if line.strip()]
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
    seen_dedup_keys = set()

    for item in items:
        info = item.get("info", {})
        title = info.get("name") or item.get("template-id") or "Unclassified Vulnerability"
        severity = normalize_severity(info.get("severity", "info"))
        
        classification = info.get("classification", {})
        cve_id = None
        cwe_id = None
        if isinstance(classification, dict):
            cve_id = classification.get("cve-id")
            if isinstance(cve_id, list) and cve_id:
                cve_id = cve_id[0]
            
            cwe_id = classification.get("cwe-id")
            if isinstance(cwe_id, list) and cwe_id:
                cwe_id = cwe_id[0]

        ref_id = cve_id or cwe_id

        cvss_score = None
        if isinstance(classification, dict) and "cvss-score" in classification:
            try:
                cvss_score = float(classification["cvss-score"])
            except (ValueError, TypeError):
                pass

        matched_at = item.get("matched-at") or item.get("host") or ""
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

        # Deduplication key based on title, matched target/URL, and CVE/CWE
        dedup_key = (str(title).strip().lower(), str(matched_at).strip().lower(), str(ref_id or "").strip().lower())
        if dedup_key in seen_dedup_keys:
            continue
        seen_dedup_keys.add(dedup_key)

        findings.append({
            "title": str(title)[:255],
            "severity": severity,
            "cvss_score": cvss_score,
            "cve_id": str(ref_id)[:100] if ref_id else None,
            "description": info.get("description"),
            "impact": f"Allows attackers to exploit {title} against {matched_at or 'target'}",
            "remediation_guidance": info.get("remediation"),
            "evidence": evidence,
            "references_url": ref_url,
            "remediation_notes": "[Source: Nuclei Black-Box Scanner]",
        })
    return findings


def parse_shannon_sarif(scan_data: Any) -> List[Dict[str, Any]]:
    """
    Parses Shannon SARIF 2.1.0 output into FixOps findings.
    Extracts proof-of-concept evidence, impacted code locations, CWE/OWASP taxonomy,
    and remediation instructions.
    """
    if isinstance(scan_data, str):
        try:
            scan_data = json.loads(scan_data)
        except Exception:
            return []

    if not isinstance(scan_data, dict):
        return []

    runs = scan_data.get("runs", [])
    if not runs or not isinstance(runs, list):
        return []

    run = runs[0]
    rules_map = {}
    driver = run.get("tool", {}).get("driver", {})
    for rule in driver.get("rules", []):
        r_id = rule.get("id")
        if r_id:
            rules_map[r_id] = rule

    findings = []
    for item in run.get("results", []):
        rule_id = item.get("ruleId", "shannon/vulnerability")
        rule_info = rules_map.get(rule_id, {})
        props = item.get("properties", {})
        msg_obj = item.get("message", {})
        markdown_msg = msg_obj.get("markdown", "")
        text_msg = msg_obj.get("text", "")

        # Extract title from markdown heading or rule name
        title = None
        if markdown_msg and markdown_msg.startswith("**"):
            end_idx = markdown_msg.find("**", 2)
            if end_idx != -1:
                title = markdown_msg[2:end_idx].strip()
        if not title:
            title = rule_info.get("name") or props.get("findingId") or f"Shannon finding ({rule_id})"

        # Severity mapping
        level = item.get("level", "error")
        rule_lower = rule_id.lower()
        if level == "error":
            severity = "critical" if ("injection" in rule_lower or "ssrf" in rule_lower) else "high"
        elif level == "warning":
            severity = "medium"
        else:
            severity = "low"

        # Extract Impact & Remediation sections from markdown if present
        impact = None
        remediation = None
        if markdown_msg:
            if "**Impact**" in markdown_msg:
                parts = markdown_msg.split("**Impact**", 1)
                after_impact = parts[1]
                if "**Remediation**" in after_impact:
                    impact_text, rem_text = after_impact.split("**Remediation**", 1)
                    impact = impact_text.strip().lstrip("\n")
                    remediation = rem_text.split("\n\nFull exploitation evidence:")[0].strip().lstrip("\n")
                else:
                    impact = after_impact.strip()
            elif "**Remediation**" in markdown_msg:
                remediation = markdown_msg.split("**Remediation**", 1)[1].split("\n\nFull exploitation evidence:")[0].strip()

        if not remediation and "help" in rule_info:
            remediation = rule_info["help"].get("text")
        if not impact:
            impact = f"Exploitation of {title} compromises application integrity and confidentiality."

        # Locations and WebRequest evidence
        evidence_lines = []
        status = props.get("status")
        if status:
            evidence_lines.append(f"Status: {status.upper()}")
        finding_id = props.get("findingId")
        if finding_id:
            evidence_lines.append(f"Finding Identifier: {finding_id}")

        locations = item.get("locations", [])
        if locations:
            loc = locations[0].get("physicalLocation", {})
            uri = loc.get("artifactLocation", {}).get("uri")
            line = loc.get("region", {}).get("startLine")
            if uri:
                loc_str = f"Source Code Location: {uri}"
                if line:
                    loc_str += f":{line}"
                evidence_lines.append(loc_str)

        web_req = item.get("webRequest", {})
        if web_req:
            method = web_req.get("method", "GET")
            target = web_req.get("target", "")
            evidence_lines.append(f"HTTP Probe: {method} {target}")

        cwe = props.get("sastRuleId")
        cve_id = cwe if cwe else None

        evidence = "\n".join(evidence_lines)
        if text_msg and not markdown_msg:
            description = text_msg
        else:
            description = markdown_msg or text_msg

        findings.append({
            "title": str(title)[:255],
            "severity": severity,
            "cvss_score": 9.0 if severity == "critical" else (7.5 if severity == "high" else 5.0),
            "cve_id": str(cve_id)[:100] if cve_id else None,
            "description": description[:3000] if description else None,
            "impact": impact[:2000] if impact else None,
            "remediation_guidance": remediation[:2000] if remediation else None,
            "evidence": evidence[:4000] if evidence else None,
            "references_url": "https://github.com/KeygraphHQ/shannon",
            "remediation_notes": "[Source: Shannon AI Pentest (source-assisted)]",
        })

    return findings


def parse_shannon_json(scan_data: Any) -> List[Dict[str, Any]]:
    """
    Parses Shannon structured Typst report JSON (exploitFindings) into FixOps findings.
    """
    if isinstance(scan_data, str):
        try:
            scan_data = json.loads(scan_data)
        except Exception:
            return []

    if not isinstance(scan_data, dict):
        return []

    exploit_findings = scan_data.get("exploitFindings", [])
    if not exploit_findings:
        exploit_findings = scan_data.get("findings", [])

    findings = []
    for item in exploit_findings:
        title = item.get("title") or item.get("id") or "Exploited Vulnerability"
        raw_sev = (item.get("severity") or "medium").lower()
        severity = normalize_severity(raw_sev)
        
        summary = item.get("summary", {})
        if isinstance(summary, dict):
            overview = summary.get("overview", "")
            impact = summary.get("impact", "")
            vuln_loc = summary.get("vulnerableLocation", "")
        else:
            overview = str(summary)
            impact = item.get("impact", "")
            vuln_loc = ""

        remediation = item.get("remediation")
        steps = item.get("exploitationSteps", [])
        evidence_lines = []
        if vuln_loc:
            evidence_lines.append(f"Vulnerable Location: {vuln_loc}")

        for s in steps:
            step_no = s.get("number", "")
            step_title = s.get("title", "")
            evidence_lines.append(f"Step {step_no}: {step_title}")
            for itm in s.get("items", []):
                if itm.get("kind") == "code" and "block" in itm:
                    blk = itm["block"]
                    evidence_lines.append(f"```{blk.get('language', '')}\n{blk.get('content', '')}\n```")
                elif itm.get("kind") == "prose":
                    evidence_lines.append(itm.get("text", ""))

        cve_id = item.get("owaspCategory")

        findings.append({
            "title": str(title)[:255],
            "severity": severity,
            "cvss_score": 9.5 if severity == "critical" else (8.0 if severity == "high" else 5.5),
            "cve_id": str(cve_id)[:100] if cve_id else None,
            "description": overview[:3000] if overview else None,
            "impact": impact[:2000] if impact else None,
            "remediation_guidance": remediation[:2000] if remediation else None,
            "evidence": "\n".join(evidence_lines)[:4000] if evidence_lines else None,
            "references_url": "https://github.com/KeygraphHQ/shannon",
            "remediation_notes": "[Source: Shannon AI Pentest (source-assisted)]",
        })

    return findings


def parse_shannon_records(scan_data: Any) -> List[Dict[str, Any]]:
    """
    Intelligently routes Shannon output: SARIF 2.1.0 or structured JSON report.
    """
    if isinstance(scan_data, str):
        try:
            parsed = json.loads(scan_data)
            scan_data = parsed
        except Exception:
            return parse_generic_records(scan_data)

    if isinstance(scan_data, dict):
        if "runs" in scan_data:
            return parse_shannon_sarif(scan_data)
        if "exploitFindings" in scan_data or "findings" in scan_data:
            return parse_shannon_json(scan_data)

    return parse_generic_records(scan_data)


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
    if eng.status in ("completed", "cancelled"):
        raise ValueError(f"Cannot import scans into an engagement in '{eng.status}' status.")

    # 2. Strict Scope Enforcement: Target asset must be in_scope and belong to the engagement client
    if target_asset_id:
        asset = db.query(Asset).filter(Asset.id == target_asset_id).first()
        if not asset:
            raise ValueError("Target asset does not exist.")
        if asset.client_id != eng.client_id:
            raise ValueError("Target asset does not belong to the referenced engagement's client.")
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
    if "shannon" in tool_lower:
        parsed_findings = parse_shannon_records(scan_data)
    elif "nuclei" in tool_lower:
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

    created_findings = []
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
            created_findings.append(finding)
        db.commit()

        for finding in created_findings:
            db.refresh(finding)
            # Trigger automation event
            try:
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
            except Exception as ev_err:
                logger.warning(f"Failed to dispatch automation event for finding {finding.id}: {ev_err}")

    if current_user_email:
        log_audit(
            db=db,
            organization_id=eng.organization_id,
            user_email=current_user_email,
            action="RUN_SCAN_ADAPTER",
            resource_type="assessment",
            resource_id=assessment.id,
            details=f"Executed/imported {tool_name} scan. Created {len(parsed_findings)} findings.",
        )

    return assessment
