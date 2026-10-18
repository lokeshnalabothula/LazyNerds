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
      background-color: #0b1120;
      color: #e2e8f0;
      font-family: Arial, Helvetica, sans-serif;
      -webkit-font-smoothing: antialiased;
    }}
    table {{
      border-collapse: collapse;
    }}
    .wrapper {{
      width: 100%;
      table-layout: fixed;
      background-color: #0b1120;
      padding: 40px 16px;
    }}
    .container {{
      max-width: 560px;
      margin: 0 auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 8px;
      overflow: hidden;
    }}
    .header {{
      background-color: #0a1128;
      padding: 32px 32px 24px;
      text-align: center;
      border-bottom: 1px solid #1e293b;
    }}
    .brand-title {{
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #ffffff;
      text-transform: uppercase;
      margin: 0 0 6px 0;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .brand-sub {{
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .content {{
      padding: 32px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.6;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .greeting {{
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
      margin-bottom: 16px;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .btn-container {{
      text-align: center;
      margin: 32px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      padding: 13px 32px;
      border-radius: 6px;
      letter-spacing: 0.02em;
      font-family: Arial, Helvetica, sans-serif;
      border: 1px solid #1d4ed8;
    }}
    .notice-box {{
      background-color: #0b1329;
      border: 1px solid #1e293b;
      border-left: 3px solid #2563eb;
      padding: 14px 16px;
      margin: 24px 0;
      border-radius: 4px;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .notice-box strong {{
      color: #f1f5f9;
    }}
    .fallback-url {{
      word-break: break-all;
      color: #60a5fa;
      font-size: 12px;
      text-decoration: underline;
      font-family: Arial, Helvetica, sans-serif;
    }}
    .footer {{
      padding: 24px 32px;
      background-color: #080d1a;
      border-top: 1px solid #1e293b;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
      font-family: Arial, Helvetica, sans-serif;
    }}
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0b1120;color:#e2e8f0;font-family:Arial,Helvetica,sans-serif;">
  <div class="wrapper" style="width:100%;table-layout:fixed;background-color:#0b1120;padding:40px 16px;box-sizing:border-box;">
    <div class="container" style="max-width:560px;margin:0 auto;background-color:#0f172a;border:1px solid #1e293b;border-radius:8px;overflow:hidden;">
      <div class="header" style="background-color:#0a1128;padding:32px 32px 24px;text-align:center;border-bottom:1px solid #1e293b;">
        <div class="brand-title" style="font-size:18px;font-weight:700;letter-spacing:0.08em;color:#ffffff;text-transform:uppercase;margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;">Lazy Nerds FixOps</div>
        <p class="brand-sub" style="font-size:12px;color:#94a3b8;margin:0;letter-spacing:0.05em;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">Security Operations &amp; Vulnerability Remediation</p>
      </div>
      <div class="content" style="padding:32px;color:#cbd5e1;font-size:14px;line-height:1.6;font-family:Arial,Helvetica,sans-serif;">
        <div class="greeting" style="font-size:16px;font-weight:600;color:#f8fafc;margin-bottom:16px;font-family:Arial,Helvetica,sans-serif;">Hello {display_name},</div>
        <p style="margin:0 0 16px 0;color:#cbd5e1;">We received an authorized password recovery request for your Lazy Nerds FixOps account associated with <strong style="color:#f8fafc;">{to_email}</strong>.</p>
        <p style="margin:0 0 24px 0;color:#cbd5e1;">Click the button below to choose a new password. For security purposes, this recovery link will expire in <strong style="color:#ffffff;">30 minutes</strong> and can only be used once.</p>
        
        <div class="btn-container" style="text-align:center;margin:32px 0;">
          <a href="{reset_url}" class="btn" target="_blank" rel="noopener noreferrer" style="display:inline-block;background-color:#2563eb;color:#ffffff !important;text-decoration:none;font-weight:600;font-size:14px;padding:13px 32px;border-radius:6px;letter-spacing:0.02em;font-family:Arial,Helvetica,sans-serif;border:1px solid #1d4ed8;">Reset Your Password</a>
        </div>

        <div class="notice-box" style="background-color:#0b1329;border:1px solid #1e293b;border-left:3px solid #2563eb;padding:14px 16px;margin:24px 0;border-radius:4px;font-size:12px;color:#94a3b8;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
          <strong style="color:#f1f5f9;">Security Advisory:</strong> If you did not initiate this request, you can safely disregard this email. Your current password remains active and no changes will be made to your account.
        </div>

        <p style="font-size:12px;color:#94a3b8;margin:24px 0 8px 0;font-family:Arial,Helvetica,sans-serif;">
          If the button above does not work in your email client, copy and paste this URL into your browser:
        </p>
        <p style="margin:0;word-break:break-all;">
          <a href="{reset_url}" class="fallback-url" style="word-break:break-all;color:#60a5fa;font-size:12px;text-decoration:underline;font-family:Arial,Helvetica,sans-serif;">{reset_url}</a>
        </p>
      </div>
      <div class="footer" style="padding:24px 32px;background-color:#080d1a;border-top:1px solid #1e293b;text-align:center;font-size:11px;color:#64748b;line-height:1.5;font-family:Arial,Helvetica,sans-serif;">
        Lazy Nerds FixOps &bull; Autonomous Security Operations<br>
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

We received an authorized password recovery request for your Lazy Nerds FixOps account ({to_email}).

To set a new password, visit the following URL:
{reset_url}

Security Notes:
- This link is single-use and expires in 30 minutes.
- If you did not initiate this request, you can safely disregard this email. Your current password remains secure.

--
Lazy Nerds FixOps
Autonomous Security Operations & Vulnerability Remediation
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

    # In production, mock dispatch must not silently pretend live delivery occurred
    if settings.ENVIRONMENT == "production" and provider not in ("resend", "smtp"):
        err_msg = "Email delivery service is unconfigured in production. RESEND_API_KEY or SMTP credentials are required."
        logger.error(f"[EMAIL SERVICE CONFIG ERROR] {err_msg}")
        return {
            "success": False,
            "provider": "unconfigured",
            "message_id": None,
            "error": err_msg,
            "simulated": False,
        }

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
