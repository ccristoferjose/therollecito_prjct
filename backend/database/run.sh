#!/usr/bin/env bash
# =============================================================================
# Restaurant Ordering Platform - Database Runner
# Connects to local MySQL and executes schema scripts.
#
# Usage:
#   ./database/run.sh                  # Create/rebuild schema
#   ./database/run.sh --seed           # Create schema + insert sample data
#   ./database/run.sh --reset --seed   # Full reset + rebuild + seed
#   ./database/run.sh --reset          # Drop all tables then recreate
#   ./database/run.sh --reset-only     # Drop all tables only
#
# Environment variables (override defaults):
#   DB_HOST     (default: 127.0.0.1)
#   DB_PORT     (default: 3306)
#   DB_USER     (default: root)
#   DB_PASS     (default: "")
#   DB_NAME     (default: restaurant_ordering)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

# Load credentials from backend/.env if it exists
if [ -f "${ENV_FILE}" ]; then
  DB_HOST="${DB_HOST:-$(grep -s '^DB_HOST=' "${ENV_FILE}" | cut -d'=' -f2- || true)}"
  DB_PORT="${DB_PORT:-$(grep -s '^DB_PORT=' "${ENV_FILE}" | cut -d'=' -f2- || true)}"
  DB_USER="${DB_USER:-$(grep -s '^DB_USER=' "${ENV_FILE}" | cut -d'=' -f2- || true)}"
  DB_PASS="${DB_PASS:-$(grep -s '^DB_PASSWORD=' "${ENV_FILE}" | cut -d'=' -f2- || true)}"
  DB_NAME="${DB_NAME:-$(grep -s '^DB_NAME=' "${ENV_FILE}" | cut -d'=' -f2- || true)}"
fi

# Fallback defaults
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
DB_NAME="${DB_NAME:-restaurant_ordering}"

MYSQL_CMD="mysql -h ${DB_HOST} -P ${DB_PORT} -u ${DB_USER}"

if [ -n "${DB_PASS}" ]; then
  MYSQL_CMD="${MYSQL_CMD} -p${DB_PASS}"
fi

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
info()  { echo "[INFO]  $*"; }
error() { echo "[ERROR] $*" >&2; exit 1; }

run_sql_file() {
  local file="$1"
  local label="$2"
  info "Running ${label} → ${file}"
  ${MYSQL_CMD} "${DB_NAME}" < "${file}"
  info "${label} completed."
}

# ---------------------------------------------------------------------------
# Ensure the database exists
# ---------------------------------------------------------------------------
info "Ensuring database '${DB_NAME}' exists..."
${MYSQL_CMD} -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
RESET=false
RESET_ONLY=false
SEED=false

for arg in "$@"; do
  case "${arg}" in
    --reset)      RESET=true ;;
    --reset-only) RESET_ONLY=true ;;
    --seed)       SEED=true ;;
    *)            error "Unknown argument: ${arg}" ;;
  esac
done

# ---------------------------------------------------------------------------
# Execute
# ---------------------------------------------------------------------------
if [ "${RESET_ONLY}" = true ]; then
  run_sql_file "${SCRIPT_DIR}/reset.sql" "Reset (drop all tables)"
  info "Done. All tables dropped."
  exit 0
fi

if [ "${RESET}" = true ]; then
  run_sql_file "${SCRIPT_DIR}/reset.sql" "Reset (drop all tables)"
fi

run_sql_file "${SCRIPT_DIR}/schema.sql" "Schema"
run_sql_file "${SCRIPT_DIR}/stored_procedures.sql" "Stored Procedures"

if [ "${SEED}" = true ]; then
  run_sql_file "${SCRIPT_DIR}/seed.sql" "Seed Data"
fi

info "Database '${DB_NAME}' is ready."
