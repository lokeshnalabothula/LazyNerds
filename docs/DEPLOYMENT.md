# LAZY NERDS FIXOPS — PRODUCTION DEPLOYMENT & OPERATIONS GUIDE

## 1. Production Architecture Overview

The recommended production deployment topology separates concerns into:
1. **Frontend Hosting:** Vercel, Cloudflare Pages, or AWS ECS/Amplify running Next.js 15.
2. **Backend Service:** Containerized FastAPI service running behind an HTTPS reverse proxy (e.g. AWS ECS, Render, Fly.io, or Railway).
3. **Database:** Managed PostgreSQL 16 (AWS RDS, Supabase, Neon, or DigitalOcean Managed Database) inside a private VPC network.

---

## 2. Environment Variables Checklist (Production)

| Variable | Recommended Production Value | Description |
|---|---|---|
| `ENVIRONMENT` | `production` | Disables public `/docs` and enables secure cookie enforcement |
| `SECRET_KEY` | Generated 64-char hex string (`openssl rand -hex 32`) | Secret key for JWT signing |
| `DATABASE_URL` | `postgresql+psycopg://<user>:<password>@<host>:5432/<db>?sslmode=require` | Managed PostgreSQL connection string |
| `ALLOWED_ORIGINS` | `["https://fixops.lazynerds.com"]` | Trusted frontend production origin |
| `INTERNAL_API_URL` | `https://api.fixops.lazynerds.com` | Backend URL for server-side Next.js rewrites |

---

## 3. Database Migration Deployment Workflow

Before booting new backend instances, apply Alembic migrations:
```bash
cd backend
DATABASE_URL="postgresql+psycopg://..." alembic upgrade head
```

---

## 4. Custom Domain & DNS Setup

To connect a custom domain (e.g., `fixops.lazynerds.com`):

1. **DNS Configuration:**
   - Configure a `CNAME` record pointing `fixops.lazynerds.com` to the frontend hosting target (e.g., `cname.vercel-dns.com`).
   - Configure an `A` or `CNAME` record pointing `api.fixops.lazynerds.com` to the backend load balancer.
2. **SSL / TLS Certificate:**
   - Ensure an automated Let's Encrypt or Cloudflare TLS certificate is provisioned with TLS 1.3 enforced.
3. **Verification:**
   - Verify HTTPS certificate validity:
     ```bash
     curl -I https://fixops.lazynerds.com
     curl -I https://api.fixops.lazynerds.com/api/v1/health
     ```

---

## 5. Backup & Disaster Recovery Strategy

1. **Automated Daily Backups:**
   - Enable automated point-in-time recovery (PITR) with a minimum 14-day retention window on the managed PostgreSQL database.
2. **Manual Snapshot Command:**
   ```bash
   pg_dump -U fixops_user -h db.fixops.lazynerds.com -Fc fixops_db > fixops_backup_$(date +%Y%m%d).dump
   ```
3. **Rollback Strategy:**
   - If a deployment introduces regressions, rollback frontend to previous static build artifact.
   - For backend database downgrades:
     ```bash
     alembic downgrade -1
     ```
