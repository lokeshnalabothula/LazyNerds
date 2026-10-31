import hashlib
import hmac
import ipaddress
import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Tuple
import dns.exception
import dns.resolver
from fastapi import HTTPException, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.domain import Domain
from app.models.user import User
from app.schemas.domain import (
    DnsRecordInstructions,
    DomainOut,
    FileRecordInstructions,
    MetaRecordInstructions,
)
from app.services.audit_service import log_audit
from app.core.security import (
    validate_target_url_ssrf,
    is_lab_testing_authorized,
    create_domain_verification_proof,
    verify_domain_verification_proof,
    safe_http_fetch,
    sanitize_assessment_error,
)
import httpx

RECORD_NAME_PREFIX = "_lazynerds-verification"
RECORD_VALUE_PREFIX = "lazynerds-verification="
TOKEN_EXPIRATION_HOURS = 24
RATE_LIMIT_SECONDS = 5
MAX_VERIFICATION_ATTEMPTS = 50


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def generate_verification_token() -> str:
    """Generates a high-entropy 256-bit cryptographically secure token."""
    return secrets.token_urlsafe(32)


def hash_verification_token(token: str) -> str:
    """Computes SHA-256 hash of the verification token for safe database storage."""
    return hashlib.sha256(token.strip().encode("utf-8")).hexdigest()


def build_dns_instructions(domain_name: str, token: Optional[str] = None) -> DnsRecordInstructions:
    """Builds DNS TXT record configuration instructions for customer DNS management."""
    record_name = f"{RECORD_NAME_PREFIX}.{domain_name}"
    record_value = f"{RECORD_VALUE_PREFIX}{token}" if token else None
    return DnsRecordInstructions(
        record_type="TXT",
        record_name=record_name,
        record_host=RECORD_NAME_PREFIX,
        record_value=record_value,
        expected_format=f"{RECORD_VALUE_PREFIX}<generated-token>",
        ttl=300,
    )


def build_file_instructions(domain_name: str, token: str) -> FileRecordInstructions:
    """Builds HTML file upload instructions for web root verification."""
    return FileRecordInstructions(
        file_name="fixops-verification.txt",
        relative_path="/.well-known/fixops-verification.txt",
        fallback_path="/fixops-verification.txt",
        expected_content=f"{RECORD_VALUE_PREFIX}{token}",
    )


def build_meta_instructions(domain_name: str, token: str) -> MetaRecordInstructions:
    """Builds HTML meta tag instructions for homepage embedding."""
    return MetaRecordInstructions(
        meta_tag="fixops-verification",
        snippet=f'<meta name="fixops-verification" content="{token}" />',
    )


def domain_to_out(domain: Domain, token: Optional[str] = None) -> DomainOut:
    """Converts a Domain ORM object to DomainOut schema, including DNS instructions."""
    instructions = build_dns_instructions(domain.normalized_domain, token)
    return DomainOut(
        id=domain.id,
        client_id=domain.client_id,
        domain=domain.domain,
        normalized_domain=domain.normalized_domain,
        verification_status=domain.verification_status,
        challenge_created_at=domain.challenge_created_at,
        challenge_expires_at=domain.challenge_expires_at,
        verified_at=domain.verified_at,
        last_verification_attempt_at=domain.last_verification_attempt_at,
        verification_attempt_count=domain.verification_attempt_count,
        failure_reason=domain.failure_reason,
        created_at=domain.created_at,
        updated_at=domain.updated_at,
        dns_instructions=instructions,
    )


