#!/usr/bin/env bash
# =============================================================================
# Create an admin staff account
#
# Usage:
#   ./backend/scripts/create-admin.sh
#   ./backend/scripts/create-admin.sh --email admin@yumyum.com --password Admin2026!
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Defaults
EMAIL="admin@yumyum.com"
PASSWORD="Admin2026!"
FIRST_NAME="Admin"
LAST_NAME="YumYum"
ROLE="admin"
LOCATION_ID=1

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --email)      EMAIL="$2"; shift 2 ;;
    --password)   PASSWORD="$2"; shift 2 ;;
    --name)       FIRST_NAME="$2"; shift 2 ;;
    --lastname)   LAST_NAME="$2"; shift 2 ;;
    --role)       ROLE="$2"; shift 2 ;;
    --location)   LOCATION_ID="$2"; shift 2 ;;
    *)            shift ;;
  esac
done

# Load DB creds from .env
if [ -f "${ENV_FILE}" ]; then
  DB_HOST=$(grep -s '^DB_HOST=' "${ENV_FILE}" | cut -d'=' -f2- || echo "127.0.0.1")
  DB_PORT=$(grep -s '^DB_PORT=' "${ENV_FILE}" | cut -d'=' -f2- || echo "3306")
  DB_USER=$(grep -s '^DB_USER=' "${ENV_FILE}" | cut -d'=' -f2- || echo "root")
  DB_PASS=$(grep -s '^DB_PASSWORD=' "${ENV_FILE}" | cut -d'=' -f2- || echo "")
  DB_NAME=$(grep -s '^DB_NAME=' "${ENV_FILE}" | cut -d'=' -f2- || echo "restaurant_ordering")
fi

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-restaurant_ordering}"

# Generate bcrypt hash (use backend's node_modules)
HASH=$(node -e "console.log(require('${SCRIPT_DIR}/../node_modules/bcryptjs').hashSync('${PASSWORD}', 12))")

# Build mysql command
MYSQL_CMD="mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER}"
[ -n "${DB_PASS}" ] && MYSQL_CMD="${MYSQL_CMD} -p${DB_PASS}"

# Get role_id
ROLE_ID=$(${MYSQL_CMD} -N -e "SELECT id FROM role WHERE name='${ROLE}'" "${DB_NAME}" 2>/dev/null)

if [ -z "${ROLE_ID}" ]; then
  echo "[ERROR] Role '${ROLE}' not found. Run the schema + seed first."
  exit 1
fi

# Insert user
${MYSQL_CMD} "${DB_NAME}" -e "
  INSERT INTO user (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
  VALUES (NULL, '${EMAIL}', '${HASH}', '${FIRST_NAME}', '${LAST_NAME}', NULL, ${ROLE_ID}, ${LOCATION_ID})
  ON DUPLICATE KEY UPDATE password_hash='${HASH}';
" 2>/dev/null

echo ""
echo "  Staff account ready:"
echo "    Email:    ${EMAIL}"
echo "    Password: ${PASSWORD}"
echo "    Role:     ${ROLE}"
echo "    URL:      http://localhost:5173/staff"
echo ""
