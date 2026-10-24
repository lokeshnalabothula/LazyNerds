# Shannon Integration: AGPL-3.0 Legal Compliance & Architecture Review

## 1. Executive Summary

Shannon is an autonomous AI penetration testing tool developed by KeygraphHQ and licensed under the **GNU Affero General Public License Version 3 (AGPL-3.0)**. 

This document outlines the legal compliance strategy, architectural boundaries, and operational guidelines for integrating Shannon into the Lazy Nerds FixOps platform without contaminating FixOps' proprietary intellectual property or violating open-source licensing terms.

---

## 2. AGPL-3.0 License Requirements & Analysis

### 2.1 The Remote Network Interaction Clause (Section 13)
The AGPL-3.0 introduces a specific requirement beyond standard GPL licenses:
> *"Notwithstanding any other provision of this License, if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network ... an opportunity to receive the Corresponding Source of your version..."*

### 2.2 FixOps Clean-Room Architectural Boundaries
To ensure full compliance without triggering copyleft inheritance across the Lazy Nerds FixOps codebase:

1. **Independent Subprocess Execution**:
   - FixOps does **not** link against, import, or compile Shannon code into any backend binary, module, or frontend package.
   - Shannon executes exclusively as an external, isolated Docker container (`keygraph/shannon:latest`) or standalone CLI subprocess.
2. **Standardized Data Interchange**:
   - FixOps communicates with the container via standard command-line flags (`shannon start -u <target> -r <repo> -o <output>`) and standardized open formats (**OASIS SARIF 2.1.0**).
   - Under standard FSF legal precedent, communication across operating system boundaries via command-line arguments and standard file formats constitutes two separate programs rather than a single derivative work.
3. **No Proprietary Shannon Forks**:
   - FixOps uses Shannon in its upstream, unmodified form.
   - If any customizations or bug fixes are applied to Shannon's internal engine in the future, those specific modifications must be published under AGPL-3.0 in an open repository.
4. **Transparent Attribution**:
   - Findings imported from Shannon clearly attribute the scanner engine (`[Source: Shannon AI Pentest (source-assisted)]`).
   - FixOps documentation discloses the use of Shannon and provides links to the upstream source repository: https://github.com/KeygraphHQ/shannon.git.

---

## 3. Configuration & Supported Environment Variables

Shannon supports frontier LLMs and compatible providers via standardized environment variables:

| Variable | Description |
|---|---|
| `SHANNON_AI_API_KEY` | Unified API key for Shannon AI engine |
| `XAI_API_KEY` | xAI Grok provider API key |
| `OPENAI_API_KEY` | OpenAI provider API key |
| `ANTHROPIC_API_KEY` | Anthropic Claude provider API key |
| `SHANNON_AI_MODEL` | Target model identifier (e.g. `grok-2`, `claude-3-7-sonnet`, `gpt-4o`) |
| `SHANNON_AI_BASE_URL` | Optional custom base URL for OpenAI-compatible gateways |

### Provider Guard:
- When LLM credits are unavailable, FixOps worker explicitly refuses to start a live AI pentest and returns an informative blocker:
  ```
  AI Penetration Testing requires configured LLM provider credits (e.g. xAI Grok, OpenAI, or Anthropic).
  No valid AI credits configured on worker. Live scan cannot proceed without an active AI provider.
  Use Lab Benchmark mode for offline verification.
  ```
- **Zero Fabrication**: Simulated findings from the local lab suite are always prefixed with `[LAB BENCHMARK]` and marked `verification_pending`. Real scans only report verified findings.

---

## 4. Compliance Checklist for Production Deployment

- [x] Unmodified Shannon container image used (`keygraph/shannon:latest`).
- [x] Zero Shannon source code linked into FixOps proprietary backend.
- [x] Decoupled process boundary via Docker and SARIF 2.1.0 JSON deliverables.
- [x] Upstream source attribution documented.
- [x] Offline lab benchmark clearly separated from live AI pentests.
- [x] Secrets and API keys excluded from version control and Git history.