def validate_and_normalize_domain(raw_domain: str) -> Tuple[bool, str, str]:
    """
    Validates domain syntax and normalizes to canonical lowercase ASCII/punycode format.
    Rejects URLs, paths, ports, schemes, query parameters, user credentials, IP addresses,
    and malformed labels according to RFC 1035 / RFC 1123.
    """
    if not raw_domain or not isinstance(raw_domain, str):
        return False, "", "Domain must be a non-empty string."

    trimmed = raw_domain.strip()
    if not trimmed:
        return False, "", "Domain cannot be empty or whitespace."

    # Reject URLs / schemes
    if "://" in trimmed or trimmed.lower().startswith(("http:", "https:", "ftp:", "ws:", "wss:")):
        return False, "", "Invalid domain: URLs and protocol schemes are not allowed. Provide only a domain name (e.g. example.com)."

    # Reject paths, queries, fragments
    if "/" in trimmed or "\\" in trimmed:
        return False, "", "Invalid domain: Paths are not allowed. Provide only a domain name."
    if "?" in trimmed or "#" in trimmed:
        return False, "", "Invalid domain: Query parameters and fragments are not allowed."

    # Reject IP addresses (IPv4 & IPv6)
    try:
        ipaddress.ip_address(trimmed.strip("[]"))
        return False, "", "Invalid domain: IP addresses are not supported. Only domain names can be verified."
    except ValueError:
        pass

    # Check for direct IPv4 pattern even if not strictly parsed
    if re.match(r"^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$", trimmed):
        return False, "", "Invalid domain: IP addresses are not supported."

    # Reject ports
    if ":" in trimmed:
        return False, "", "Invalid domain: Port numbers are not allowed."

    # Reject user credentials / email format
    if "@" in trimmed:
        return False, "", "Invalid domain: Email addresses and user credentials are not allowed."

    # Normalize trailing dots and case
    normalized = trimmed.rstrip(".").lower()

    # Total length constraint per RFC 1035
    if len(normalized) < 3 or len(normalized) > 253:
        return False, "", f"Invalid domain length ({len(normalized)}). Must be between 3 and 253 characters."

    labels = normalized.split(".")
    if len(labels) < 2:
        return False, "", "Invalid domain: Must include at least a domain name and a top-level domain (e.g. example.com)."

    for idx, label in enumerate(labels):
        if not label:
            return False, "", "Invalid domain: Empty label (consecutive dots are not allowed)."
        if len(label) > 63:
            return False, "", f"Invalid domain label '{label}': exceeds maximum length of 63 characters."
        if label.startswith("-") or label.endswith("-"):
            return False, "", f"Invalid domain label '{label}': cannot start or end with a hyphen."

        # Check label characters: alphanumeric and hyphen only (or IDN punycode)
        try:
            ascii_label = label.encode("idna").decode("ascii")
        except Exception:
            return False, "", f"Invalid domain label '{label}': contains invalid characters."

        if not re.match(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", ascii_label):
            return False, "", f"Invalid domain label '{label}': contains disallowed characters."

    # TLD (last label) checks: at least 2 characters, cannot be purely numeric
    tld = labels[-1]
    if len(tld) < 2:
        return False, "", f"Invalid top-level domain '{tld}': must be at least 2 characters."
    if tld.isdigit():
        return False, "", f"Invalid top-level domain '{tld}': TLD cannot be purely numeric."

    return True, normalized, ""


def resolve_dns_txt(normalized_domain: str, timeout: float = 5.0) -> Tuple[List[str], Optional[str]]:
    """
    Performs real DNS TXT resolution for _lazynerds-verification.{normalized_domain}.
    Correctly reconstructs split TXT strings per RFC 1035.
    Returns (txt_records, error_detail).
    """
    query_target = f"{RECORD_NAME_PREFIX}.{normalized_domain}"
    resolver = dns.resolver.Resolver()
    resolver.timeout = timeout
    resolver.lifetime = timeout

    try:
        answers = resolver.resolve(query_target, "TXT")
        records = []
        for rdata in answers:
            # RFC 1035 split string concatenation: TXT payload consists of one or more byte strings
            chunk_bytes = getattr(rdata, "strings", None)
            if chunk_bytes:
                record_str = b"".join(chunk_bytes).decode("utf-8", errors="replace").strip()
            else:
                record_str = str(rdata).strip('"').strip()
            records.append(record_str)
        return records, None
    except dns.resolver.NXDOMAIN:
        return [], "NXDOMAIN: The host record does not exist."
    except dns.resolver.NoAnswer:
        return [], "NO_ANSWER: Host exists, but no TXT records were found."
    except dns.resolver.Timeout:
        return [], "TIMEOUT: DNS query timed out while contacting nameservers."
    except dns.resolver.NoNameservers:
        return [], "SERVFAIL: All nameservers failed to answer or query was refused."
    except dns.exception.DNSException as e:
        return [], f"DNS_ERROR: {type(e).__name__}"
    except Exception as e:
        return [], f"RESOLVER_ERROR: {str(e)}"


def enforce_tenant_domain_access(domain: Domain, current_user: User, db: Session) -> None:
    """Enforces strict tenant isolation for domain operations."""
    if current_user.role == "client":
        if not current_user.client_id or domain.client_id != current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Domain record not found.",
            )
    elif current_user.role == "employee":
        client = db.query(Client).filter(Client.id == domain.client_id).first()
        if client and client.assigned_employee_id and client.assigned_employee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not assigned to this client record.",
            )


