#!/usr/bin/env bash
set -euo pipefail

echo "[ERROR] deploy/setup-aws.sh is deprecated and unsafe for production." >&2
echo "[ERROR] It deployed the local docker-compose.yml, which includes MinIO/dev services." >&2
echo "[ERROR] Use deploy/MANUAL_DEPLOYMENT.md and deploy/lightsail-backend.sh instead." >&2
exit 1

