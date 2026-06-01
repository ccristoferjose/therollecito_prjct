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

# Production env source: an exported environment variable wins (GitHub Actions
# injects these from repo secrets); otherwise fall back to backend/.env.production,
# then backend/.env for local manual deploys.
ENV_FILE=""
for f in "${PROJECT_ROOT}/backend/.env.production" "${PROJECT_ROOT}/backend/.env"; do
  if [ -f "$f" ]; then ENV_FILE="$f"; break; fi
done
[ -n "${ENV_FILE}" ] && info "Env fallback file: ${ENV_FILE}"

# getenv KEY → exported env var if set, else the value from ENV_FILE, else "".
getenv() {
  local key="$1"
  if [ -n "${!key:-}" ]; then
    printf '%s' "${!key}"
  elif [ -n "${ENV_FILE}" ]; then
    grep -s "^${key}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d'=' -f2- || true
  fi
}

# fileenv KEY → value from ENV_FILE only (never the exported shell env). Used
# for the app's S3 credentials so they don't accidentally inherit the *deploy*
# AWS credentials that the AWS CLI uses for `aws lightsail` calls in CI.
fileenv() {
  [ -n "${ENV_FILE}" ] && { grep -s "^${1}=" "${ENV_FILE}" 2>/dev/null | head -1 | cut -d'=' -f2- || true; }
}

APP_AWS_KEY="${APP_AWS_ACCESS_KEY_ID:-$(fileenv AWS_ACCESS_KEY_ID)}"
APP_AWS_SECRET="${APP_AWS_SECRET_ACCESS_KEY:-$(fileenv AWS_SECRET_ACCESS_KEY)}"
APP_AWS_REGION_VAL="${APP_AWS_REGION:-$(fileenv AWS_REGION)}"

# Build the container definition with jq so values (notably the quote-heavy
# Firebase service-account JSON) are escaped correctly. Keys are only included
# when non-empty, so the app's own defaults (config/env.js) apply otherwise.
jq -n \
  --arg image      "${IMAGE_URI}" \
  --arg cname      "${CONTAINER_NAME}" \
  --arg db_host    "$(getenv DB_HOST)" \
  --arg db_port    "$(getenv DB_PORT)" \
  --arg db_user    "$(getenv DB_USER)" \
  --arg db_pass    "$(getenv DB_PASSWORD)" \
  --arg db_name    "$(getenv DB_NAME)" \
  --arg jwt        "$(getenv JWT_SECRET)" \
  --arg jwt_exp    "$(getenv JWT_EXPIRES_IN)" \
  --arg fb_proj    "$(getenv FIREBASE_PROJECT_ID)" \
  --arg fb_sa      "$(getenv FIREBASE_SERVICE_ACCOUNT)" \
  --arg sk         "$(getenv STRIPE_SECRET_KEY)" \
  --arg pk         "$(getenv STRIPE_PUBLISHABLE_KEY)" \
  --arg whsec      "$(getenv STRIPE_WEBHOOK_SECRET)" \
  --arg fee_pct    "$(getenv STRIPE_FEE_PERCENT)" \
  --arg fee_fix    "$(getenv STRIPE_FEE_FIXED)" \
  --arg cors       "$(getenv CORS_ORIGIN)" \
  --arg s3_bucket  "$(getenv S3_BUCKET)" \
  --arg s3_url     "$(getenv S3_PUBLIC_URL_BASE)" \
  --arg aws_region "${APP_AWS_REGION_VAL}" \
  --arg aws_key    "${APP_AWS_KEY}" \
  --arg aws_secret "${APP_AWS_SECRET}" \
  '{
    ($cname): {
      image: $image,
      ports: { "3001": "HTTP" },
      environment: (
        {
          PORT: "3001",
          NODE_ENV: "production",
          DB_PORT: (if $db_port == "" then "3306" else $db_port end),
          DB_USER: (if $db_user == "" then "root" else $db_user end),
          DB_NAME: (if $db_name == "" then "restaurant_ordering" else $db_name end),
          DB_CONNECTION_LIMIT: "10",
          JWT_EXPIRES_IN: (if $jwt_exp == "" then "8h" else $jwt_exp end),
          CORS_ORIGIN: (if $cors == "" then "*" else $cors end)
        }
        + (if $db_host    != "" then {DB_HOST: $db_host} else {} end)
        + (if $db_pass    != "" then {DB_PASSWORD: $db_pass} else {} end)
        + (if $jwt        != "" then {JWT_SECRET: $jwt} else {} end)
        + (if $fb_proj    != "" then {FIREBASE_PROJECT_ID: $fb_proj} else {} end)
        + (if $fb_sa      != "" then {FIREBASE_SERVICE_ACCOUNT: $fb_sa} else {} end)
        + (if $sk         != "" then {STRIPE_SECRET_KEY: $sk} else {} end)
        + (if $pk         != "" then {STRIPE_PUBLISHABLE_KEY: $pk} else {} end)
        + (if $whsec      != "" then {STRIPE_WEBHOOK_SECRET: $whsec} else {} end)
        + (if $fee_pct    != "" then {STRIPE_FEE_PERCENT: $fee_pct} else {} end)
        + (if $fee_fix    != "" then {STRIPE_FEE_FIXED: $fee_fix} else {} end)
        + (if $s3_bucket  != "" then {S3_BUCKET: $s3_bucket} else {} end)
        + (if $s3_url     != "" then {S3_PUBLIC_URL_BASE: $s3_url} else {} end)
        + (if $aws_region != "" then {AWS_REGION: $aws_region} else {} end)
        + (if $aws_key    != "" then {AWS_ACCESS_KEY_ID: $aws_key} else {} end)
        + (if $aws_secret != "" then {AWS_SECRET_ACCESS_KEY: $aws_secret} else {} end)
      )
    }
  }' > /tmp/lightsail-containers.json

info "Container env keys: $(jq -r ".\"${CONTAINER_NAME}\".environment | keys | join(\", \")" /tmp/lightsail-containers.json)"

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