def register_domain(
    db: Session,
    domain_str: str,
    client_id: str,
    current_user: User,
) -> Tuple[Domain, str]:
    """
    Registers a new domain for verification under an authorized client/tenant.
    Generates a cryptographically secure token and stores only its SHA-256 hash.
    """
    # 1. Validate parent client exists
    client = db.query(Client).filter(Client.id == client_id).first()
    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with ID '{client_id}' does not exist.",
        )

    # 2. Syntax validation and canonical normalization
    is_valid, normalized, err_msg = validate_and_normalize_domain(domain_str)
    if not is_valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err_msg)

    # 3. Tenant-scoped duplicate check
    existing = (
        db.query(Domain)
        .filter(Domain.client_id == client_id, Domain.normalized_domain == normalized)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain '{normalized}' is already registered for this organization.",
        )

    # 4. Generate high-entropy token and hash
    token = generate_verification_token()
    token_hash = hash_verification_token(token)
    now = utc_now()
    expires_at = now + timedelta(hours=TOKEN_EXPIRATION_HOURS)

    domain = Domain(
        client_id=client_id,
        domain=domain_str.strip(),
        normalized_domain=normalized,
        verification_status="pending",
        verification_token_hash=token_hash,
        challenge_created_at=now,
        challenge_expires_at=expires_at,
        verification_attempt_count=0,
    )
    db.add(domain)
    db.commit()
    db.refresh(domain)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="REGISTER_DOMAIN",
        resource_type="domain",
        resource_id=domain.id,
        details=f"Registered domain '{normalized}' for DNS TXT ownership verification.",
    )

    return domain, token


def get_domains(
    db: Session,
    current_user: User,
    client_id: Optional[str] = None,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
) -> Tuple[List[Domain], int]:
    """Retrieves paginated domains scoped strictly to the authorized tenant."""
    query = db.query(Domain)

    # Enforce tenant scoping
    if current_user.role == "client":
        if not current_user.client_id:
            return [], 0
        query = query.filter(Domain.client_id == current_user.client_id)
    elif client_id:
        query = query.filter(Domain.client_id == client_id)

    if status_filter:
        query = query.filter(Domain.verification_status == status_filter)

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.filter(Domain.normalized_domain.ilike(search_pattern))

    total = query.count()
    items = (
        query.order_by(desc(Domain.created_at))
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return items, total


def get_domain_by_id(db: Session, domain_id: str, current_user: User) -> Domain:
    """Retrieves a single domain record with tenant permission checks."""
    domain = db.query(Domain).filter(Domain.id == domain_id).first()
    if not domain:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Domain with ID '{domain_id}' not found.",
        )
    enforce_tenant_domain_access(domain, current_user, db)
    return domain


