#!/usr/bin/env bash
# Quick redeploy backend to existing Lightsail instance
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${SCRIPT_DIR}/.."
REGION="us-east-1"
INSTANCE_NAME="yumyum-server"

PUBLIC_IP=$(aws lightsail get-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --query 'instance.publicIpAddress' --output text)

SSH_KEY="/tmp/lightsail-key.pem"
aws lightsail download-default-key-pair \
  --region "${REGION}" \
  --query 'privateKeyBase64' --output text > "${SSH_KEY}"
chmod 600 "${SSH_KEY}"

SSH_CMD="ssh -i ${SSH_KEY} -o StrictHostKeyChecking=no ec2-user@${PUBLIC_IP}"
SCP_CMD="scp -i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "Uploading updated files to ${PUBLIC_IP}..."
${SCP_CMD} -r "${PROJECT_ROOT}/backend/src/" "ec2-user@${PUBLIC_IP}:~/app/backend/src/"
${SCP_CMD} "${PROJECT_ROOT}/backend/database/schema.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"
${SCP_CMD} "${PROJECT_ROOT}/backend/database/stored_procedures.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"
${SCP_CMD} "${PROJECT_ROOT}/backend/database/seed.sql" "ec2-user@${PUBLIC_IP}:~/app/backend/database/"

echo "Rebuilding containers..."
${SSH_CMD} "cd ~/app && docker compose up --build -d"

rm -f "${SSH_KEY}"
echo "Done. Backend redeployed at http://${PUBLIC_IP}:3001"
