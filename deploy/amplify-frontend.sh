#!/usr/bin/env bash
# =============================================================================
# Frontend deployment — AWS Amplify
#
# THE PRODUCTION APP IS:
#   name    therollecito
#   appId   d22yw2qalsyghv
#   region  us-west-1
#   domain  app.therollecito.com  ->  branch `main`
#
# It is NOT the app this script used to target. The previous version deployed to
# a different app in us-east-1 that had no custom domain and therefore never
# served a customer. Both happened to host the same Vite build, so the mistake
# was invisible. That app has since been deleted.
#
# TWO DEPLOY MODELS, because the two frontends need different hosting:
#
#   VITE (current production, static)
#     Built locally and uploaded as a zip. Works because a Vite build is a
#     folder of static files.
#       ./deploy/amplify-frontend.sh --deploy-vite
#
#   NEXT.JS (the migration target, SSR)
#     CANNOT be deployed this way. It needs Server Components, ISR and the /api
#     rewrite, so it requires platform WEB_COMPUTE and a connected Git repo —
#     Amplify has to run the build itself. Deploys are triggered by pushing to
#     the connected branch, or by --deploy-next below which starts a build job.
#       ./deploy/amplify-frontend.sh --deploy-next
#
# See amplify.yml at the repo root for the monorepo build spec.
# =============================================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Production Amplify app — the one with the custom domain attached.
APP_ID="d22yw2qalsyghv"
APP_NAME="therollecito"
REGION="us-west-1"
BRANCH="main"

info()  { echo "[INFO]  $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

# Fail loudly if the app ever moves, rather than deploying into a void.
assert_app() {
  local actual
  actual=$(aws amplify get-app --app-id "${APP_ID}" --region "${REGION}" \
    --query 'app.name' --output text 2>/dev/null || true)
  [ "${actual}" = "${APP_NAME}" ] || \
    error "Expected Amplify app '${APP_NAME}' at ${APP_ID} (${REGION}), found '${actual:-nothing}'."
}

show_platform() {
  aws amplify get-app --app-id "${APP_ID}" --region "${REGION}" \
    --query 'app.{platform:platform,repository:repository}' --output json
}

case "${1:-}" in
  # ---------------------------------------------------------------------------
  --status)
    assert_app
    info "App: ${APP_NAME} (${APP_ID}) in ${REGION}"
    show_platform
    aws amplify list-domain-associations --app-id "${APP_ID}" --region "${REGION}" \
      --query 'domainAssociations[].{domain:domainName,status:domainStatus}' --output json
    ;;

  # ---------------------------------------------------------------------------
  # VITE — static zip upload. Valid only while the Vite app is production.
  --deploy-vite)
    assert_app
    PLATFORM=$(aws amplify get-app --app-id "${APP_ID}" --region "${REGION}" --query 'app.platform' --output text)
    if [ "${PLATFORM}" != "WEB" ]; then
      error "App platform is ${PLATFORM}, not WEB. A zip upload only works for static hosting; use --deploy-next."
    fi

    info "Building Vite frontend..."
    cd "${PROJECT_ROOT}/frontend"
    npm ci
    npm run build

    info "Zipping build output..."
    cd dist
    rm -f /tmp/therollecito-frontend.zip
    zip -rq /tmp/therollecito-frontend.zip . -x '*.DS_Store'

    info "Creating deployment..."
    DEPLOY_RESULT=$(aws amplify create-deployment \
      --app-id "${APP_ID}" --branch-name "${BRANCH}" --region "${REGION}" --output json)
    JOB_ID=$(echo "${DEPLOY_RESULT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["jobId"])')
    UPLOAD_URL=$(echo "${DEPLOY_RESULT}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["zipUploadUrl"])')

    info "Uploading (job ${JOB_ID})..."
    curl -s -T /tmp/therollecito-frontend.zip "${UPLOAD_URL}"

    aws amplify start-deployment \
      --app-id "${APP_ID}" --branch-name "${BRANCH}" --job-id "${JOB_ID}" \
      --region "${REGION}" --no-cli-pager
    rm -f /tmp/therollecito-frontend.zip
    info "Deployed. https://app.therollecito.com"
    ;;

  # ---------------------------------------------------------------------------
  # NEXT.JS — triggers an Amplify-side build of the connected repo.
  --deploy-next)
    assert_app
    PLATFORM=$(aws amplify get-app --app-id "${APP_ID}" --region "${REGION}" --query 'app.platform' --output text)
    REPO=$(aws amplify get-app --app-id "${APP_ID}" --region "${REGION}" --query 'app.repository' --output text)

    if [ "${PLATFORM}" != "WEB_COMPUTE" ]; then
      error "App platform is ${PLATFORM}. Next.js SSR needs WEB_COMPUTE. Change it in the Amplify console, then retry."
    fi
    if [ -z "${REPO}" ] || [ "${REPO}" = "None" ]; then
      error "No repository connected. Amplify must build SSR apps itself — connect the repo in the console (it needs an OAuth handshake), then retry."
    fi

    info "Starting Amplify build for ${BRANCH}..."
    aws amplify start-job \
      --app-id "${APP_ID}" --branch-name "${BRANCH}" \
      --job-type RELEASE --region "${REGION}" --no-cli-pager
    info "Build started. Watch it:"
    info "  https://${REGION}.console.aws.amazon.com/amplify/home?region=${REGION}#/${APP_ID}/${BRANCH}"
    ;;

  # ---------------------------------------------------------------------------
  --env)
    assert_app
    ENV_FILE="${PROJECT_ROOT}/frontend/.env.production"
    [ -f "${ENV_FILE}" ] || error "frontend/.env.production not found."
    info "Setting branch env vars from frontend/.env.production..."
    ENV_VARS=""
    while IFS='=' read -r key value; do
      [[ "${key}" =~ ^#.*$ || -z "${key}" ]] && continue
      ENV_VARS="${ENV_VARS}${key}=${value},"
    done < "${ENV_FILE}"
    aws amplify update-branch \
      --app-id "${APP_ID}" --branch-name "${BRANCH}" \
      --environment-variables "${ENV_VARS%,}" --region "${REGION}" --no-cli-pager
    info "Environment variables updated."
    ;;

  *)
    cat <<USAGE
Usage:
  ./deploy/amplify-frontend.sh --status        Show app platform, repo and domains
  ./deploy/amplify-frontend.sh --deploy-vite   Build + zip-upload the Vite app (static only)
  ./deploy/amplify-frontend.sh --deploy-next   Trigger an Amplify build of the Next app (needs WEB_COMPUTE + repo)
  ./deploy/amplify-frontend.sh --env           Push frontend/.env.production to the branch

Production app: ${APP_NAME} (${APP_ID}) in ${REGION} -> app.therollecito.com
USAGE
    ;;
esac