def verify_domain(db: Session, domain_id: str, current_user: User) -> Tuple[bool, str, Domain]:
    """
    Executes DNS TXT ownership verification against _lazynerds-verification.<domain>.
    Enforces rate limits, challenge expiration, and constant-time token comparison.
    """
    domain = get_domain_by_id(db, domain_id, current_user)

    # If already verified, return idempotent success
    if domain.verification_status == "verified":
        return True, "Domain ownership is already verified.", domain

    now = utc_now()

    # 1. Check challenge expiration
    if now > ensure_utc(domain.challenge_expires_at):
        domain.verification_status = "expired"
        domain.failure_reason = "Verification challenge has expired (24-hour limit). Please regenerate the challenge to get a new token."
        domain.updated_at = now
        db.commit()
        db.refresh(domain)
        return False, domain.failure_reason, domain

    # 2. Enforce rate limiting: minimum interval between attempts
    if domain.last_verification_attempt_at:
        elapsed = (now - ensure_utc(domain.last_verification_attempt_at)).total_seconds()
        if elapsed < RATE_LIMIT_SECONDS:
            remaining = int(RATE_LIMIT_SECONDS - elapsed) + 1
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Verification was attempted too recently. Please wait at least {remaining} seconds before retrying.",
            )

    # 3. Enforce maximum attempt limit per challenge
    if domain.verification_attempt_count >= MAX_VERIFICATION_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum verification attempts ({MAX_VERIFICATION_ATTEMPTS}) reached for this challenge. Please regenerate the challenge.",
        )

    # 4. Perform real DNS TXT lookup
    txt_records, dns_error = resolve_dns_txt(domain.normalized_domain)

    domain.verification_attempt_count += 1
    domain.last_verification_attempt_at = now
    domain.updated_at = now

    # 5. Token comparison
    matched = False
    found_matching_format = False

    if txt_records:
        for record in txt_records:
            if record.startswith(RECORD_VALUE_PREFIX):
                found_matching_format = True
                extracted_token = record[len(RECORD_VALUE_PREFIX):].strip()
                candidate_hash = hash_verification_token(extracted_token)
                if hmac.compare_digest(candidate_hash, domain.verification_token_hash):
                    matched = True
                    break

        if matched:
            domain.verification_status = "verified"
            domain.verified_at = now
            domain.failure_reason = None
            db.commit()
            db.refresh(domain)

            log_audit(
                db=db,
                user_email=current_user.email,
                action="VERIFY_DOMAIN",
                resource_type="domain",
                resource_id=domain.id,
                details=f"Domain '{domain.normalized_domain}' verified successfully via DNS TXT record.",
            )
            return True, "Domain ownership successfully verified via DNS TXT record.", domain
        elif found_matching_format:
            domain.verification_status = "failed"
            domain.failure_reason = "DNS TXT record found, but the token value does not match the active challenge."
            db.commit()
            db.refresh(domain)
            return False, domain.failure_reason, domain
        else:
            domain.verification_status = "failed"
            domain.failure_reason = f"TXT records found at {RECORD_NAME_PREFIX}.{domain.normalized_domain}, but none matched the '{RECORD_VALUE_PREFIX}<token>' format."
            db.commit()
            db.refresh(domain)
            return False, domain.failure_reason, domain
    else:
        # No TXT records returned
        domain.verification_status = "failed"
        if dns_error and "NXDOMAIN" in dns_error:
            domain.failure_reason = f"DNS record '{RECORD_NAME_PREFIX}.{domain.normalized_domain}' was not found (NXDOMAIN). DNS propagation may take up to a few minutes."
        elif dns_error and "TIMEOUT" in dns_error:
            domain.failure_reason = f"DNS query timed out for '{RECORD_NAME_PREFIX}.{domain.normalized_domain}'. Please try again."
        elif dns_error and "NO_ANSWER" in dns_error:
            domain.failure_reason = f"No TXT records found at '{RECORD_NAME_PREFIX}.{domain.normalized_domain}'. Ensure record type is set to TXT."
        else:
            domain.failure_reason = f"No TXT records found at '{RECORD_NAME_PREFIX}.{domain.normalized_domain}'. DNS propagation may take up to a few minutes."
        db.commit()
        db.refresh(domain)
        return False, domain.failure_reason, domain


def regenerate_domain_challenge(
    db: Session,
    domain_id: str,
    current_user: User,
) -> Tuple[Domain, str]:
    """
    Regenerates the verification challenge for a domain, resetting the expiry window
    and generating a fresh cryptographically secure token.
    """
    domain = get_domain_by_id(db, domain_id, current_user)

    now = utc_now()
    new_token = generate_verification_token()
    new_hash = hash_verification_token(new_token)

    domain.verification_token_hash = new_hash
    domain.verification_status = "pending"
    domain.challenge_created_at = now
    domain.challenge_expires_at = now + timedelta(hours=TOKEN_EXPIRATION_HOURS)
    domain.verification_attempt_count = 0
    domain.failure_reason = None
    domain.verified_at = None
    domain.updated_at = now

    db.commit()
    db.refresh(domain)

    log_audit(
        db=db,
        user_email=current_user.email,
        action="REGENERATE_DOMAIN_CHALLENGE",
        resource_type="domain",
        resource_id=domain.id,
        details=f"Regenerated DNS TXT verification challenge for domain '{domain.normalized_domain}'.",
    )

    return domain, new_token


