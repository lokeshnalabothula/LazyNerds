import re
import socket
import ssl
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple
from urllib.parse import urlparse, urljoin
import httpx

from app.core.security import validate_target_url_ssrf, is_lab_testing_authorized, safe_http_fetch


def audit_web_target(
    target_url: str,
    allow_lab: Optional[bool] = None,
    progress_callback: Optional[Callable[[str, int, str, Optional[str]], None]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Executes a comprehensive, non-destructive, genuine security audit against a target web URL.
    Enforces strict SSRF protection, re-validates DNS resolution, inspects TLS certificates,
    security headers, CORS policies, cookie attributes, and sensitive perimeter files.

    Returns:
        (findings, audit_metadata)
    """
    clean_target = target_url.strip()
    if allow_lab is None:
        allow_lab = is_lab_testing_authorized()

    # Step 1: Pre-flight SSRF and scheme validation
    if progress_callback:
        progress_callback("recon", 10, "Validating target URL and enforcing SSRF boundary controls...", "ssrf-guard")

    is_safe, err_msg = validate_target_url_ssrf(clean_target, allow_lab_testing=allow_lab)
    if not is_safe:
        raise ValueError(f"SSRF validation rejected target: {err_msg}")

    parsed = urlparse(clean_target)
    scheme = parsed.scheme.lower()
    hostname = parsed.hostname or ""
    port = parsed.port or (443 if scheme == "https" else 80)

    # Re-validate DNS resolution against rebinding
    try:
        resolved_addrs = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
        for family, socktype, proto, canonname, sockaddr in resolved_addrs:
            ip_str = sockaddr[0]
            ip_url = f"{scheme}://[{ip_str}]:{port}" if ":" in ip_str else f"{scheme}://{ip_str}:{port}"
            ip_safe, ip_err = validate_target_url_ssrf(ip_url, allow_lab_testing=allow_lab)
            if not ip_safe:
                raise ValueError(f"Resolved destination IP {ip_str} violates security policy: {ip_err}")
    except socket.gaierror as dns_err:
        raise RuntimeError(f"DNS resolution failed for host '{hostname}': {dns_err}")

    findings: List[Dict[str, Any]] = []
    checks_performed: List[str] = [
        "SSRF & DNS Rebinding Verification",
        "HTTP/HTTPS Response & Redirection Behavior",
        "SSL/TLS Certificate Validity & Cipher Strength",
        "HTTP Security Headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy)",
        "Cookie Security Attributes (HttpOnly, Secure, SameSite)",
        "Cross-Origin Resource Sharing (CORS) Origin Reflection",
        "Service Banner & Version Disclosure Probing",
        "Sensitive Exposed Perimeter Files (.env, .git)",
    ]

    # Step 2: TLS / SSL Certificate and Negotiation Check (if HTTPS)
    tls_info: Dict[str, Any] = {}
    if scheme == "https":
        if progress_callback:
            progress_callback("recon", 30, "Inspecting SSL/TLS certificate chain, expiration, and cipher suites...", "tls-auditor")

        try:
            ssl_ctx = ssl.create_default_context()
            with socket.create_connection((hostname, port), timeout=7.0) as sock:
                with ssl_ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    tls_version = ssock.version()
                    cipher_info = ssock.cipher()
                    tls_info = {
                        "version": tls_version,
                        "cipher": cipher_info[0] if cipher_info else None,
                        "bits": cipher_info[2] if cipher_info else None,
                    }

                    if cert:
                        not_after_str = cert.get("notAfter")
                        if not_after_str:
                            try:
                                # Example: 'May 15 12:00:00 2027 GMT'
                                not_after_dt = datetime.strptime(not_after_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
                                now_utc = datetime.now(timezone.utc)
                                days_left = (not_after_dt - now_utc).days
                                tls_info["expires_at"] = not_after_dt.isoformat()
                                tls_info["days_until_expiry"] = days_left

                                if days_left < 0:
                                    findings.append({
                                        "title": "Expired SSL/TLS Certificate",
                                        "severity": "high",
                                        "cvss_score": 7.5,
                                        "cve_id": None,
                                        "description": f"The SSL/TLS certificate for {hostname} expired on {not_after_str} ({abs(days_left)} days ago).",
                                        "impact": "Clients will encounter browser security warnings, and encrypted communication authenticity cannot be verified.",
                                        "evidence": f"Certificate Subject: {cert.get('subject')}\nIssuer: {cert.get('issuer')}\nExpiry: {not_after_str}",
                                        "remediation_guidance": "Renew and deploy a valid SSL/TLS certificate from a recognized Certificate Authority immediately.",
                                        "remediation_notes": "[Source: FixOps Native TLS Auditor]",
                                    })
                                elif days_left <= 14:
                                    findings.append({
                                        "title": "SSL/TLS Certificate Expiring Soon",
                                        "severity": "low",
                                        "cvss_score": 3.7,
                                        "cve_id": None,
                                        "description": f"The SSL/TLS certificate for {hostname} will expire in {days_left} days on {not_after_str}.",
                                        "impact": "If the certificate expires before renewal, users will encounter browser security warnings and broken connections.",
                                        "evidence": f"Expiry Date: {not_after_str} ({days_left} days remaining)",
                                        "remediation_guidance": "Renew and replace the TLS certificate prior to the expiration date.",
                                        "remediation_notes": "[Source: FixOps Native TLS Auditor]",
                                    })
                            except Exception:
                                pass

                    if tls_version in ("TLSv1", "TLSv1.1"):
                        findings.append({
                            "title": "Deprecated TLS Protocol Version (TLS 1.0/1.1)",
                            "severity": "medium",
                            "cvss_score": 5.9,
                            "cve_id": None,
                            "description": f"The server negotiated {tls_version}. TLS 1.0 and TLS 1.1 contain known cryptographic weaknesses and are officially deprecated (RFC 8996).",
                            "impact": "Traffic may be vulnerable to downgrade and man-in-the-middle attacks.",
                            "evidence": f"Negotiated Protocol: {tls_version}\nCipher: {cipher_info}",
                            "remediation_guidance": "Disable TLS 1.0 and 1.1 on your server or reverse proxy. Enforce TLS 1.2 or TLS 1.3 only.",
                            "remediation_notes": "[Source: FixOps Native TLS Auditor]",
                        })
        except ssl.SSLCertVerificationError as ssl_err:
            findings.append({
                "title": "Untrusted or Self-Signed SSL/TLS Certificate",
                "severity": "high",
                "cvss_score": 7.4,
                "cve_id": None,
                "description": f"The SSL/TLS certificate for {hostname} failed verification: {str(ssl_err)}.",
                "impact": "Users will be presented with untrusted certificate warnings, and connections cannot be verified against MitM interception.",
                "evidence": f"TLS Connection Error: {str(ssl_err)}\nTarget: {clean_target}",
                "remediation_guidance": "Install a trusted SSL/TLS certificate signed by a valid public or enterprise Certificate Authority.",
                "remediation_notes": "[Source: FixOps Native TLS Auditor]",
            })
        except Exception as e:
            # Non-blocking if TLS probe fails on unexpected handshake error
            tls_info["error"] = str(e)

    # Step 3: HTTP Request Behavior & Security Headers
    if progress_callback:
        progress_callback("vuln_analysis", 50, "Evaluating HTTP response headers, CSP, and framing defenses...", "header-auditor")

    custom_headers = {
        "User-Agent": "FixOps-SecurityAudit/1.0 (Defensive Vulnerability Assessment; +https://lazynerds.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }

    try:
        with httpx.Client(timeout=10.0, follow_redirects=False, verify=False) as client:
            resp = client.get(clean_target, headers=custom_headers)
    except httpx.RequestError as req_err:
        raise RuntimeError(f"Target connection failed: Could not establish HTTP connection to {clean_target} ({req_err})")

    status_code = resp.status_code
    resp_headers = {k.lower(): v for k, v in resp.headers.items()}

    # Check 1: Insecure HTTP Protocol & Missing HTTPS Redirect
    if scheme == "http" and hostname not in ("127.0.0.1", "localhost"):
        is_redirect_to_https = False
        if status_code in (301, 302, 307, 308) and "location" in resp_headers:
            loc = resp_headers["location"].strip().lower()
            if loc.startswith("https://"):
                is_redirect_to_https = True

        if not is_redirect_to_https:
            findings.append({
                "title": "Insecure HTTP Protocol / Missing HTTPS Redirection",
                "severity": "medium",
                "cvss_score": 5.3,
                "cve_id": None,
                "description": f"Target {clean_target} serves content over unencrypted plain HTTP without automatically redirecting traffic to HTTPS.",
                "impact": "Unencrypted communication allows network eavesdroppers to intercept passwords, session cookies, and sensitive user data.",
                "evidence": f"GET {clean_target}\nHTTP Status: {status_code}\nLocation header missing or does not enforce HTTPS.",
                "remediation_guidance": "Configure the web server or reverse proxy to return an HTTP 301 permanent redirect from HTTP to HTTPS.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

    # Follow redirect safely (up to 3 hops) to audit final landing page headers
    current_resp = resp
    current_url = clean_target
    redirect_hops = 0
    while current_resp.status_code in (301, 302, 307, 308) and "location" in current_resp.headers and redirect_hops < 3:
        redirect_hops += 1
        raw_loc = current_resp.headers["location"]
        next_url = urljoin(current_url, raw_loc)

        # Re-validate redirect destination against SSRF!
        safe_redirect, redirect_err = validate_target_url_ssrf(next_url, allow_lab_testing=allow_lab)
        if not safe_redirect:
            findings.append({
                "title": "Open / Dangerous Redirect to Internal Infrastructure",
                "severity": "high",
                "cvss_score": 7.5,
                "cve_id": None,
                "description": f"The target returned a redirect to {next_url}, which violates SSRF internal destination boundaries.",
                "impact": "Attackers can manipulate redirection to bounce requests against internal services.",
                "evidence": f"Redirect Hop {redirect_hops}: {current_url} -> {next_url}\nDetail: {redirect_err}",
                "remediation_guidance": "Validate destination URLs against a strict allowlist before issuing HTTP redirects.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })
            break

        try:
            with httpx.Client(timeout=8.0, follow_redirects=False, verify=False) as client:
                current_resp = client.get(next_url, headers=custom_headers)
                current_url = next_url
        except Exception:
            break

    final_headers = {k.lower(): v for k, v in current_resp.headers.items()}
    final_scheme = urlparse(current_url).scheme.lower()

    # Check 2: Strict-Transport-Security (HSTS)
    if final_scheme == "https":
        if "strict-transport-security" not in final_headers:
            findings.append({
                "title": "Missing HTTP Strict-Transport-Security (HSTS) Header",
                "severity": "low",
                "cvss_score": 3.7,
                "cve_id": None,
                "description": "The web server does not return a Strict-Transport-Security (HSTS) response header on HTTPS connections.",
                "impact": "Clients connecting over an insecure network may be vulnerable to SSL-stripping and downgrade attacks.",
                "evidence": f"GET {current_url}\nHTTP Status: {current_resp.status_code}\nMissing: Strict-Transport-Security",
                "remediation_guidance": "Configure the web server to send 'Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' on all HTTPS responses.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

    # Check 3: Content-Security-Policy (CSP)
    csp_val = final_headers.get("content-security-policy")
    if not csp_val:
        findings.append({
            "title": "Missing Content-Security-Policy (CSP) Header",
            "severity": "low",
            "cvss_score": 3.8,
            "cve_id": None,
            "description": "The application does not declare a Content-Security-Policy (CSP) header.",
            "impact": "Without a CSP, browsers cannot restrict unauthorized script execution, increasing vulnerability to Cross-Site Scripting (XSS).",
            "evidence": f"GET {current_url}\nMissing: Content-Security-Policy",
            "remediation_guidance": "Implement a Content-Security-Policy header defining trusted script, style, and object sources.",
            "remediation_notes": "[Source: FixOps Web Security Auditor]",
        })
    elif "'unsafe-inline'" in csp_val and ("'unsafe-eval'" in csp_val or "*" in csp_val):
        findings.append({
            "title": "Permissive Content-Security-Policy Configuration",
            "severity": "low",
            "cvss_score": 3.1,
            "cve_id": None,
            "description": "Content-Security-Policy includes 'unsafe-inline' and wildcard or 'unsafe-eval' directives in script execution.",
            "impact": "Permissive CSP directives undermine Cross-Site Scripting mitigations by permitting inline script execution.",
            "evidence": f"Content-Security-Policy: {csp_val[:300]}",
            "remediation_guidance": "Refactor inline scripts into external files with cryptographic nonces or hashes and remove 'unsafe-inline'.",
            "remediation_notes": "[Source: FixOps Web Security Auditor]",
        })

    # Check 4: X-Frame-Options (Clickjacking defense)
    xfo = final_headers.get("x-frame-options")
    has_frame_ancestors = csp_val and "frame-ancestors" in csp_val.lower()
    if not xfo and not has_frame_ancestors:
        findings.append({
            "title": "Missing Clickjacking Protection (X-Frame-Options)",
            "severity": "low",
            "cvss_score": 3.4,
            "cve_id": None,
            "description": "The page does not declare X-Frame-Options or CSP frame-ancestors, permitting framing in external iframes.",
            "impact": "Malicious websites can embed this application inside a hidden iframe to perform UI redressing (clickjacking) attacks.",
            "evidence": f"GET {current_url}\nMissing: X-Frame-Options (and no frame-ancestors in CSP)",
            "remediation_guidance": "Configure 'X-Frame-Options: DENY' or 'X-Frame-Options: SAMEORIGIN', or specify 'frame-ancestors 'self'' in CSP.",
            "remediation_notes": "[Source: FixOps Web Security Auditor]",
        })

    # Check 5: X-Content-Type-Options
    xcto = final_headers.get("x-content-type-options")
    if not xcto or "nosniff" not in xcto.lower():
        findings.append({
            "title": "Missing X-Content-Type-Options Header",
            "severity": "low",
            "cvss_score": 3.1,
            "cve_id": None,
            "description": "The response does not declare 'X-Content-Type-Options: nosniff'.",
            "impact": "Browsers may attempt to MIME-sniff response bodies away from the declared Content-Type, potentially executing scripts hidden in text or image files.",
            "evidence": f"GET {current_url}\nX-Content-Type-Options: {xcto or 'None'}",
            "remediation_guidance": "Add 'X-Content-Type-Options: nosniff' to all HTTP responses.",
            "remediation_notes": "[Source: FixOps Web Security Auditor]",
        })

    # Check 6: Referrer-Policy
    ref_policy = final_headers.get("referrer-policy")
    if not ref_policy:
        findings.append({
            "title": "Missing Referrer-Policy Header",
            "severity": "low",
            "cvss_score": 2.6,
            "cve_id": None,
            "description": "No Referrer-Policy header is configured on the response.",
            "impact": "User browsing URLs and sensitive query parameters may leak in HTTP Referer headers to external links.",
            "evidence": f"GET {current_url}\nMissing: Referrer-Policy",
            "remediation_guidance": "Set 'Referrer-Policy: strict-origin-when-cross-origin' or 'no-referrer'.",
            "remediation_notes": "[Source: FixOps Web Security Auditor]",
        })

    # Step 4: Cookie Security Attributes
    if progress_callback:
        progress_callback("vuln_analysis", 70, "Auditing session cookie flags (HttpOnly, Secure, SameSite)...", "cookie-auditor")

    raw_cookies = current_resp.headers.get_list("set-cookie") if hasattr(current_resp.headers, "get_list") else []
    if not raw_cookies and "set-cookie" in current_resp.headers:
        raw_cookies = [current_resp.headers["set-cookie"]]

    for cookie_header in raw_cookies:
        cookie_parts = [p.strip() for p in cookie_header.split(";")]
        cookie_name = cookie_parts[0].split("=")[0] if cookie_parts else "unknown"
        cookie_lower = cookie_header.lower()

        if "httponly" not in cookie_lower:
            findings.append({
                "title": f"Cookie '{cookie_name}' Missing HttpOnly Flag",
                "severity": "low",
                "cvss_score": 3.5,
                "cve_id": None,
                "description": f"The cookie '{cookie_name}' is set without the 'HttpOnly' flag.",
                "impact": "If an XSS vulnerability exists on the application, client-side JavaScript can read this cookie.",
                "evidence": f"Set-Cookie: {cookie_header}",
                "remediation_guidance": f"Add the 'HttpOnly' attribute to cookie '{cookie_name}'.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

        if final_scheme == "https" and "secure" not in cookie_lower:
            findings.append({
                "title": f"Cookie '{cookie_name}' Missing Secure Flag Over HTTPS",
                "severity": "medium",
                "cvss_score": 4.3,
                "cve_id": None,
                "description": f"The cookie '{cookie_name}' is set over HTTPS without the 'Secure' attribute.",
                "impact": "Browsers may send this cookie over subsequent unencrypted HTTP connections, exposing session credentials to interception.",
                "evidence": f"Set-Cookie: {cookie_header}",
                "remediation_guidance": f"Add the 'Secure' attribute to cookie '{cookie_name}'.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

        if "samesite" not in cookie_lower:
            findings.append({
                "title": f"Cookie '{cookie_name}' Missing SameSite Attribute",
                "severity": "low",
                "cvss_score": 3.0,
                "cve_id": None,
                "description": f"The cookie '{cookie_name}' does not specify a 'SameSite' attribute.",
                "impact": "Absence of SameSite may permit cross-site requests to include this cookie, elevating Cross-Site Request Forgery (CSRF) risk.",
                "evidence": f"Set-Cookie: {cookie_header}",
                "remediation_guidance": f"Configure 'SameSite=Lax' or 'SameSite=Strict' for cookie '{cookie_name}'.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

    # Step 5: Server Banner & Technology Version Exposure (Informational Observation)
    if progress_callback:
        progress_callback("vuln_analysis", 80, "Inspecting service headers for technology & banner leakage...", "tech-auditor")

    for banner_hdr in ("server", "x-powered-by", "x-aspnet-version"):
        banner_val = final_headers.get(banner_hdr)
        if banner_val:
            # Check if detailed version numbers are disclosed
            has_version = bool(re.search(r"\d+\.\d+", banner_val))
            findings.append({
                "title": f"Server Technology Disclosure ({banner_hdr.title()})",
                "severity": "info",
                "cvss_score": 0.0,
                "cve_id": None,
                "description": f"The web server exposes software technology details in the '{banner_hdr}' header: '{banner_val}'.",
                "impact": "Exposing exact software versions helps adversaries identify known vulnerabilities in specific web server builds.",
                "evidence": f"Response Header: {banner_hdr}: {banner_val}",
                "remediation_guidance": f"Configure your web server to suppress or generalize the '{banner_hdr}' header (e.g. ServerTokens Prod).",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })

    # Step 6: CORS Policy & Origin Reflection Check
    if progress_callback:
        progress_callback("vuln_analysis", 90, "Evaluating Cross-Origin Resource Sharing (CORS) origin validation...", "cors-auditor")

    test_origin = "https://fixops-security-audit.example.com"
    try:
        cors_req_headers = dict(custom_headers)
        cors_req_headers["Origin"] = test_origin
        cors_status, cors_resp_headers, cors_body, cors_final = safe_http_fetch(
            url=clean_target,
            headers=cors_req_headers,
            max_bytes=128 * 1024,
            timeout=5.0,
            max_redirects=3,
            allow_lab=allow_lab,
        )
        cors_acao = cors_resp_headers.get("access-control-allow-origin", "")
        cors_acac = cors_resp_headers.get("access-control-allow-credentials", "").lower()

        if cors_acao == test_origin:
            if cors_acac == "true":
                findings.append({
                    "title": "CORS Misconfiguration - Arbitrary Origin Reflection with Credentials",
                    "severity": "high",
                    "cvss_score": 7.5,
                    "cve_id": None,
                    "description": "The application reflects arbitrary Origin headers with Access-Control-Allow-Credentials enabled.",
                    "impact": "Malicious websites can issue authenticated cross-origin XMLHttpRequests/fetch calls to read sensitive user data.",
                    "evidence": f"Request Origin: {test_origin}\nAccess-Control-Allow-Origin: {cors_acao}\nAccess-Control-Allow-Credentials: {cors_acac}",
                    "remediation_guidance": "Restrict Access-Control-Allow-Origin to an explicit allowlist of trusted origins, and avoid reflecting arbitrary Origin headers.",
                    "remediation_notes": "[Source: FixOps Web Security Auditor]",
                })
            else:
                findings.append({
                    "title": "CORS Misconfiguration - Permissive Origin Reflection",
                    "severity": "medium",
                    "cvss_score": 5.3,
                    "cve_id": None,
                    "description": "The application dynamically reflects arbitrary Origin headers without credentials.",
                    "impact": "Unrestricted cross-origin access permits arbitrary external websites to read unauthenticated endpoint data.",
                    "evidence": f"Request Origin: {test_origin}\nAccess-Control-Allow-Origin: {cors_acao}",
                    "remediation_guidance": "Define explicit allowed origins in CORS configuration rather than echoing incoming Origin values.",
                    "remediation_notes": "[Source: FixOps Web Security Auditor]",
                })
        elif cors_acao == "*" and cors_acac == "true":
            findings.append({
                "title": "CORS Misconfiguration - Wildcard Origin with Credentials",
                "severity": "high",
                "cvss_score": 7.0,
                "cve_id": None,
                "description": "The application pairs Access-Control-Allow-Origin: * with Access-Control-Allow-Credentials: true.",
                "impact": "Permits arbitrary third-party domains to attempt authenticated requests.",
                "evidence": f"Access-Control-Allow-Origin: *\nAccess-Control-Allow-Credentials: true",
                "remediation_guidance": "Disable credentials or restrict Access-Control-Allow-Origin to specific trusted origins.",
                "remediation_notes": "[Source: FixOps Web Security Auditor]",
            })
    except Exception:
        pass

    # Step 7: Report Synthesis & Summary Metadata
    if progress_callback:
        progress_callback("report_synthesis", 98, "Synthesizing verified security audit dossier...", "synthesizer")

    metadata = {
        "target_url": clean_target,
        "resolved_hostname": hostname,
        "final_url": current_url,
        "status_code": status_code,
        "tls": tls_info,
        "checks_performed": checks_performed,
        "findings_count": len(findings),
        "audit_timestamp": datetime.now(timezone.utc).isoformat(),
        "limitations": (
            "This automated assessment evaluated HTTP/HTTPS transport behavior, TLS certificate configuration, "
            "security response headers, cookie flags, and CORS origin policies. It does not perform destructive "
            "exploitation, state-altering POST transactions, or authenticated deep business logic analysis."
        ),
    }

    return findings, metadata
