#!/usr/bin/env bash
# =============================================================================
# Manual Production Deployment — Backend (Lightsail Container Service) + Frontend (Amplify)
#
# Usage:
#   ./deploy/deploy-all.sh               # Deploy both
#   ./deploy/deploy-all.sh --init        # First-time setup + deploy
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

info()  { echo ""; echo "======================================"; echo "  $*"; echo "======================================"; }

INIT=false
[[ "${1:-}" == "--init" ]] && INIT=true

# ---------------------------------------------------------------------------
# 1. Backend → Lightsail
# ---------------------------------------------------------------------------
info "BACKEND → AWS Lightsail"

if [ "${INIT}" = true ]; then
  bash "${SCRIPT_DIR}/lightsail-backend.sh" --create
else
  bash "${SCRIPT_DIR}/lightsail-backend.sh"
fi

# ---------------------------------------------------------------------------
# 2. Frontend → Amplify
# ---------------------------------------------------------------------------
info "FRONTEND → AWS Amplify"

if [ "${INIT}" = true ]; then
  bash "${SCRIPT_DIR}/amplify-frontend.sh" --create
  bash "${SCRIPT_DIR}/amplify-frontend.sh" --env
fi

bash "${SCRIPT_DIR}/amplify-frontend.sh" --deploy

info "ALL DONE"
echo ""
echo "Next steps:"
echo "  1. Put the frontend URL in backend/.env.production as CORS_ORIGIN"
echo "  2. Put the Lightsail backend URL in frontend/.env.production as VITE_API_URL"
echo "  3. Set up your MySQL database (RDS or Lightsail DB) and update DB_HOST"
echo ""
