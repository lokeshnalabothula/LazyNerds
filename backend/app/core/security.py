import ipaddress
import re
import secrets
import socket
import threading
import time
from collections import defaultdict
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Tuple, Union
from urllib.parse import urljoin, urlparse

import bcrypt
import httpx
import jwt
from app.core.config import settings

# Disallowed IP networks for SSRF prevention
BLOCKED_IP_NETWORKS = [
    ipaddress.ip_network("127.0.0.0/8"),      # IPv4 Loopback
    ipaddress.ip_network("10.0.0.0/8"),       # RFC1918 Private
    ipaddress.ip_network("172.16.0.0/12"),    # RFC1918 Private
    ipaddress.ip_network("192.168.0.0/16"),   # RFC1918 Private
    ipaddress.ip_network("169.254.0.0/16"),   # Link-Local / Cloud Metadata (169.254.169.254)
    ipaddress.ip_network("0.0.0.0/8"),        # Current network
    ipaddress.ip_network("224.0.0.0/4"),      # Multicast
    ipaddress.ip_network("240.0.0.0/4"),      # Reserved
    ipaddress.ip_network("::1/128"),          # IPv6 Loopback
    ipaddress.ip_network("fc00::/7"),         # IPv6 Unique Local
    ipaddress.ip_network("fe80::/10"),        # IPv6 Link-Local
]

CLOUD_METADATA_IPS = {
    ipaddress.ip_address("169.254.169.254"),
    ipaddress.ip_address("169.254.170.2"),
    ipaddress.ip_address("100.100.100.200"),       # Alibaba Cloud metadata
    ipaddress.ip_address("fd00:ec2::254"),         # AWS IPv6 metadata
}

BLOCKED_METADATA_HOSTNAMES = {
    "metadata.google.internal",
    "metadata",
    "instance-data",
    "metadata.internal",
}

BLOCKED_INFRASTRUCTURE_PORTS = {
    22,    # SSH
    25,    # SMTP
    53,    # DNS
    111,   # RPCbind
    2049,  # NFS
    2375,  # Docker unencrypted
    2376,  # Docker TLS
    3000,  # FixOps Frontend
    3306,  # MySQL
    5432,  # PostgreSQL
    6379,  # Redis
    7233,  # Temporal gRPC
    8000,  # FixOps Backend API
    8233,  # Temporal Web
    11211, # Memcached
    27017, # MongoDB
}


OWNED_LAB_PORTS = {8888}
OWNED_LAB_HOSTNAMES = {"127.0.0.1", "localhost", "host.docker.internal"}


def is_lab_testing_authorized() -> bool:
    """
    Returns True ONLY if:
    1. settings.ENVIRONMENT is NOT 'production' (case-insensitive fail-closed check).
    2. settings.ALLOW_LAB_TESTING is explicitly True.
    Under ALL other circumstances, returns False.
    """
    env = (getattr(settings, "ENVIRONMENT", "production") or "production").lower().strip()
    if env == "production":
        return False
    return getattr(settings, "ALLOW_LAB_TESTING", False) is True


