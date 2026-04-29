#!/usr/bin/env bash
# Delete ALL AWS resources (stops billing)
set -euo pipefail

REGION="us-east-1"
INSTANCE_NAME="yumyum-server"
AMPLIFY_APP_NAME="yumyum-ceviches"

echo ""
echo "  This will DELETE:"
echo "    - Lightsail instance: ${INSTANCE_NAME} (ALL DATA LOST)"
echo "    - Amplify app: ${AMPLIFY_APP_NAME}"
echo ""
read -rp "  Type 'yes' to confirm: " CONFIRM
[ "${CONFIRM}" != "yes" ] && echo "Aborted." && exit 0

echo "Deleting Lightsail instance..."
aws lightsail delete-instance \
  --instance-name "${INSTANCE_NAME}" \
  --region "${REGION}" \
  --no-cli-pager 2>/dev/null && echo "  Deleted." || echo "  Not found."

echo "Deleting Amplify app..."
APP_ID=$(aws amplify list-apps --region "${REGION}" \
  --query "apps[?name=='${AMPLIFY_APP_NAME}'].appId" --output text 2>/dev/null || true)
if [ -n "${APP_ID}" ] && [ "${APP_ID}" != "None" ]; then
  aws amplify delete-app --app-id "${APP_ID}" --region "${REGION}" --no-cli-pager
  echo "  Deleted."
else
  echo "  Not found."
fi

echo ""
echo "Done. All resources deleted."
