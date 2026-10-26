# FixOps Deliberately Vulnerable Lab Application

A lightweight, local educational testbed target designed to safely validate automated security assessments without testing unauthorized public systems.

## Purpose
This application simulates a typical web service with known, controlled security vulnerabilities for verification with **Shannon (Source-Assisted AI Pentest)** and the **FixOps Scanner Engine**:
1. **SQL Injection (`/api/products/search?q=`)**: Unsanitized input concatenation into raw SQLite query.
2. **Broken Object-Level Authorization (`/api/users/{id}/profile`)**: Unauthenticated endpoint returning private profile details and API keys.
3. **Server-Side Request Forgery (`/api/integrations/webhook-test`)**: Unchecked outbound HTTP fetch of user-supplied URL.

## Starting the Lab Locally
Using the backend virtual environment:
```bash
./backend/.venv/bin/python lab/vulnerable_app/main.py
```
Default URL: `http://127.0.0.1:8888`
Health Check: `http://127.0.0.1:8888/health`