def validate_target_url_ssrf(url: str, allow_lab_testing: bool = False) -> tuple[bool, str]:
    """
    Strict SSRF and destination validation for automated scanner targets.
    Ensures targets use http/https, valid web ports, cannot reach internal infrastructure,
    and unconditionally blocks cloud metadata services.

    Lab Testing Fail-Closed Safeguards:
    - Lab testing is FAIL-CLOSED in production unconditionally: even if allow_lab_testing=True
      is passed, if settings.ENVIRONMENT == "production" or ALLOW_LAB_TESTING is False,
      lab mode is strictly forbidden.
    - When authorized in non-production, lab testing is restricted EXCLUSIVELY to the owned
      local lab target (port 8888 on localhost / 127.0.0.1 / host.docker.internal).
    - Internal infrastructure and FixOps self-ports (e.g. 8000, 3000) are blocked unconditionally.
    """
    if not url or not isinstance(url, str):
        return False, "Target URL must be a non-empty string."

    parsed = urlparse(url.strip())
    if parsed.scheme not in ("http", "https"):
        return False, f"Invalid scheme '{parsed.scheme}'. Only http and https URLs are authorized."

    hostname = parsed.hostname
    if not hostname:
        return False, "Target URL lacks a valid hostname."

    clean_hostname = hostname.lower().strip(".")
    if clean_hostname in BLOCKED_METADATA_HOSTNAMES:
        return False, f"SSRF violation: Access to metadata service hostname '{hostname}' is blocked."

    # Validate destination port: block internal infrastructure/database ports
    if parsed.port:
        if parsed.port in BLOCKED_INFRASTRUCTURE_PORTS:
            return False, f"SSRF violation: Target specifies sensitive infrastructure port {parsed.port}. Only standard web services are permitted."
        if parsed.port < 1 or parsed.port > 65535:
            return False, f"Invalid target port {parsed.port}."

    # Determine effective lab testing authorization: fail-closed in production
    effective_allow_lab = allow_lab_testing and is_lab_testing_authorized()

    # Check for direct numeric IP representations or hex/octal bypass attempts
    try:
        resolved_ips = []
        try:
            # Check if hostname itself is directly an IP
            ip_obj = ipaddress.ip_address(hostname)
            resolved_ips.append(ip_obj)
        except ValueError:
            # Resolves DNS hostname to IPs
            addr_info = socket.getaddrinfo(hostname, None)
            for item in addr_info:
                sockaddr = item[4]
                ip_str = sockaddr[0]
                try:
                    resolved_ips.append(ipaddress.ip_address(ip_str))
                except ValueError:
                    pass
    except socket.gaierror:
        # If hostname cannot be resolved in production, reject
        if not effective_allow_lab:
            return False, f"Target hostname '{hostname}' could not be resolved."
        # In lab testing, might be mock or container hostname
        return True, ""

    if not resolved_ips:
        return False, f"Unable to resolve IP address for target '{hostname}'."

    for ip in resolved_ips:
        # Normalize IPv4-mapped IPv6 addresses (e.g. ::ffff:169.254.169.254 -> 169.254.169.254)
        if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
            ip = ip.ipv4_mapped

        # Cloud metadata is strictly forbidden unconditionally (even in lab mode)
        if ip in CLOUD_METADATA_IPS:
            return False, f"SSRF violation: Target resolves to cloud metadata endpoint ({ip})."

        # Check blocked networks
        for net in BLOCKED_IP_NETWORKS:
            if ip in net:
                is_owned_lab_host = (
                    ip.is_loopback
                    or clean_hostname in OWNED_LAB_HOSTNAMES
                    or clean_hostname.endswith(".internal")
                    or clean_hostname.endswith(".local")
                )
                target_port = parsed.port or (443 if parsed.scheme == "https" else 80)
                if effective_allow_lab and is_owned_lab_host and (target_port in OWNED_LAB_PORTS):
                    # Permitted in explicit non-production lab environment on authorized lab port 8888
                    continue
                return False, f"SSRF violation: Target resolves to disallowed internal/private IP ({ip})."

    return True, ""



def hash_password(password: str) -> str:
    """
    Hashes a plaintext password using bcrypt with a random salt.
    Safely truncates UTF-8 encoded bytes to 72 bytes to avoid bcrypt library limits.
    """
    salt = bcrypt.gensalt()
    pwd_bytes = password.encode("utf-8")[:72]
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode("utf-8")


get_password_hash = hash_password


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a plaintext password against a bcrypt hash.
    Safely truncates plaintext UTF-8 encoded bytes to 72 bytes to match hash_password.
    """
    if not plain_password or not hashed_password:
        return False
    try:
        pwd_bytes = plain_password.encode("utf-8")[:72]
        return bcrypt.checkpw(
            pwd_bytes,
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False



def validate_password_strength(password: str) -> tuple[bool, str]:
    """
    Validates password strength according to Lazy Nerds FixOps security policy:
    Minimum 10 characters, at least one uppercase, one lowercase, and one number.
    """
    if len(password) < 10:
        return False, "Password must be at least 10 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number."
    return True, ""


def create_access_token(
    subject: Union[str, Any],
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None
) -> str:
    """Generates a signed JWT token."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp())
    }
    if extra_claims:
        to_encode.update(extra_claims)
        
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decodes and validates a JWT token."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.PyJWTError:
        return None


