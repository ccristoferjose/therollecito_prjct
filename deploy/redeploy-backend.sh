#!/usr/bin/env bash
set -euo pipefail

echo "[ERROR] deploy/redeploy-backend.sh is deprecated and unsafe for production." >&2
echo "[ERROR] It redeployed the old Lightsail instance Docker Compose setup." >&2
echo "[ERROR] Use deploy/MANUAL_DEPLOYMENT.md and deploy/lightsail-backend.sh instead." >&2
exit 1

