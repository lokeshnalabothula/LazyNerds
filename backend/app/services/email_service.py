import email.mime.multipart
import email.mime.text
import logging
import smtplib
import ssl
from typing import Any, Dict, Optional
import httpx

from app.core.config import settings

logger = logging.getLogger("fixops.email_service")


def get_active_email_provider() -> str:
    """
    Determines the active email provider based on configuration:
    - Explicit settings.EMAIL_PROVIDER if set to 'resend', 'smtp', or 'mock'.
    - If 'auto': checks for RESEND_API_KEY first, then SMTP_HOST, otherwise 'mock'.
    """
    configured = (settings.EMAIL_PROVIDER or "auto").strip().lower()
    if configured in ("resend", "smtp", "mock"):
        return configured

    if settings.RESEND_API_KEY:
        return "resend"
    if settings.SMTP_HOST:
        return "smtp"
    return "mock"


def build_password_reset_html(recipient_name: str, to_email: str, reset_url: str) -> str:
    """Generates a professional, branded HTML template for password reset."""
    display_name = recipient_name.strip() if recipient_name else "FixOps Operator"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password - Lazy Nerds FixOps</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: #09090b;
      color: #f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #09090b;
      padding: 40px 16px;
    }}
    .container {{
      max-width: 560px;
      margin: 0 auto;
      background-color: #121215;
      border: 1px solid #27272a;
      border-radius: 12px;
      overflow: hidden;
    }}
    .header {{
      background: linear-gradient(180deg, #18181b 0%, #121215 100%);
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #27272a;
    }}
    .brand-title {{
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #10b981;
      text-transform: uppercase;
      margin: 0 0 6px 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }}
    .brand-sub {{
      font-size: 13px;
      color: #a1a1aa;
      margin: 0;
    }}
    .content {{
      padding: 32px;
      color: #d4d4d8;
      font-size: 14px;
      line-height: 1.6;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 600;
      color: #fafafa;
      margin-bottom: 16px;
    }}
    .btn-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #10b981;
      color: #000000 !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 28px;
      border-radius: 6px;
      letter-spacing: 0.02em;
    }}
    .notice-box {{
      background-color: #18181b;
      border-left: 3px solid #10b981;
      padding: 14px 16px;
      margin: 24px 0;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
      color: #a1a1aa;
    }}
    .notice-box strong {{
      color: #f4f4f5;
    }}
    .fallback-url {{
      word-break: break-all;
      color: #38bdf8;
      font-size: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }}
    .footer {{
      padding: 24px 32px;
      background-color: #0c0c0e;
      border-top: 1px solid #27272a;
      text-align: center;
      font-size: 11px;
      color: #71717a;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="brand-title">Lazy Nerds FixOps</div>
        <p class="brand-sub">Security Operations & Vulnerability Remediation</p>
      </div>
      <div class="content">
        <div class="greeting">Hello {display_name},</div>
        <p>We received an authorized password recovery request for your Lazy Nerds FixOps account associated with <strong style="color: #fafafa;">{to_email}</strong>.</p>
        <p>Click the button below to choose a new password. For security purposes, this recovery link will expire in <strong>30 minutes</strong> and can only be used once.</p>
        
        <div class="btn-container">
          <a href="{reset_url}" class="btn" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
        </div>

        <div class="notice-box">
          <strong>Security Advisory:</strong> If you did not initiate this request, you can safely disregard this email. Your current password remains active and no changes will be made to your account.
        </div>

        <p style="font-size: 12px; color: #a1a1aa; margin-top: 24px;">
          If the button above does not work in your email client, copy and paste this URL into your browser:
        </p>
        <p class="fallback-url">{reset_url}</p>
      </div>
      <div class="footer">
        Lazy Nerds FixOps Client Manager &bull; Autonomous Security Operations<br>
        Confidential security advisory sent to authorized user {to_email}
      </div>
    </div>
  </div>
</body>
</html>"""


def build_password_reset_plaintext(recipient_name: str, to_email: str, reset_url: str) -> str:
    """Generates plain text content for email clients that do not render HTML."""
    display_name = recipient_name.strip() if recipient_name else "FixOps Operator"
    return f"""LAZY NERDS FIXOPS — SECURITY OPERATIONS
Password Recovery Request

Hello {display_name},

We received a password reset request for your account ({to_email}).

To set a new password, visit the following URL:
{reset_url}

Security Notes:
- This link is single-use and expires in 30 minutes.
- If you did not request this change, please disregard this message. Your current password remains secure.

--
Lazy Nerds FixOps
Autonomous Cybersecurity & Remediation Foundation
"""


def _send_via_resend(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> Dict[str, Any]:
    """Sends email via the Resend REST API."""
    if not settings.RESEND_API_KEY:
        raise ValueError("RESEND_API_KEY is not configured.")

    payload = {
        "from": settings.EMAIL_FROM,
        "to": [to_email],
        "subject": subject,
        "html": html_content,
        "text": text_content,
    }

    headers = {
        "Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=10.0) as client:
        response = client.post("https://api.resend.com/emails", json=payload, headers=headers)
        if response.status_code in (200, 201):
            data = response.json()
            logger.info(f"Email successfully dispatched via Resend to {to_email}. ID: {data.get('id')}")
            return {
                "success": True,
                "provider": "resend",
                "message_id": data.get("id"),
                "error": None,
            }
        else:
            err_msg = f"Resend API error {response.status_code}: {response.text}"
            logger.error(err_msg)
            return {
                "success": False,
                "provider": "resend",
                "message_id": None,
                "error": err_msg,
            }


def _send_via_smtp(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> Dict[str, Any]:
    """Sends email via standard SMTP (supports STARTTLS and SSL)."""
    if not settings.SMTP_HOST:
        raise ValueError("SMTP_HOST is not configured.")

    msg = email.mime.multipart.MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.EMAIL_FROM
    msg["To"] = to_email

    part1 = email.mime.text.MIMEText(text_content, "plain", "utf-8")
    part2 = email.mime.text.MIMEText(html_content, "html", "utf-8")
    msg.attach(part1)
    msg.attach(part2)

    try:
        if settings.SMTP_SSL:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context, timeout=10.0) as server:
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0) as server:
                if settings.SMTP_TLS:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM, [to_email], msg.as_string())

        logger.info(f"Email successfully dispatched via SMTP to {to_email}")
        return {
            "success": True,
            "provider": "smtp",
            "message_id": None,
            "error": None,
        }
    except Exception as e:
        err_msg = f"SMTP transmission failed: {str(e)}"
        logger.error(err_msg)
        return {
            "success": False,
            "provider": "smtp",
            "message_id": None,
            "error": err_msg,
        }


def _send_mock(
    to_email: str,
    subject: str,
    html_content: str,
    text_content: str,
) -> Dict[str, Any]:
    """
    Mock dispatcher for development or when live provider credentials are not yet supplied.
    Logs dispatch details safely without failing.
    """
    logger.info(
        f"[MOCK EMAIL DISPATCH] Recipient='{to_email}' Subject='{subject}' "
        f"LengthHTML={len(html_content)} LengthText={len(text_content)}"
    )
    return {
        "success": True,
        "provider": "mock",
        "message_id": f"mock-{to_email}",
        "error": None,
        "simulated": True,
    }


def send_password_reset_email(
    to_email: str,
    recipient_name: str,
    reset_url: str,
) -> Dict[str, Any]:
    """
    Dispatches a branded password reset email to the specified user.
    Auto-detects whether to use Resend, SMTP, or Mock provider.
    Never throws unhandled exceptions to the caller.
    """
    subject = "Reset your Lazy Nerds FixOps password"
    html_content = build_password_reset_html(recipient_name, to_email, reset_url)
    text_content = build_password_reset_plaintext(recipient_name, to_email, reset_url)

    provider = get_active_email_provider()

    try:
        if provider == "resend":
            return _send_via_resend(to_email, subject, html_content, text_content)
        elif provider == "smtp":
            return _send_via_smtp(to_email, subject, html_content, text_content)
        else:
            return _send_mock(to_email, subject, html_content, text_content)
    except Exception as e:
        logger.exception(f"Unexpected error in email dispatch to {to_email}: {e}")
        return {
            "success": False,
            "provider": provider,
            "message_id": None,
            "error": str(e),
        }
