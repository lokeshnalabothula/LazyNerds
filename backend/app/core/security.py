import ipaddress
import socket
from urllib.parse import urlparse
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
import bcrypt
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
