#!/usr/bin/env bash
# =============================================================================
# Yum Yum Ceviches — AWS Deployment
#
# Architecture:
#   Lightsail instance ($7/mo) → Docker Compose (backend + MySQL + volume)
#   Amplify (FREE)             → Frontend (React/Vite)
#
# Usage:
#   ./deploy/setup-aws.sh
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."

REGION="us-east-1"
INSTANCE_NAME="yumyum-server"
AMPLIFY_APP_NAME="yumyum-ceviches"
GITHUB_REPO="https://github.com/ccristoferjose/restaurant-ordering-platform"
BRANCH="main"

info()  { echo ""; echo "=== $* ==="; }
step()  { echo "  -> $*"; }

# Read backend .env
JWT_SECRET=$(grep '^JWT_SECRET=' "${PROJECT_ROOT}/backend/.env" | cut -d'=' -f2-)

# ---------------------------------------------------------------------------
# STEP 1: Create Lightsail Instance
# ---------------------------------------------------------------------------
info "STEP 1: Lightsail Instance (micro — \$7/mo, 1GB RAM)"

EXISTING=$(aws lightsail get-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --query 'instance.state.name' --output text 2>/dev/null || echo "none")

if [ "${EXISTING}" = "none" ]; then
  step "Creating instance..."

  # User-data script: install Docker + Docker Compose on first boot
  cat > /tmp/lightsail-userdata.sh <<'USERDATA'
#!/bin/bash
set -e

# Install Docker
yum update -y
yum install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Install Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m) \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Create app directory
mkdir -p /home/ec2-user/app
chown ec2-user:ec2-user /home/ec2-user/app
USERDATA

  aws lightsail create-instances \
    --instance-names "${INSTANCE_NAME}" \
    --availability-zone "${REGION}a" \
    --blueprint-id "amazon_linux_2023" \
    --bundle-id "micro_3_0" \
    --user-data file:///tmp/lightsail-userdata.sh \
    --region "${REGION}" \
    --no-cli-pager

  rm -f /tmp/lightsail-userdata.sh

  step "Waiting for instance to be running..."
  while true; do
    STATE=$(aws lightsail get-instance \
      --instance-name "${INSTANCE_NAME}" \
      --region "${REGION}" \
      --query 'instance.state.name' --output text 2>/dev/null || echo "pending")
    step "State: ${STATE}"
    if [ "${STATE}" = "running" ]; then break; fi
    sleep 10
  done

  # Wait extra for user-data to finish installing Docker
  step "Waiting for Docker installation (60s)..."
  sleep 60
else
  step "Instance already exists (${EXISTING})."
fi

# Get public IP
PUBLIC_IP=$(aws lightsail get-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --query 'instance.publicIpAddress' --output text)

step "Public IP: ${PUBLIC_IP}"

# ---------------------------------------------------------------------------
# STEP 2: Open ports
# ---------------------------------------------------------------------------
info "STEP 2: Opening ports (3001, 80, 443)"

aws lightsail open-instance-public-ports \
  --instance-name "${INSTANCE_NAME}" \
  --port-info fromPort=3001,toPort=3001,protocol=tcp \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null || true

aws lightsail open-instance-public-ports \
  --instance-name "${INSTANCE_NAME}" \
  --port-info fromPort=80,toPort=80,protocol=tcp \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null || true

aws lightsail open-instance-public-ports \
  --instance-name "${INSTANCE_NAME}" \
  --port-info fromPort=443,toPort=443,protocol=tcp \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null || true

step "Ports opened."

# ---------------------------------------------------------------------------
# STEP 3: Download SSH key and upload files
# ---------------------------------------------------------------------------
info "STEP 3: Uploading app files to instance"

# Download the default SSH key
SSH_KEY="/tmp/lightsail-key.pem"
aws lightsail download-default-key-pair \
  --region "${REGION}" \
  --query 'privateKeyBase64' --output text > "${SSH_KEY}"
chmod 600 "${SSH_KEY}"

SSH_CMD="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no -o ConnectTimeout=10 ec2-user@${PUBLIC_IP}"
SCP_CMD="scp -i ${SSH_KEY} -o StrictHostKeyChecking=no"

# Test SSH connectivity
step "Testing SSH connection..."
RETRIES=0
while ! ${SSH_CMD} "echo ok" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ ${RETRIES} -gt 12 ]; then
    echo "[ERROR] Cannot SSH into instance after 2 minutes."
    exit 1
  fi
  sleep 10
done

# Check if Docker is ready
step "Checking Docker installation..."
RETRIES=0
while ! ${SSH_CMD} "docker --version" 2>/dev/null; do
  RETRIES=$((RETRIES + 1))
  if [ ${RETRIES} -gt 18 ]; then
    echo "[ERROR] Docker not installed after 3 minutes. Check user-data logs."
    exit 1
  fi
  step "Docker not ready yet, waiting..."
  sleep 10
done

step "Docker ready on instance."

# Create remote directory structure
${SSH_CMD} "mkdir -p ~/app/backend/database ~/app/backend/src"

# Upload docker-compose.yml
${SCP_CMD} "${PROJECT_ROOT}/docker-compose.yml" "ec2-user@${PUBLIC_IP}:~/app/"