def delete_domain(db: Session, domain_id: str, current_user: User) -> None:
    """Deletes a domain registration record under authorized tenant supervision."""
    domain = get_domain_by_id(db, domain_id, current_user)
    domain_name = domain.normalized_domain

    db.delete(domain)
    db.commit()

    log_audit(
        db=db,
        user_email=current_user.email,
        action="DELETE_DOMAIN",
        resource_type="domain",
        resource_id=domain_id,
        details=f"Deleted domain registration for '{domain_name}'.",
    )


def sanitize_domain_input(raw: str) -> str:
    """Strips scheme, trailing slashes, paths, and ports from user-provided domain or URL input."""
    cleaned = raw.strip()
    if "://" in cleaned:
        from urllib.parse import urlparse
        parsed = urlparse(cleaned)
        cleaned = parsed.hostname or cleaned
    elif "/" in cleaned:
        cleaned = cleaned.split("/")[0]
    if ":" in cleaned and not cleaned.startswith("["):
        cleaned = cleaned.split(":")[0]
    return cleaned.strip()


def verify_public_domain_ownership(
    domain_str: str,
    method: str,
    token: str,
) -> Tuple[bool, str, str, Optional[str]]:
    """
    Verifies domain ownership through public challenge inspection across DNS TXT,
    HTTP file upload, or HTML meta tag without requiring pre-existing account state.
    On success, returns a cryptographically signed proof token for server-side verification.
    """
    clean_domain = sanitize_domain_input(domain_str)
    is_valid, normalized, err_msg = validate_and_normalize_domain(clean_domain)
    if not is_valid:
        return False, err_msg, clean_domain, None

    clean_method = method.strip().lower()
    clean_token = token.strip()
    expected_value = f"{RECORD_VALUE_PREFIX}{clean_token}"

    if clean_method == "dns":
        record_name = f"{RECORD_NAME_PREFIX}.{normalized}"
        resolver = dns.resolver.Resolver()
        resolver.timeout = 4.0
        resolver.lifetime = 6.0
        try:
            answers = resolver.resolve(record_name, "TXT")
            for rdata in answers:
                for txt_bytes in rdata.strings:
                    txt_str = txt_bytes.decode("utf-8", errors="replace").strip()
                    if hmac.compare_digest(txt_str, expected_value) or hmac.compare_digest(txt_str, clean_token):
                        proof = create_domain_verification_proof(normalized, "dns")
                        return True, "Domain ownership cryptographically verified via DNS TXT record.", normalized, proof
            return False, f"TXT record found at '{record_name}', but token does not match.", normalized, None
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            return False, f"DNS TXT record '{record_name}' not found. Please allow a few minutes for DNS sync.", normalized, None
        except Exception as e:
            return False, f"DNS resolution error: {str(e)}", normalized, None

    elif clean_method == "file":
        urls_to_try = [
            f"https://{normalized}/.well-known/fixops-verification.txt",
            f"https://{normalized}/fixops-verification.txt",
        ]
        allow_lab = is_lab_testing_authorized()
        last_fetch_error = None
        for target_url in urls_to_try:
            try:
                status_code, resp_headers, content, final_url = safe_http_fetch(
                    url=target_url,
                    method="GET",
                    max_bytes=128 * 1024,
                    timeout=5.0,
                    max_redirects=3,
                    allow_lab=allow_lab,
                )
                if status_code == 200:
                    trimmed_content = content.strip()
                    if expected_value in trimmed_content or clean_token in trimmed_content:
                        proof = create_domain_verification_proof(normalized, "file")
                        return True, "Domain ownership verified via HTTP file token at /.well-known/fixops-verification.txt.", normalized, proof
            except ValueError as val_err:
                # SSRF or redirect boundary violation
                last_fetch_error = sanitize_assessment_error(str(val_err))
                break
            except Exception as exc:
                last_fetch_error = sanitize_assessment_error(str(exc))
                continue

        if last_fetch_error and ("SSRF" in last_fetch_error or "Security policy" in last_fetch_error):
            return False, f"Target destination rejected by security policy: {last_fetch_error}", normalized, None
        return False, "Verification file not found at /.well-known/fixops-verification.txt or /fixops-verification.txt, or content does not match token.", normalized, None

    elif clean_method == "meta":
        target_url = f"https://{normalized}/"
        allow_lab = is_lab_testing_authorized()
        try:
            status_code, resp_headers, html_content, final_url = safe_http_fetch(
                url=target_url,
                method="GET",
                max_bytes=512 * 1024,
                timeout=5.0,
                max_redirects=3,
                allow_lab=allow_lab,
            )
            if status_code == 200:
                pattern = re.compile(
                    r'<meta[^>]+(?:name=["\']fixops-verification["\'][^>]+content=["\']([^"\']+)["\']|content=["\']([^"\']+)["\'][^>]+name=["\']fixops-verification["\'])',
                    re.IGNORECASE,
                )
                matches = pattern.findall(html_content)
                for m in matches:
                    found_token = (m[0] or m[1]).strip()
                    if hmac.compare_digest(found_token, clean_token) or hmac.compare_digest(found_token, expected_value):
                        proof = create_domain_verification_proof(normalized, "meta")
                        return True, "Domain ownership verified via HTML meta tag.", normalized, proof
            return False, "HTML meta tag with verification token not found in homepage <head>.", normalized, None
        except ValueError as val_err:
            safe_err = sanitize_assessment_error(str(val_err))
            return False, f"Target destination rejected by security policy: {safe_err}", normalized, None
        except Exception as e:
            safe_err = sanitize_assessment_error(str(e))
            return False, f"Could not inspect homepage HTML: {safe_err}", normalized, None

    else:
        return False, f"Unsupported verification method '{method}'. Supported methods: dns, file, meta.", normalized, None


