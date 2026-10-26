"""
Deliberately Vulnerable Lab Application for FixOps Testing.
Intended solely for sandboxed, local vulnerability assessment and verification.
DO NOT DEPLOY TO PRODUCTION OR PUBLIC NETWORKS.
"""

import sqlite3
import os
import urllib.request
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(
    title="FixOps Lab Target",
    description="Deliberately vulnerable test application for AI-assisted security assessment validation.",
    version="1.0.0",
)

DB_PATH = os.path.join(os.path.dirname(__file__), "lab_target.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            email TEXT,
            api_key TEXT,
            role TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            description TEXT,
            price REAL,
            stock INTEGER
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        cursor.execute(
            "INSERT INTO users (username, password, email, api_key, role) VALUES (?, ?, ?, ?, ?)",
            ("admin", "Admin#2026!Sec", "admin@fixops-lab.internal", "sec_k982348a7b1c4e90", "administrator"),
        )
        cursor.execute(
            "INSERT INTO users (username, password, email, api_key, role) VALUES (?, ?, ?, ?, ?)",
            ("jdoe", "P@ssword123", "jdoe@fixops-lab.internal", "sec_u1122334455667788", "standard_user"),
        )

    cursor.execute("SELECT COUNT(*) FROM products")
    if cursor.fetchone()[0] == 0:
        products = [
            ("Security Gateway Appliance", "Next-gen network protection unit", 1299.99, 15),
            ("Firewall Module", "Enterprise intrusion prevention filter", 450.00, 42),
            ("Encrypted Storage Node", "Tamper-proof hardware storage drive", 899.50, 8),
            ("Endpoint Sensor", "Host-based telemetry collector", 120.00, 150),
        ]
        cursor.executemany(
            "INSERT INTO products (name, description, price, stock) VALUES (?, ?, ?, ?)",
            products,
        )

    conn.commit()
    conn.close()


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/health")
def health_check():
    return {"status": "online", "target": "fixops-vulnerable-lab", "environment": "local_sandbox"}


# Vulnerability 1: SQL Injection (INJ) via string interpolation
@app.get("/api/products/search")
def search_products(q: str = Query("", description="Product search query")):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Deliberate SQL Injection flaw
    query = f"SELECT id, name, description, price, stock FROM products WHERE name LIKE '%{q}%'"
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        products = [
            {"id": r[0], "name": r[1], "description": r[2], "price": r[3], "stock": r[4]}
            for r in rows
        ]
        return {"query": q, "results_count": len(products), "items": products}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": "Database query error", "details": str(e)})
    finally:
        conn.close()


# Vulnerability 2: Broken Object Level Authorization (BOLA/IDOR)
@app.get("/api/users/{user_id}/profile")
def get_user_profile(user_id: int):
    # Deliberate authorization flaw: Missing authentication and tenant check
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email, api_key, role FROM users WHERE id = ?", (user_id,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="User profile not found")

    return {
        "id": user[0],
        "username": user[1],
        "email": user[2],
        "api_key": user[3],  # Sensitive information leakage
        "role": user[4],
    }


# Vulnerability 3: Server-Side Request Forgery (SSRF)
class WebhookRequest(BaseModel):
    callback_url: str


@app.post("/api/integrations/webhook-test")
def test_webhook(req: WebhookRequest):
    # Deliberate SSRF flaw: Unvalidated outbound HTTP request
    try:
        req_obj = urllib.request.Request(
            req.callback_url,
            headers={"User-Agent": "FixOps-Lab-Webhook-Validator/1.0"},
        )
        with urllib.request.urlopen(req_obj, timeout=3) as response:
            content = response.read(512).decode("utf-8", errors="replace")
            return {
                "status": "success",
                "http_status": response.status,
                "content_preview": content,
            }
    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"status": "error", "message": f"Failed to reach callback URL: {str(e)}"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8888)
