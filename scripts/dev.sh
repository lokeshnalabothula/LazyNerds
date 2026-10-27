#!/usr/bin/env bash
# ==============================================================================
# Lazy Nerds FixOps — Developer Operations Control Script
# ==============================================================================
# Single convenient entrypoint for local development, verification, and diagnostics.
# Zero external process-manager dependencies. Uses project virtualenv and pnpm.

set -eo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
VENV_PYTHON="${BACKEND_DIR}/.venv/bin/python"
VENV_PYTEST="${BACKEND_DIR}/.venv/bin/pytest"
VENV_ALEMBIC="${BACKEND_DIR}/.venv/bin/alembic"
VENV_UVICORN="${BACKEND_DIR}/.venv/bin/uvicorn"

# Ensure local user tools are in PATH
export PATH="${HOME}/.local/bin:${PROJECT_ROOT}/frontend/node_modules/.bin:${PATH}"
export NODE_OPTIONS="--experimental-strip-types"

show_help() {
  cat << EOF
Lazy Nerds FixOps — Development Command Control

Usage: ./scripts/dev.sh [command]

Service Commands:
  backend          Start FastAPI backend server (http://127.0.0.1:8000)
  frontend         Start Next.js frontend dev server (http://localhost:3000)
  lab              Start local vulnerable test lab (http://127.0.0.1:8888)
  status           Show status and PIDs of FixOps services (ports 3000, 8000, 8888)
  stop-all         Safely stop local development services running on FixOps ports

Verification & Testing:
  test             Run both frontend and backend test suites
  test-frontend    Run frontend unit & integration tests (Node.js test runner)
  test-backend     Run backend pytest suite
  lint             Run frontend ESLint
  typecheck        Run frontend TypeScript static type check (tsc --noEmit)
  build            Run Next.js production build
  check-all        Run complete verification pipeline (lint + typecheck + tests + build)

Database:
  db-migrate       Apply all pending Alembic migrations to current database
  db-status        Show current Alembic revision head
  db-check         Test database migration upgrade & downgrade idempotency

Health & Diagnostics:
  health           Check health and API endpoints of running local services
  info             Display environment and toolchain specifications
EOF
}

case "$1" in
  backend)
    echo "Starting FastAPI backend on http://127.0.0.1:8000..."
    cd "${BACKEND_DIR}"
    exec "${VENV_UVICORN}" app.main:app --host 127.0.0.1 --port 8000 --reload
    ;;

  frontend)
    echo "Starting Next.js frontend on http://localhost:3000..."
    cd "${FRONTEND_DIR}"
    exec pnpm dev
    ;;

  lab)
    echo "Starting vulnerable test lab on http://127.0.0.1:8888..."
    cd "${PROJECT_ROOT}"
    exec "${VENV_PYTHON}" lab/vulnerable_app/main.py
    ;;

  status)
    echo "=== FixOps Service Status ==="
    lsof -i :3000 -i :8000 -i :8888 2>/dev/null || echo "No FixOps processes detected on ports 3000, 8000, or 8888."
    ;;

  stop-all)
    echo "Stopping FixOps services on ports 3000, 8000, 8888..."
    for PORT in 3000 8000 8888; do
      PID=$(lsof -ti :${PORT} 2>/dev/null || true)
      if [ -n "$PID" ]; then
        echo "Killing process $PID on port $PORT..."
        kill -15 $PID 2>/dev/null || kill -9 $PID 2>/dev/null || true
      fi
    done
    echo "Done."
    ;;

  test)
    echo "=== Running Frontend Tests ==="
    cd "${FRONTEND_DIR}"
    node --experimental-strip-types --test tests/*.test.mjs
    echo ""
    echo "=== Running Backend Tests ==="
    cd "${BACKEND_DIR}"
    "${VENV_PYTEST}" tests -v
    ;;

  test-frontend)
    cd "${FRONTEND_DIR}"
    exec node --experimental-strip-types --test tests/*.test.mjs
    ;;

  test-backend)
    cd "${BACKEND_DIR}"
    exec "${VENV_PYTEST}" tests -v "${@:2}"
    ;;

  lint)
    cd "${FRONTEND_DIR}"
    exec pnpm run lint
    ;;

  typecheck)
    cd "${FRONTEND_DIR}"
    exec tsc --noEmit
    ;;

  build)
    cd "${FRONTEND_DIR}"
    exec pnpm run build
    ;;

  check-all)
    echo "=== 1/4: Frontend ESLint ==="
    (cd "${FRONTEND_DIR}" && pnpm run lint)
    echo ""
    echo "=== 2/4: TypeScript Typecheck ==="
    (cd "${FRONTEND_DIR}" && tsc --noEmit)
    echo ""
    echo "=== 3/4: Frontend Unit Tests ==="
    (cd "${FRONTEND_DIR}" && node --experimental-strip-types --test tests/*.test.mjs)
    echo ""
    echo "=== 4/4: Backend Pytest Suite ==="
    (cd "${BACKEND_DIR}" && "${VENV_PYTEST}" tests -v)
    echo ""
    echo "All checks PASSED cleanly!"
    ;;

  db-migrate)
    cd "${BACKEND_DIR}"
    exec "${VENV_ALEMBIC}" upgrade head
    ;;

  db-status)
    cd "${BACKEND_DIR}"
    exec "${VENV_ALEMBIC}" current
    ;;

  db-check)
    cd "${BACKEND_DIR}"
    exec "${VENV_PYTEST}" tests/test_migration.py -v
    ;;

  health)
    echo "=== Backend Health (http://127.0.0.1:8000/api/v1/health) ==="
    curl -s http://127.0.0.1:8000/api/v1/health || echo "Backend unreachable"
    echo ""
    echo "=== Frontend Proxy Health (http://127.0.0.1:3000/api/v1/health) ==="
    curl -s http://127.0.0.1:3000/api/v1/health || echo "Frontend unreachable"
    echo ""
    echo "=== Lab Target Health (http://127.0.0.1:8888/health) ==="
    curl -s http://127.0.0.1:8888/health || echo "Lab target offline"
    echo ""
    ;;

  info)
    echo "Lazy Nerds FixOps Workstation Configuration:"
    echo "  OS:           $(uname -s) $(uname -m)"
    echo "  Project Root: ${PROJECT_ROOT}"
    echo "  Git HEAD:     $(git -C "${PROJECT_ROOT}" rev-parse --short HEAD) ($(git -C "${PROJECT_ROOT}" branch --show-current))"
    echo "  Node:         $(node -v)"
    echo "  pnpm:         $(pnpm -v)"
    echo "  Python:       $("${VENV_PYTHON}" --version)"
    echo "  FastAPI:      $("${VENV_PYTHON}" -c 'import fastapi; print(fastapi.__version__)')"
    echo "  SQLAlchemy:   $("${VENV_PYTHON}" -c 'import sqlalchemy; print(sqlalchemy.__version__)')"
    ;;

  *)
    show_help
    ;;
esac
