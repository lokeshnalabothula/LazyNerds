import pytest
from app.core.ai_provider import (
    parse_model_spec,
    resolve_provider_credentials,
    validate_ai_provider_preflight,
    sanitize_ai_error,
)


def test_parse_model_spec_valid():
    p, m = parse_model_spec("openai:gpt-4o-mini")
    assert p == "openai"
    assert m == "gpt-4o-mini"

    p, m = parse_model_spec("anthropic:claude-sonnet-4-6")
    assert p == "anthropic"
    assert m == "claude-sonnet-4-6"

    p, m = parse_model_spec("xai:grok-4")
    assert p == "xai"
    assert m == "grok-4"

    # Multi-colon preserved for Bedrock model IDs
    p, m = parse_model_spec("amazon-bedrock:us.anthropic.claude-opus-4-5:0")
    assert p == "amazon-bedrock"
    assert m == "us.anthropic.claude-opus-4-5:0"


def test_parse_model_spec_invalid():
    with pytest.raises(ValueError, match="format"):
        parse_model_spec("gpt-4o-mini")

    with pytest.raises(ValueError, match="Both provider and model ID must be non-empty"):
        parse_model_spec(":gpt-4o-mini")

    with pytest.raises(ValueError, match="Both provider and model ID must be non-empty"):
        parse_model_spec("openai:")

    with pytest.raises(ValueError, match="cannot be empty"):
        parse_model_spec("")


def test_resolve_provider_credentials_precedence():
    # 1. Curated provider variable takes precedence over generic SHANNON_AI_API_KEY
    env = {
        "OPENAI_API_KEY": "curated-openai-key-test",
        "SHANNON_AI_API_KEY": "generic-shannon-key-test",
        "SHANNON_AI_BASE_URL": "https://api.cheaperinference.com/v1/",
    }
    creds = resolve_provider_credentials("openai", env_override=env)
    assert creds["api_key"] == "curated-openai-key-test"
    assert creds["base_url"] == "https://api.cheaperinference.com/v1"

    # 2. When curated variable is absent, falls back to generic SHANNON_AI_API_KEY
    env_generic = {
        "SHANNON_AI_API_KEY": "generic-shannon-key-test",
        "SHANNON_AI_BASE_URL": "https://api.cheaperinference.com/v1",
    }
    creds_gen = resolve_provider_credentials("openai", env_override=env_generic)
    assert creds_gen["api_key"] == "generic-shannon-key-test"
    assert creds_gen["base_url"] == "https://api.cheaperinference.com/v1"


def test_missing_credentials_failure_message():
    env_empty = {
        "SHANNON_AI_MODEL": "openai:gpt-4o-mini",
        "SHANNON_AI_API_KEY": "",
        "OPENAI_API_KEY": "",
    }
    is_valid, msg = validate_ai_provider_preflight(env_override=env_empty)
    assert not is_valid
    assert "credentials for provider" in msg or "LLM provider credits" in msg
    assert "Lab Benchmark mode" in msg


def test_sanitize_ai_error_redaction():
    # Redacts live keys and tokens
    raw_error = "Failed to query https://api.cheaperinference.com/v1 with key ci_live_abcdef1234567890abcdef and Bearer eyJhbGciOiJIUzI1NiJ9.test"
    sanitized = sanitize_ai_error(raw_error)
    assert "ci_live_" not in sanitized
    assert "[REDACTED_API_KEY]" in sanitized
    assert "[REDACTED_TOKEN]" in sanitized


def test_insufficient_balance_error_normalization():
    # HTTP 402 with insufficient balance payload
    raw_402 = 'HTTP Error 402: {"error":{"message":"Insufficient wallet balance for this request.","type":"invalid_request_error","code":"insufficient_balance"}}'
    sanitized = sanitize_ai_error(raw_402)
    assert "Insufficient wallet balance" in sanitized
    assert "HTTP 402" in sanitized
    assert "Please fund your wallet or credits" in sanitized
    assert "invalid_request_error" not in sanitized


def test_cheaper_inference_config_resolution():
    env = {
        "SHANNON_AI_BASE_URL": "https://api.cheaperinference.com/v1",
        "SHANNON_AI_MODEL": "openai:gpt-4o-mini",
        "SHANNON_AI_API_KEY": "ci_live_mocktestkey1234567890123456",
    }
    is_valid, err = validate_ai_provider_preflight(env_override=env, verify_network=False)
    assert is_valid
    assert err is None
