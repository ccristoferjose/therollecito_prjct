#!/usr/bin/env bash
# Push backend/.env.production to a manual Docker Compose server. This is for
# the manual server flow only; the preferred AWS path is
# deploy/lightsail-backend.sh, which deploys to Lightsail Container Service and
# does not use Docker Compose.
#
# The production file holds LIVE Stripe/AWS keys and NODE_ENV=production; the
# local backend/.env keeps TEST keys and stays dev-only. No on-the-fly transform
# happens here.
#
# Usage: ./scripts/deploy-env.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV="$REPO_ROOT/backend/.env.production"
SSH_KEY="$HOME/.ssh/lightsail/therollecito-deploy.pem"
HOST="ubuntu@44.242.113.98"
REMOTE_ENV="/home/ubuntu/therollecito_prjct/backend/.env.production"
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f "$LOCAL_ENV" ]; then
  echo "ERROR: $LOCAL_ENV not found" >&2
  exit 1
fi
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: $SSH_KEY not found" >&2
  exit 1
fi

get_local_env() {
  grep -s "^${1}=" "$LOCAL_ENV" 2>/dev/null | head -1 | cut -d'=' -f2- || true
}

NODE_ENV_VAL="$(get_local_env NODE_ENV)"
S3_BUCKET_VAL="$(get_local_env S3_BUCKET)"
S3_ENDPOINT_VAL="$(get_local_env S3_ENDPOINT)"
S3_PUBLIC_URL_BASE_VAL="$(get_local_env S3_PUBLIC_URL_BASE)"

if [ "$NODE_ENV_VAL" != "production" ]; then
  echo "ERROR: $LOCAL_ENV must set NODE_ENV=production" >&2
  exit 1
fi
if [ -z "$S3_BUCKET_VAL" ]; then
  echo "ERROR: $LOCAL_ENV must set S3_BUCKET" >&2
  exit 1
fi
if [ -n "$S3_ENDPOINT_VAL" ]; then
  echo "ERROR: $LOCAL_ENV must not set S3_ENDPOINT; production must use AWS S3, not MinIO" >&2
  exit 1
fi
case "$S3_PUBLIC_URL_BASE_VAL" in
  *localhost*|*127.0.0.1*|*minio*)
    echo "ERROR: $LOCAL_ENV S3_PUBLIC_URL_BASE points to a local/MinIO host" >&2
    exit 1
    ;;
esac
case "$S3_BUCKET_VAL" in
  the-rollecito-dev|menu-images)
    echo "ERROR: $LOCAL_ENV S3_BUCKET is a known local development bucket" >&2
    exit 1
    ;;
esac

echo "▸ Pushing $LOCAL_ENV → $HOST:$REMOTE_ENV (verbatim, LIVE keys)"

# Stream the production env file directly to the remote backend/.env —
# no temp file on disk, no transform (the file is already prod-ready).
ssh -i "$SSH_KEY" -o StrictHostKeyChecking=accept-new "$HOST" "cat > $REMOTE_ENV" \
  < "$LOCAL_ENV"

echo "▸ Restarting backend container"
ssh -i "$SSH_KEY" "$HOST" \
  "cd ~/therollecito_prjct && sudo docker compose -f $COMPOSE_FILE restart backend" \
  2>&1 | grep -E "Restarting|Started" || true

echo "▸ Verifying"
sleep 5
ssh -i "$SSH_KEY" "$HOST" \
  "sudo docker compose -f ~/therollecito_prjct/$COMPOSE_FILE logs --tail=6 backend 2>&1" \
  | grep -E "Server|DB|production|development" || true

echo ""
echo "✓ Done. Confirm the line above shows '(production)', not '(development)'."
