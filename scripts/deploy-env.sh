#!/usr/bin/env bash
# Push backend/.env.production to the Lightsail instance, deploying it AS the
# remote backend/.env (the app always loads `.env`). The production file holds
# LIVE Stripe/AWS keys and NODE_ENV=production; the local backend/.env keeps
# TEST keys and stays dev-only. No on-the-fly transform — what you commit to
# .env.production is exactly what runs in prod.
#
# Usage: ./scripts/deploy-env.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV="$REPO_ROOT/backend/.env.production"
SSH_KEY="$HOME/.ssh/lightsail/therollecito-deploy.pem"
HOST="ubuntu@44.242.113.98"
REMOTE_ENV="/home/ubuntu/therollecito_prjct/backend/.env"
COMPOSE_FILE="docker-compose.prod.yml"

if [ ! -f "$LOCAL_ENV" ]; then
  echo "ERROR: $LOCAL_ENV not found" >&2
  exit 1
fi
if [ ! -f "$SSH_KEY" ]; then
  echo "ERROR: $SSH_KEY not found" >&2
  exit 1
fi

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
