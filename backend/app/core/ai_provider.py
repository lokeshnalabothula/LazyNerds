"""
Lazy Nerds FixOps — AI Provider Configuration & Preflight Validation
=====================================================================
Unified resolver for Shannon AI engine and LLM provider configurations.
Supports frontier providers (OpenAI, Anthropic, xAI) and OpenAI-compatible
inference gateways (e.g. Cheaper Inference, Databricks AI Gateway, OpenRouter).

Invariants:
1. Strict credential precedence: Provider-specific var > Generic SHANNON_AI_API_KEY.
2. Endpoint override: SHANNON_AI_BASE_URL applied uniformly across OpenAI-compatible providers.
3. Cost guard: Preflights validate configuration and free metadata endpoints only (never calls paid completions).
4. Truthful failure: Fast-fails with actionable diagnostic on HTTP 402 (insufficient balance) or missing keys.
5. Zero leakage: Secrets are never logged, formatted, or exposed in audit trails.
"""

import json
import logging
import os
import re
import urllib.parse
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger("fixops.ai_provider")

CURATED_PROVIDERS = ("anthropic", "openai", "xai", "amazon-bedrock")

PROVIDER_API_KEY_ENV = {
    "anthropic": ["ANTHROPIC_API_KEY", "CLAUDE_CODE_OAUTH_TOKEN"],
    "openai": ["OPENAI_API_KEY"],
    "xai": ["XAI_API_KEY"],
    "amazon-bedrock": ["AWS_BEARER_TOKEN_BEDROCK"],
}

GENERIC_API_KEY_ENV = "SHANNON_AI_API_KEY"
DEFAULT_MODEL_SPEC = "anthropic:claude-sonnet-4-6"


def parse_model_spec(spec: str) -> Tuple[str, str]:
    """
    Parses `<provider>:<model-id>` spec.
    Splits on the first colon to allow colons in Bedrock/router model IDs.
    Raises ValueError on malformed specification.
    """
    if not spec or not isinstance(spec, str):
        raise ValueError(f"SHANNON_AI_MODEL cannot be empty. Example: '{DEFAULT_MODEL_SPEC}'")

    trimmed = spec.strip()
    colon_idx = trimmed.find(":")
    if colon_idx == -1:
        raise ValueError(
            f"Invalid SHANNON_AI_MODEL format '{trimmed}'. Must be '<provider>:<model-id>' (e.g. 'openai:gpt-4o-mini')."
        )

    provider_id = trimmed[:colon_idx].strip()
    model_id = trimmed[colon_idx + 1:].strip()

    if not provider_id or not model_id:
        raise ValueError(
            f"Malformed SHANNON_AI_MODEL '{trimmed}'. Both provider and model ID must be non-empty."
        )

    return provider_id, model_id


def resolve_provider_credentials(
    provider_id: str,
    env_override: Optional[Dict[str, str]] = None,
) -> Dict[str, Optional[str]]:
    """
    Collects API key and optional endpoint override for the target provider.
    Precedence:
    1. Provider-specific variable (e.g. OPENAI_API_KEY)
    2. Generic SHANNON_AI_API_KEY (if provider is not amazon-bedrock)
    3. Endpoint override: SHANNON_AI_BASE_URL
    """
    env = env_override if env_override is not None else os.environ

    api_key = None
    named_vars = PROVIDER_API_KEY_ENV.get(provider_id, [])
    for var in named_vars:
        val = env.get(var)
        if val and val.strip():
            api_key = val.strip()
            break

    if not api_key and provider_id != "amazon-bedrock":
        gen_val = env.get(GENERIC_API_KEY_ENV)
        if gen_val and gen_val.strip():
            api_key = gen_val.strip()

    base_url = env.get("SHANNON_AI_BASE_URL")
    if base_url:
        base_url = base_url.strip().rstrip("/")

    return {
        "provider_id": provider_id,
        "api_key": api_key,
        "base_url": base_url,
    }