# Upload backend source
${SCP_CMD} "${PROJECT_ROOT}/backend/package.json" "ec2-user@${PUBLIC_IP}:~/app/backend/"
${SCP_CMD} "${PROJECT_ROOT}/backend/package-lock.json" "ec2-user@${PUBLIC_IP}:~/app/backend/"
${SCP_CMD} "${PROJECT_ROOT}/backend/Dockerfile" "ec2-user@${PUBLIC_IP}:~/app/backend/"
${SCP_CMD} -r "${PROJECT_ROOT}/backend/src/" "ec2-user@${PUBLIC_IP}:~/app/backend/src/"

# Upload database files
${SCP_CMD} "${PROJECT_ROOT}/backend/database/schema.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"
${SCP_CMD} "${PROJECT_ROOT}/backend/database/stored_procedures.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"
${SCP_CMD} "${PROJECT_ROOT}/backend/database/seed.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"

# Create .env on the remote server
step "Creating .env on instance..."
${SSH_CMD} "cat > ~/app/.env << 'ENVEOF'
JWT_SECRET=${JWT_SECRET}
FIREBASE_PROJECT_ID=restaurant-ordering-yumyum
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
ENVEOF"

step "Files uploaded."

# ---------------------------------------------------------------------------
# STEP 4: Start Docker Compose on instance
# ---------------------------------------------------------------------------
info "STEP 4: Starting Docker Compose on instance"

${SSH_CMD} << 'REMOTE'
cd ~/app

# Stop existing containers
docker compose down 2>/dev/null || true

# Build and start
docker compose up --build -d

# Wait for health
echo "Waiting for containers..."
sleep 15

# Check status
docker compose ps
REMOTE

step "Containers started."

# Verify health endpoint
step "Checking backend health..."
sleep 5
HEALTH=$(curl -s --max-time 10 "http://${PUBLIC_IP}:3001/api/health" 2>/dev/null || echo "failed")
step "Health: ${HEALTH}"

# ---------------------------------------------------------------------------
# STEP 5: Amplify Frontend
# ---------------------------------------------------------------------------
info "STEP 5: Amplify Frontend (FREE tier)"

BACKEND_URL="http://${PUBLIC_IP}:3001"

APP_ID=$(aws amplify list-apps --region "${REGION}" \
  --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId" --output text 2>/dev/null || true)

ENV_VARS="VITE_API_URL=${BACKEND_URL}"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_API_KEY=AIzaSyC5RpMZrOQG-vZiStHxXreezlkn1svNMz0"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_AUTH_DOMAIN=restaurant-ordering-yumyum.firebaseapp.com"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_PROJECT_ID=restaurant-ordering-yumyum"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_STORAGE_BUCKET=restaurant-ordering-yumyum.firebasestorage.app"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_MESSAGING_SENDER_ID=1092364937949"
ENV_VARS="${ENV_VARS},VITE_FIREBASE_APP_ID=1:1092364937949:web:d8f2448eb22b5c4cac0934"

if [ -z "${APP_ID}" ] || [ "${APP_ID}" = "None" ]; then
  step "Amplify needs a GitHub token with 'repo' scope."
  step "Create at: https://github.com/settings/tokens/new"
  echo ""
  read -rp "  GitHub token: " GITHUB_TOKEN
  echo ""

  RESULT=$(aws amplify create-app \
    --name "${AMPLIFY_APP_NAME}" \
    --repository "${GITHUB_REPO}" \
    --access-token "${GITHUB_TOKEN}" \
    --region "${REGION}" \
    --build-spec "$(cat "${PROJECT_ROOT}/frontend/amplify.yml")" \
    --environment-variables "${ENV_VARS}" \
    --no-cli-pager \
    --output json)

  APP_ID=$(echo "${RESULT}" | python3 -c "import sys,json; print(json.load(sys.stdin)['app']['appId'])")
  step "App created: ${APP_ID}"

  aws amplify create-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --region "${REGION}" \
    --no-cli-pager

  aws amplify start-job \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --job-type RELEASE \
    --region "${REGION}" \
    --no-cli-pager
else
  step "App exists: ${APP_ID}. Updating + rebuilding..."
  aws amplify update-branch \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --environment-variables "${ENV_VARS}" \
    --region "${REGION}" \
    --no-cli-pager

  aws amplify start-job \
    --app-id "${APP_ID}" \
    --branch-name "${BRANCH}" \
    --job-type RELEASE \
    --region "${REGION}" \
    --no-cli-pager
fi

FRONTEND_URL="https://${BRANCH}.${APP_ID}.amplifyapp.com"

# Clean up SSH key
rm -f "${SSH_KEY}"

# ---------------------------------------------------------------------------
# DONE
# ---------------------------------------------------------------------------
info "DEPLOYMENT COMPLETE"
echo ""
echo "  ┌──────────────────────────────────────────────────────────┐"
echo "  │  Frontend:  ${FRONTEND_URL}"
echo "  │  Backend:   ${BACKEND_URL}"
echo "  │  Instance:  ${PUBLIC_IP} (SSH: lightsail default key)"
echo "  └──────────────────────────────────────────────────────────┘"
echo ""
echo "  Monthly cost:"
echo "    Lightsail micro (1GB): \$7/mo (backend + MySQL)"
echo "    Amplify hosting:       FREE"
echo "    Total:                 \$7/mo"
echo ""
echo "  Don't forget:"
echo "    1. Add Amplify URL to Firebase authorized domains"
echo "    2. Push to '${BRANCH}' -> Amplify auto-deploys frontend"
echo "    3. To redeploy backend: ./deploy/redeploy-backend.sh"
echo ""
