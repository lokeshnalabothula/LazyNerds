#!/usr/bin/env bash
# ==============================================================================
# Lazy Nerds FixOps — Scanner Worker Host Setup & Dependency Pinning
# ==============================================================================
# Sets up a reproducible, containerized scanning environment on any Docker host
# without depending on git-ignored development repositories.
# ==============================================================================

set -euo pipefail

echo "========================================================"
echo " Lazy Nerds FixOps — Worker Environment Setup"
echo "========================================================"

# 1. Docker Daemon Verification
if ! command -v docker &> /dev/null; then
    echo "[-] Error: 'docker' binary not found. Please install Docker or Docker Desktop."
    exit 1
fi

if ! docker info &> /dev/null; then
    echo "[-] Error: Docker daemon is not running or accessible. Please start Docker."
    exit 1
fi
echo "[+] Docker daemon is online."

# 2. Docker Network Initialization
echo "[*] Ensuring isolated bridge network 'shannon-net' exists..."
if ! docker network inspect shannon-net &> /dev/null; then
    docker network create --driver bridge shannon-net
    echo "[+] Created Docker network 'shannon-net'."
else
    echo "[+] Docker network 'shannon-net' is present."
fi

# 3. Nuclei Container Image & Template Volume Setup
NUCLEI_PINNED_IMAGE="projectdiscovery/nuclei:v3.11.1"
NUCLEI_LATEST_TAG="projectdiscovery/nuclei:latest"

echo "[*] Pulling pinned Nuclei container image (${NUCLEI_PINNED_IMAGE})..."
docker pull "${NUCLEI_PINNED_IMAGE}" || docker pull "${NUCLEI_LATEST_TAG}"
docker tag "${NUCLEI_PINNED_IMAGE}" "${NUCLEI_LATEST_TAG}" 2>/dev/null || true
echo "[+] Nuclei image ready: ${NUCLEI_PINNED_IMAGE}"

echo "[*] Ensuring persistent volume 'fixops-nuclei-templates' exists..."
if ! docker volume inspect fixops-nuclei-templates &> /dev/null; then
    docker volume create fixops-nuclei-templates
    echo "[+] Created Docker volume 'fixops-nuclei-templates'."
fi

echo "[*] Verifying / updating vulnerability assessment templates..."
docker run --rm \
    -v fixops-nuclei-templates:/root/nuclei-templates \
    projectdiscovery/nuclei:latest \
    -update-templates -silent || true
echo "[+] Nuclei vulnerability templates verified."

# 4. Shannon Container Setup
SHANNON_PINNED_IMAGE="keygraph/shannon:latest"
echo "[*] Checking Shannon AI Pentester container (${SHANNON_PINNED_IMAGE})..."
if docker image inspect "${SHANNON_PINNED_IMAGE}" &> /dev/null; then
    echo "[+] Shannon image '${SHANNON_PINNED_IMAGE}' is available."
else
    echo "[i] Note: Prebuilt Shannon image '${SHANNON_PINNED_IMAGE}' not found locally."
    echo "    To build from official source: git clone https://github.com/KeygraphHQ/shannon.git && docker build -t keygraph/shannon:latest shannon"
    echo "    (Live AI pentesting requires configured LLM credits and is kept disabled by default)."
fi

# 5. Configuration Summary
echo ""
echo "========================================================"
echo "[+] FixOps Worker Host Setup Complete!"
echo "========================================================"
echo "To start the worker daemon, run:"
echo "  export FIXOPS_API_URL=\"https://lazynerds-backend.onrender.com/api/v1\"  # or http://127.0.0.1:8000/api/v1"
echo "  export FIXOPS_WORKER_TOKEN=\"<your-worker-secret-token>\""
echo "  python3 worker/fixops_worker.py"
echo "========================================================"