def validate_ai_provider_preflight(
    env_override: Optional[Dict[str, str]] = None,
    verify_network: bool = False,
) -> Tuple[bool, Optional[str]]:
    """
    Performs safe preflight verification of AI provider configuration without
    invoking paid completion requests.
    Returns (is_valid, error_message).
    """
    env = env_override if env_override is not None else os.environ
    raw_model = env.get("SHANNON_AI_MODEL", DEFAULT_MODEL_SPEC)

    try:
        provider_id, model_id = parse_model_spec(raw_model)
    except ValueError as e:
        return False, str(e)

    creds = resolve_provider_credentials(provider_id, env_override=env)
    api_key = creds["api_key"]
    base_url = creds["base_url"]

    if not api_key and provider_id != "amazon-bedrock":
        primary_hint = PROVIDER_API_KEY_ENV.get(provider_id, [GENERIC_API_KEY_ENV])[0]
        return False, (
            f"AI Penetration Testing requires configured LLM provider credits or credentials for provider '{provider_id}'. "
            f"No valid AI credits configured on worker. Set {primary_hint} or {GENERIC_API_KEY_ENV} in your environment. "
            "Use Lab Benchmark mode for offline verification without an active AI provider."
        )

    if base_url:
        try:
            parsed = urllib.parse.urlparse(base_url)
            if parsed.scheme.lower() not in ("http", "https"):
                return False, f"Invalid SHANNON_AI_BASE_URL scheme '{parsed.scheme}'. Must be http or https."
            if not parsed.hostname:
                return False, "Invalid SHANNON_AI_BASE_URL: missing host."
        except Exception:
            return False, "Malformed SHANNON_AI_BASE_URL."

        # Optional zero-cost network check: query /models (free GET endpoint)
        if verify_network and api_key:
            models_url = f"{base_url}/models"
            req = urllib.request.Request(
                models_url,
                headers={"Authorization": f"Bearer {api_key}", "User-Agent": "FixOps-AI-Preflight/1.0"},
            )
            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    if resp.status != 200:
                        return False, f"AI gateway returned HTTP {resp.status} on /models endpoint."
            except urllib.error.HTTPError as e:
                if e.code == 401:
                    return False, "AI provider rejected credentials: HTTP 401 Unauthorized."
                elif e.code == 402:
                    return False, (
                        "AI provider billing error: Insufficient wallet balance (HTTP 402). "
                        "Please fund your wallet/credits on your AI provider dashboard."
                    )
                elif e.code == 403:
                    return False, "AI provider access forbidden: HTTP 403 Forbidden."
            except Exception as ex:
                logger.debug(f"Free /models probe skipped/failed: {ex}")

    return True, None


def sanitize_ai_error(raw_error_message: str, secret_patterns: Optional[List[str]] = None) -> str:
    """
    Sanitizes AI provider error messages before logging or storing in database records.
    Redacts keys, bearer tokens, and maps raw error codes (such as HTTP 402) into clear prose.
    """
    if not raw_error_message:
        return "Unknown AI provider error."

    cleaned = raw_error_message

    # Redact common token patterns: sk-..., ci_live_..., xai-..., freellmapi-..., etc.
    cleaned = re.sub(r"(ci_live_[a-zA-Z0-9_\-]{16,})", "[REDACTED_API_KEY]", cleaned)
    cleaned = re.sub(r"(sk-[a-zA-Z0-9_\-]{16,})", "[REDACTED_API_KEY]", cleaned)
    cleaned = re.sub(r"(xai-[a-zA-Z0-9_\-]{16,})", "[REDACTED_API_KEY]", cleaned)
    cleaned = re.sub(r"(freellmapi-[a-zA-Z0-9_\-]{16,})", "[REDACTED_API_KEY]", cleaned)
    cleaned = re.sub(r"(Bearer\s+)[a-zA-Z0-9_\-\.]{16,}", r"\1[REDACTED_TOKEN]", cleaned)

    if secret_patterns:
        for s in secret_patterns:
            if s and len(s) >= 8:
                cleaned = cleaned.replace(s, "[REDACTED]")

    # Normalize known provider billing errors
    if "insufficient_balance" in cleaned or "402" in cleaned:
        return (
            "AI provider billing error: Insufficient wallet balance on provider (HTTP 402). "
            "Please fund your wallet or credits on your provider dashboard before running live assessments."
        )

    if "invalid_api_key" in cleaned or "incorrect_api_key" in cleaned or "401" in cleaned:
        return "AI provider authentication failed: Invalid or expired API key (HTTP 401)."

    return cleaned