def create_domain_verification_proof(domain: str, method: str) -> str:
    """
    Generates a cryptographically signed proof token proving that domain ownership
    was verified via the specified method. Valid for 2 hours.
    Includes a unique jti (JWT ID) for replay tracking.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=2)
    jti = secrets.token_hex(16)
    to_encode = {
        "sub": f"domain_verification:{domain.strip().lower()}",
        "domain": domain.strip().lower(),
        "method": method,
        "purpose": "domain_verification_proof",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_domain_verification_proof(token: str, expected_domain: str) -> tuple[bool, str]:
    """
    Validates a domain verification proof token.
    Ensures signature is authentic, purpose matches, not expired, and matches expected domain.
    """
    if not token or not isinstance(token, str):
        return False, "Verification proof token is missing."

    try:
        payload = jwt.decode(
            token.strip(),
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        return False, "Domain verification proof has expired. Please verify domain again."
    except jwt.PyJWTError:
        return False, "Invalid domain verification proof token signature."

    if payload.get("purpose") != "domain_verification_proof":
        return False, "Invalid verification token purpose."

    token_domain = (payload.get("domain") or "").strip().lower()
    clean_expected = expected_domain.strip().lower()
    if token_domain != clean_expected:
        return False, f"Verification proof was issued for '{token_domain}', not '{clean_expected}'."

    # Verify jti is present
    jti = payload.get("jti")
    if not jti or not isinstance(jti, str):
        return False, "Verification proof lacks valid token identification."

    # Check replay limit for this proof token (max 6 assessments per 2-hour window)
    if not token_replay_limiter.check_and_record(f"jti:{jti}"):
        return False, "Verification proof assessment quota exceeded for this token. Please re-verify domain."

    return True, ""


def safe_http_fetch(
    url: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    max_bytes: int = 512 * 1024,
    timeout: float = 6.0,
    max_redirects: int = 3,
    allow_lab: Optional[bool] = None,
) -> Tuple[int, dict, str, str]:
    """
    SSRF-hardened HTTP client:
    - Verifies destination URL and scheme before opening socket.
    - Re-verifies resolved IP immediately prior to connection against DNS rebinding.
    - Strictly blocks automatic uninspected redirects (follow_redirects=False).
    - Resolves and re-validates every redirect destination against SSRF rules before following (max 3 hops).
    - Uses strict connect (3.0s) and read timeouts.
    - Consumes responses via capped streaming to prevent memory exhaustion (DoS).
    """
    if allow_lab is None:
        allow_lab = is_lab_testing_authorized()

    current_url = url.strip()
    custom_headers = {
        "User-Agent": "FixOps-SecurityAudit/1.0 (Defensive Ownership & Security Verification; +https://lazynerds.com)",
        "Accept": "*/*",
    }
    if headers:
        custom_headers.update(headers)

    for hop in range(max_redirects + 1):
        # 1. Validate target URL scheme, hostname and port
        is_safe, err_msg = validate_target_url_ssrf(current_url, allow_lab_testing=allow_lab)
        if not is_safe:
            raise ValueError(f"SSRF violation on '{current_url}': {err_msg}")

        parsed = urlparse(current_url)
        hostname = parsed.hostname or ""
        scheme = parsed.scheme.lower()
        port = parsed.port or (443 if scheme == "https" else 80)

        # 2. Connection-time DNS resolution and rebinding check
        try:
            addr_info = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
            for item in addr_info:
                ip_str = item[4][0]
                ip_url = f"{scheme}://[{ip_str}]:{port}" if ":" in ip_str else f"{scheme}://{ip_str}:{port}"
                safe_ip, ip_err = validate_target_url_ssrf(ip_url, allow_lab_testing=allow_lab)
                if not safe_ip:
                    raise ValueError(f"Connection-time DNS rebinding blocked: '{hostname}' resolved to disallowed IP {ip_str}: {ip_err}")
        except socket.gaierror as e:
            raise RuntimeError(f"DNS resolution failed for host '{hostname}': {e}")

        # 3. Streamed request with explicit timeouts
        client_timeout = httpx.Timeout(timeout=timeout, connect=3.0)
        try:
            with httpx.Client(timeout=client_timeout, follow_redirects=False, verify=False) as client:
                with client.stream(method, current_url, headers=custom_headers) as response:
                    status_code = response.status_code
                    resp_headers = {k.lower(): v for k, v in response.headers.items()}

                    # 4. Inspect redirect
                    if status_code in (301, 302, 303, 307, 308) and "location" in resp_headers:
                        if hop >= max_redirects:
                            raise ValueError(f"Redirect loop detected: exceeded maximum hop limit of {max_redirects}.")
                        raw_loc = resp_headers["location"].strip()
                        next_url = urljoin(current_url, raw_loc)
                        current_url = next_url
                        continue

                    # 5. Capped streaming read up to max_bytes
                    chunks = []
                    total_bytes = 0
                    for chunk in response.iter_bytes(chunk_size=8192):
                        chunks.append(chunk)
                        total_bytes += len(chunk)
                        if total_bytes >= max_bytes:
                            break

                    body_bytes = b"".join(chunks)[:max_bytes]
                    body_text = body_bytes.decode("utf-8", errors="replace")
                    return status_code, resp_headers, body_text, current_url
        except httpx.RequestError as req_err:
            raise RuntimeError(f"Connection failed to '{current_url}': {req_err}")

    raise ValueError(f"Redirect limit of {max_redirects} exceeded without reaching terminal response.")


def sanitize_assessment_error(error_msg: str) -> str:
    """
    Sanitizes assessment error messages to ensure internal file paths,
    private IPs, database credentials, or secret details never leak to clients.
    """
    if not error_msg:
        return "Assessment service encountered an unhandled error."
    msg = str(error_msg)
    # Strip database credentials
    msg = re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", msg)
    # Strip internal server filesystem paths
    msg = re.sub(r"(?:/[A-Za-z0-9_.-]+)+/(?:backend|app|Users|opt|var|home)/[A-Za-z0-9_./-]+", "[internal path]", msg)
    # Strip private IP addresses
    msg = re.sub(r"\b(?:10|127|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b", "[internal-ip]", msg)
    # Strip cloud metadata IPs
    msg = re.sub(r"\b169\.254\.\d{1,3}\.\d{1,3}\b", "[metadata-ip]", msg)
    # Normalize common Python / socket error descriptions into user-friendly summaries
    if "nodename nor servname provided" in msg or "Name or service not known" in msg:
        return "DNS resolution failed: Domain does not exist or has no valid DNS records."
    if "Connection refused" in msg:
        return "Connection refused: Target host is not accepting connections on standard web ports."
    if "timed out" in msg.lower() or "timeout" in msg.lower():
        return "Connection timed out: Target web server did not respond within the allocated timeout window."
    if "SSRF" in msg or "violates" in msg.lower() or "disallowed" in msg.lower():
        return "Security policy rejection: Target destination resolves to a restricted or disallowed network address."
    return msg


# Concurrency Semaphore: max 3 concurrent assessments running on the instance
ASSESSMENT_CONCURRENCY_SEMAPHORE = threading.BoundedSemaphore(3)

@contextmanager
def acquire_assessment_slot(timeout: float = 0.5):
    """
    Acquires an assessment slot to bound concurrency on resource-constrained instances.
    Raises RuntimeError if capacity is saturated.
    """
    acquired = ASSESSMENT_CONCURRENCY_SEMAPHORE.acquire(timeout=timeout)
    if not acquired:
        raise RuntimeError("Assessment capacity reached. The scanner is currently processing maximum concurrent assessments. Please retry in a few moments.")
    try:
        yield
    finally:
        ASSESSMENT_CONCURRENCY_SEMAPHORE.release()


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""
    def __init__(self, max_requests: int, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = defaultdict(list)
        self.lock = threading.Lock()

    def check_and_record(self, key: str) -> bool:
        now = time.time()
        with self.lock:
            timestamps = [ts for ts in self.requests[key] if now - ts < self.window_seconds]
            if len(timestamps) >= self.max_requests:
                self.requests[key] = timestamps
                return False
            timestamps.append(now)
            self.requests[key] = timestamps
            if len(self.requests) > 2000:
                self.requests = defaultdict(list, {k: v for k, v in self.requests.items() if now - v[-1] < self.window_seconds})
            return True


# Global rate limiter instances for public assessment endpoints
public_challenge_limiter = SlidingWindowRateLimiter(max_requests=20, window_seconds=60)
public_verify_limiter = SlidingWindowRateLimiter(max_requests=12, window_seconds=60)
public_score_limiter = SlidingWindowRateLimiter(max_requests=6, window_seconds=60)
token_replay_limiter = SlidingWindowRateLimiter(max_requests=6, window_seconds=7200)


