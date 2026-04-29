#!/usr/bin/env bash
# =============================================================================
# Deploy Frontend to AWS Amplify
#
# Prerequisites:
#   - AWS CLI configured
#   - GitHub repo connected OR manual deploy
#
# Usage:
#   ./deploy/amplify-frontend.sh --create     # First-time: create Amplify app
#   ./deploy/amplify-frontend.sh --deploy     # Manual deploy (zip + upload)
#   ./deploy/amplify-frontend.sh --env        # Set environment variables
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="yumyum-ceviches"
REGION="us-east-1"
BRANCH="main"

info()  { echo "[INFO]  $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# Check for existing app
get_app_id() {
  aws amplify list-apps --region "${REGION}" \
    --query "apps[?name=='${APP_NAME}'].appId" --output text 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# --create: Create Amplify app for manual deploys
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--create" ]]; then
  EXISTING=$(get_app_id)
  if [ -n "${EXISTING}" ] && [ "${EXISTING}" != "None" ]; then
    info "App already exists: ${EXISTING}"
  else
    info "Creating Amplify app '${APP_NAME}'..."
    RESULT=$(aws amplify create-app \
      --name "${APP_NAME}" \
      --region "${REGION}" \
      --platform WEB \
      --no-cli-pager \
      --output json)

    APP_ID=$(echo "${RESULT}" | grep -o '"appId": "[^"]*"' | cut -d'"' -f4)
    info "App created: ${APP_ID}"

    # Create branch
    aws amplify create-branch \
      --app-id "${APP_ID}" \
      --branch-name "${BRANCH}" \
      --region "${REGION}" \
      --no-cli-pager

    info "Branch '${BRANCH}' created."
  fi

  APP_ID=$(get_app_id)
  info "App ID: ${APP_ID}"
  info "Console: https://${REGION}.console.aws.amazon.com/amplify/home?region=${REGION}#/${APP_ID}"
  exit 0
fi

# ---------------------------------------------------------------------------
# --env: Set environment variables for the frontend build
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--env" ]]; then
  APP_ID=$(get_app_id)
  [ -z "${APP_ID}" ] || [ "${APP_ID}" = "None" ] && error "App not found. Run --create first."

  # Read from frontend/.env
  ENV_FILE="${PROJECT_ROOT}/frontend/.env"
  [ ! -f "${ENV_FILE}" ] && error "frontend/.env not found."

  info "Setting Amplify environment variables from frontend/.env..."

  # Build environment map
  ENV_VARS=""
  while IFS='=' read -r key value; do
    [[ "${key}" =~ ^#.*$ || -z "${key}" ]] && continue
    ENV_VARS="${ENV_VARS}${key}=${value},"
  done < "${ENV_FILE}"
  ENV_VARS="${ENV_VARS%,}"

  aws amplify update-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --environment-variables "${ENV_VARS}" \
    --region "${REGION}" \
    --no-cli-pager

  info "Environment variables updated for branch '${BRANCH}'."
  exit 0
fi

# ---------------------------------------------------------------------------
# --deploy: Build locally and deploy to Amplify
# ---------------------------------------------------------------------------
if [[ "${1:-}" == "--deploy" ]]; then
  APP_ID=$(get_app_id)
  [ -z "${APP_ID}" ] || [ "${APP_ID}" = "None" ] && error "App not found. Run --create first."

  info "Building frontend..."
  cd "${PROJECT_ROOT}/frontend"
  npm ci
  npm run build

  info "Zipping build output..."
  cd dist
  zip -r /tmp/yumyum-frontend.zip . -x '*.DS_Store'

  info "Deploying to Amplify..."
  DEPLOY_RESULT=$(aws amplify create-deployment \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --region "${REGION}" \
    --output json)

  JOB_ID=$(echo "${DEPLOY_RESULT}" | grep -o '"jobId": "[^"]*"' | cut -d'"' -f4)
  UPLOAD_URL=$(echo "${DEPLOY_RESULT}" | grep -o '"zipUploadUrl": "[^"]*"' | cut -d'"' -f4)

  info "Uploading build (job: ${JOB_ID})..."
  curl -s -T /tmp/yumyum-frontend.zip "${UPLOAD_URL}"

  aws amplify start-deployment \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --job-id "${JOB_ID}" \
    --region "${REGION}" \
    --no-cli-pager

  rm -f /tmp/yumyum-frontend.zip

  # Get app URL
  APP_URL=$(aws amplify get-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --region "${REGION}" \
    --query 'branch.displayName' --output text 2>/dev/null || true)

  info "============================================"
  info "Deployment started!"
  info "Console: https://${REGION}.console.aws.amazon.com/amplify/home?region=${REGION}#/${APP_ID}"
  info "URL: https://${BRANCH}.${APP_ID}.amplifyapp.com"
  info "============================================"
  exit 0
fi

echo "Usage:"
echo "  ./deploy/amplify-frontend.sh --create   # Create Amplify app"
echo "  ./deploy/amplify-frontend.sh --env       # Set env vars from frontend/.env"
echo "  ./deploy/amplify-frontend.sh --deploy    # Build + deploy"