def calculate_domain_security_score(
    domain_str: str,
    verification_proof: Optional[str] = None,
    db: Optional[Session] = None,
    current_user: Optional[User] = None,
) -> dict:
    """
    Executes actual, non-destructive perimeter security audit and calculates
    genuine security score based on discovered vulnerabilities.
    Enforces server-side domain ownership validation: does NOT trust client-supplied
    flags or arbitrary unverified domains.
    """
    from app.services.web_audit_engine import audit_web_target

    clean_domain = sanitize_domain_input(domain_str)
    is_valid, normalized, err_msg = validate_and_normalize_domain(clean_domain)
    if not is_valid:
        return {
            "status": "failed",
            "score": None,
            "posture": "Score Unavailable",
            "findings_count": 0,
            "error": err_msg,
            "domain": clean_domain,
        }

    # Server-Side Ownership Validation:
    # 1. Check if valid cryptographic verification proof token is presented
    is_verified = False
    if verification_proof:
        is_valid_proof, proof_err = verify_domain_verification_proof(verification_proof, normalized)
        if is_valid_proof:
            is_verified = True

    # 2. Check if user is authenticated and domain is verified in database
    if not is_verified and current_user and db:
        query = db.query(Domain).filter(
            Domain.normalized_domain == normalized,
            Domain.verification_status == "verified",
        )
        if current_user.role == "client":
            query = query.filter(Domain.client_id == current_user.client_id)
        if query.first():
            is_verified = True

    if not is_verified:
        return {
            "status": "failed",
            "score": None,
            "posture": "Score Unavailable",
            "findings_count": 0,
            "error": "Domain ownership not verified. You must complete domain verification before requesting a security assessment.",
            "domain": normalized,
        }

    target_url = f"https://{normalized}"
    try:
        findings, metadata = audit_web_target(
            target_url=target_url,
            allow_lab=is_lab_testing_authorized(),
        )

        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in findings:
            sev = (f.get("severity") or "info").lower()
            if sev in counts:
                counts[sev] += 1
            else:
                counts["info"] += 1

        deductions = (
            counts["critical"] * 25
            + counts["high"] * 15
            + counts["medium"] * 8
            + counts["low"] * 3
            + counts["info"] * 0  # Informational observations do not deduct security score
        )
        calculated_score = max(0, min(100, 100 - deductions))

        if calculated_score >= 80:
            posture = "Good Posture"
        elif calculated_score >= 60:
            posture = "Moderate Risk"
        else:
            posture = "Critical Risk"

        return {
            "status": "completed",
            "score": calculated_score,
            "posture": posture,
            "findings_count": len(findings),
            "severity_counts": counts,
            "findings": findings[:50],
            "metadata": metadata,
            "domain": normalized,
        }
    except Exception as e:
        safe_err = sanitize_assessment_error(str(e))
        return {
            "status": "failed",
            "score": None,
            "posture": "Score Unavailable",
            "findings_count": 0,
            "error": safe_err,
            "domain": normalized,
        }

