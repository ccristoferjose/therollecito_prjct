#!/usr/bin/env bash
# =============================================================================
# Deploy Backend to AWS Lightsail Container Service
#
# Prerequisites:
#   - AWS CLI configured (aws sts get-caller-identity)
#   - Docker running locally
#
# Usage:
#   ./deploy/lightsail-backend.sh              # Build + push + deploy
#   ./deploy/lightsail-backend.sh --create     # First-time: create service + deploy
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="yumyum-backend"
CONTAINER_NAME="backend"
IMAGE_TAG="yumyum-backend:latest"
REGION="us-east-1"
POWER="micro"        # micro = 0.25 vCPU, 512 MB ($7/mo)
SCALE=1

CREATE=false
for arg in "$@"; do
  case "${arg}" in
    --create) CREATE=true ;;
  esac
done

info()  { echo "[INFO]  $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Step 1: Build Docker image
# ---------------------------------------------------------------------------
info "Building Docker image..."
docker build -t "${IMAGE_TAG}" "${PROJECT_ROOT}/backend"

# ---------------------------------------------------------------------------
# Step 2: Create Lightsail container service (first time only)
# ---------------------------------------------------------------------------
if [ "${CREATE}" = true ]; then
  info "Creating Lightsail container service '${SERVICE_NAME}'..."
  aws lightsail create-container-service \
    --service-name "${SERVICE_NAME}" \
    --power "${POWER}" \
    --scale "${SCALE}" \
    --region "${REGION}" \
    --no-cli-pager

  info "Waiting for service to become READY (this takes 2-3 minutes)..."
  aws lightsail wait container-service-active \
    --service-name "${SERVICE_NAME}" \
    --region "${REGION}" 2>/dev/null || \
  while true; do
    STATE=$(aws lightsail get-container-services \
      --service-name "${SERVICE_NAME}" \
      --region "${REGION}" \
      --query 'containerServices[0].state' --output text 2>/dev/null)
    info "  Service state: ${STATE}"
    if [ "${STATE}" = "READY" ] || [ "${STATE}" = "RUNNING" ]; then break; fi
    sleep 10
  done
fi

# ---------------------------------------------------------------------------
# Step 3: Push image to Lightsail
# ---------------------------------------------------------------------------
info "Pushing image to Lightsail..."
aws lightsail push-container-image \
  --service-name "${SERVICE_NAME}" \
  --label "${CONTAINER_NAME}" \
  --image "${IMAGE_TAG}" \
  --region "${REGION}" \
  --no-cli-pager

# Get the pushed image URI
IMAGE_URI=$(aws lightsail get-container-images \
  --service-name "${SERVICE_NAME}" \
  --region "${REGION}" \
  --query 'containerImages[0].image' --output text)

info "Pushed image: ${IMAGE_URI}"

# ---------------------------------------------------------------------------
# Step 4: Deploy container
# ---------------------------------------------------------------------------
info "Deploying container..."

# Read env vars from backend/.env if it exists
ENV_FILE="${PROJECT_ROOT}/backend/.env"
JWT_SECRET=""
FIREBASE_PROJECT_ID="restaurant-ordering-yumyum"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
DB_HOST=""
DB_PASSWORD=""

if [ -f "${ENV_FILE}" ]; then
  JWT_SECRET=$(grep -s '^JWT_SECRET=' "${ENV_FILE}" | cut -d'=' -f2- || true)
  FIREBASE_PROJECT_ID=$(grep -s '^FIREBASE_PROJECT_ID=' "${ENV_FILE}" | cut -d'=' -f2- || true)
  STRIPE_SECRET_KEY=$(grep -s '^STRIPE_SECRET_KEY=' "${ENV_FILE}" | cut -d'=' -f2- || true)
  STRIPE_WEBHOOK_SECRET=$(grep -s '^STRIPE_WEBHOOK_SECRET=' "${ENV_FILE}" | cut -d'=' -f2- || true)
  DB_HOST=$(grep -s '^DB_HOST=' "${ENV_FILE}" | cut -d'=' -f2- || true)
  DB_PASSWORD=$(grep -s '^DB_PASSWORD=' "${ENV_FILE}" | cut -d'=' -f2- || true)
fi

cat > /tmp/lightsail-containers.json <<JSONEOF
{
  "${CONTAINER_NAME}": {
    "image": "${IMAGE_URI}",
    "ports": {
      "3001": "HTTP"
    },
    "environment": {
      "PORT": "3001",
      "NODE_ENV": "production",
      "DB_HOST": "${DB_HOST}",
      "DB_PORT": "3306",
      "DB_USER": "root",
      "DB_PASSWORD": "${DB_PASSWORD}",
      "DB_NAME": "restaurant_ordering",
      "DB_CONNECTION_LIMIT": "10",
      "JWT_SECRET": "${JWT_SECRET}",
      "JWT_EXPIRES_IN": "8h",
      "FIREBASE_PROJECT_ID": "${FIREBASE_PROJECT_ID}",
      "STRIPE_SECRET_KEY": "${STRIPE_SECRET_KEY}",
      "STRIPE_WEBHOOK_SECRET": "${STRIPE_WEBHOOK_SECRET}",
      "CORS_ORIGIN": "*"
    }
  }
}
JSONEOF

cat > /tmp/lightsail-endpoint.json <<JSONEOF
{
  "containerName": "${CONTAINER_NAME}",
  "containerPort": 3001,
  "healthCheck": {
    "path": "/api/health",
    "intervalSeconds": 15,
    "timeoutSeconds": 5,
    "healthyThreshold": 2,
    "unhealthyThreshold": 3
  }
}
JSONEOF

aws lightsail create-container-service-deployment \
  --service-name "${SERVICE_NAME}" \
  --containers "file:///tmp/lightsail-containers.json" \
  --public-endpoint "file:///tmp/lightsail-endpoint.json" \
  --region "${REGION}" \
  --no-cli-pager

rm -f /tmp/lightsail-containers.json /tmp/lightsail-endpoint.json

# ---------------------------------------------------------------------------
# Step 5: Get the public URL
# ---------------------------------------------------------------------------
info "Deployment started. Waiting for URL..."
sleep 5

URL=$(aws lightsail get-container-services \
  --service-name "${SERVICE_NAME}" \
  --region "${REGION}" \
  --query 'containerServices[0].url' --output text 2>/dev/null)

info "============================================"
info "Backend URL: ${URL}"
info "Health check: ${URL}api/health"
info "============================================"
info ""
info "Set this URL as VITE_API_URL in Amplify environment variables."
