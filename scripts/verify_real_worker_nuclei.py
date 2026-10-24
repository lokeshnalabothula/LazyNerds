#!/usr/bin/env python3
"""
End-to-End Real Nuclei Worker Execution Verification
====================================================
Tests the full decoupled architecture:
1. Web API queues assessment with status="queued".
2. Standalone worker daemon claims the job.
3. Real Nuclei container executes against the authorized local lab (http://host.docker.internal:8888).
4. Telemetry and findings are ingested and verified in FixOps database.
"""

import json
import os
import signal
import subprocess
import sys
import time
import urllib.request
import urllib.error

API_URL = "http://127.0.0.1:8000/api/v1"
WORKER_TOKEN = "fixops_worker_secret_token_dev_2026"
FOUNDER_EMAIL = "lokeshnalabothula@gmail.com"
FOUNDER_PW = "12345678"

def api_call(url: str, method: str = "GET", data=None, token=None, worker_token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if worker_token:
        headers["X-Worker-Token"] = worker_token

    encoded = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=encoded, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        print(f"[-] HTTP {e.code} on {method} {url}: {err}")
        raise

def main():
    print("=================================================================")
    print("FixOps Decoupled Worker: Real Nuclei Verification against Lab")
    print("=================================================================")

    # 1. Start uvicorn server in background if not already up
    server_proc = None
    try:
        api_call("http://127.0.0.1:8000/api/v1/health")
        print("[+] Backend API is already running on port 8000.")
    except Exception:
        print("[*] Starting backend Uvicorn server on port 8000...")
        env = os.environ.copy()
        env["PYTHONPATH"] = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
        env["WORKER_DISPATCH_MODE"] = "distributed"
        env["ALLOW_LAB_TESTING"] = "true"
        server_proc = subprocess.Popen(
            ["./backend/.venv/bin/uvicorn", "app.main:app", "--port", "8000", "--host", "127.0.0.1"],
            cwd=os.path.abspath(os.path.join(os.path.dirname(__file__), "..")),
            env=env,
        )
        # Wait up to 15 seconds for server to be responsive
        ready = False
        for _ in range(15):
            time.sleep(1)
            try:
                api_call("http://127.0.0.1:8000/api/v1/health")
                ready = True
                break
            except Exception:
                pass
        if not ready:
            raise RuntimeError("Backend Uvicorn server failed to start within 15 seconds.")
        print("[+] Backend API is online.")

    try:
        # 2. Authenticate as Founder
        print("[*] Authenticating with backend API...")
        login_res = api_call(
            f"{API_URL}/auth/login",
            method="POST",
            data={"email": FOUNDER_EMAIL, "password": FOUNDER_PW},
        )
        token = login_res["access_token"]
        print(f"[+] Authenticated successfully as {login_res['user']['email']}.")

        # 3. Get or create Client, Engagement, and Target Asset
        print("[*] Ensuring target asset is registered and verified...")
        clients = api_call(f"{API_URL}/clients", token=token)
        items = clients.get("items", [])
        if not items:
            client = api_call(
                f"{API_URL}/clients",
                method="POST",
                data={
                    "company_name": "Local Security Lab Client",
                    "primary_contact_name": "Lab Admin",
                    "primary_contact_email": "admin@lab.local",
                },
                token=token,
            )
        else:
            client = items[0]
        client_id = client["id"]

        engagements = api_call(f"{API_URL}/engagements", token=token)
        eng_items = engagements.get("items", [])
        active_eng = None
        for e in eng_items:
            if e.get("authorization_status") == "confirmed" and e.get("status") in ("in_progress", "planned"):
                active_eng = e
                break

        if not active_eng:
            active_eng = api_call(
                f"{API_URL}/engagements",
                method="POST",
                data={
                    "client_id": client_id,
                    "name": "Local Lab Penetration Test",
                    "assessment_type": "web_application",
                    "status": "in_progress",
                    "authorization_status": "confirmed",
                },
                token=token,
            )
        eng_id = active_eng["id"]

        assets = api_call(f"{API_URL}/assets?engagement_id={eng_id}", token=token)
        target_asset = None
        for a in assets.get("items", []):
            if "8888" in a.get("target", "") and a.get("in_scope") and a.get("authorization_status") == "verified":
                target_asset = a
                break

        if not target_asset:
            target_asset = api_call(
                f"{API_URL}/assets",
                method="POST",
                data={
                    "client_id": client_id,
                    "engagement_id": eng_id,
                    "name": "Local Vulnerable Lab API",
                    "target": "http://127.0.0.1:8888",
                    "asset_type": "web_application",
                    "in_scope": True,
                    "authorization_status": "verified",
                },
                token=token,
            )
        asset_id = target_asset["id"]
        print(f"[+] Verified in-scope asset: {target_asset['name']} ({target_asset['target']})")

        # 4. Launch Black-Box Scan via Web API
        print("[*] Launching black-box scan via FixOps API...")
        launch_res = api_call(
            f"{API_URL}/findings/launch-scan",
            method="POST",
            data={
                "engagement_id": eng_id,
                "target_asset_id": asset_id,
                "scan_mode": "blackbox",
            },
            token=token,
        )
        assessment_id = launch_res["id"]
        status = launch_res["status"]
        print(f"[+] Scan queued! Assessment ID: {assessment_id}, Status: {status}")
        assert status == "queued", f"Expected queued status, got {status}"

        # 5. Execute Worker Processing
        print("[*] Invoking FixOps Worker daemon cycle...")
        env_worker = os.environ.copy()
        env_worker["FIXOPS_API_URL"] = API_URL
        env_worker["FIXOPS_WORKER_TOKEN"] = WORKER_TOKEN
        env_worker["ALLOW_LAB_TESTING"] = "true"

        # Import and run worker directly in Python
        sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "worker")))
        import fixops_worker

        # Verify pending jobs
        pending = api_call(f"{API_URL}/workers/jobs/pending", worker_token=WORKER_TOKEN)
        pending_ids = [j["id"] for j in pending.get("jobs", [])]
        print(f"[+] Worker sees {len(pending_ids)} pending job(s): {pending_ids}")
        assert assessment_id in pending_ids

        # Claim the job
        claimed = api_call(
            f"{API_URL}/workers/jobs/{assessment_id}/claim",
            method="POST",
            data={"worker_id": "test-verifier-worker"},
            worker_token=WORKER_TOKEN,
        )
        print(f"[+] Worker claimed job {assessment_id} (target: {claimed.get('target_url')})")

        # Process real Nuclei scan
        print("[*] Running real Nuclei container against local vulnerable lab...")
        fixops_worker.WORKER_ID = "test-verifier-worker"
        fixops_worker.API_URL = API_URL
        fixops_worker.WORKER_TOKEN = WORKER_TOKEN
        fixops_worker.ALLOW_LAB_TESTING = True
        fixops_worker.process_job(claimed)

        # 6. Verify Assessment Completion in Database
        print("[*] Verifying assessment completion and ingested findings...")
        final_assessment = api_call(f"{API_URL}/findings/assessments/{assessment_id}", token=token)
        print(f"[+] Final Assessment Status: {final_assessment['status']}")
        print(f"[+] Findings Ingested: {final_assessment['findings_count']}")

        assert final_assessment["status"] == "completed", f"Assessment status is {final_assessment['status']}"
        assert final_assessment["findings_count"] >= 1, "Expected at least 1 finding ingested from Nuclei"

        summary = json.loads(final_assessment["execution_summary"])
        print(f"[+] Assessment Phase: {summary.get('phase')}")
        print(f"[+] Telemetry Logs Recorded: {len(summary.get('logs', []))} entries")

        print("=================================================================")
        print("SUCCESS: Real Nuclei container executed on worker and ingested!")
        print("=================================================================")

    finally:
        if server_proc:
            print("[*] Stopping local Uvicorn server...")
            server_proc.send_signal(signal.SIGTERM)
            server_proc.wait()

if __name__ == "__main__":
    main()
