#!/usr/bin/env bash
# =============================================================================
# Apply pending DB migrations + (re)load stored procedures against a MySQL DB.
#
# Connection comes from environment variables:
#   DB_HOST      (required)
#   DB_PORT      (default 3306)
#   DB_USER      (default root)
#   DB_PASSWORD  (required)
#   DB_NAME      (default restaurant_ordering)
#   DB_SSL_MODE  (optional, e.g. REQUIRED — recommended over the public internet)
#
# What it does:
#   1. Ensures a `schema_migrations` tracking table exists.
#   2. Applies each backend/database/migrations/*.sql NOT yet recorded, in
#      filename order, then records it. Each migration runs exactly once.
#   3. Always re-applies stored_procedures.sql — every procedure is DROP/CREATE,
#      so this is safe to run on every deploy and keeps prod SPs in sync.
#
# Modes:
#   ./deploy/db-migrate.sh             # apply pending migrations, then SPs
#   ./deploy/db-migrate.sh --baseline  # record existing migrations as applied
#                                       # WITHOUT executing them (first-time
#                                       # setup on a DB that already has them),
#                                       # then load SPs.
#
# NOTE: the runner (GitHub Actions) must be able to reach the DB. A managed
# MySQL behind a VPC/IP allowlist won't be reachable from GitHub-hosted runners
# unless you enable public access (+ allowlist) or use a self-hosted runner.
# =============================================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIG_DIR="${PROJECT_ROOT}/backend/database/migrations"
SP_FILE="${PROJECT_ROOT}/backend/database/stored_procedures.sql"

DB_HOST="${DB_HOST:?DB_HOST is required}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-root}"
DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"
DB_NAME="${DB_NAME:-restaurant_ordering}"
DB_SSL_MODE="${DB_SSL_MODE:-}"

BASELINE=false
[ "${1:-}" = "--baseline" ] && BASELINE=true

# Write credentials to a temp defaults-file so the password never appears on a
# command line or in the process list.
CNF="$(mktemp)"
trap 'rm -f "${CNF}"' EXIT
{
  printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' \
    "${DB_HOST}" "${DB_PORT}" "${DB_USER}" "${DB_PASSWORD}"
  [ -n "${DB_SSL_MODE}" ] && printf 'ssl-mode=%s\n' "${DB_SSL_MODE}"
} > "${CNF}"

mysql_do() { mysql --defaults-extra-file="${CNF}" "${DB_NAME}" "$@"; }

echo "▸ Target: ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

echo "▸ Ensuring schema_migrations table exists"
mysql_do -e "CREATE TABLE IF NOT EXISTS schema_migrations (
  filename   VARCHAR(255) NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;"

is_applied() { mysql_do -N -B -e "SELECT 1 FROM schema_migrations WHERE filename='$1' LIMIT 1;"; }
record()     { mysql_do -e "INSERT IGNORE INTO schema_migrations (filename) VALUES ('$1');"; }

shopt -s nullglob
migrations=("${MIG_DIR}"/*.sql)   # bash expands globs in sorted order
if [ ${#migrations[@]} -eq 0 ]; then
  echo "  (no migration files found)"
fi

for f in "${migrations[@]}"; do
  name="$(basename "$f")"
  if [ -n "$(is_applied "$name")" ]; then
    echo "  = ${name} (already applied)"
    continue
  fi
  if [ "${BASELINE}" = true ]; then
    echo "  ~ ${name} (baselined — recorded without executing)"
    record "$name"
    continue
  fi
  echo "  + ${name} (applying)"
  mysql_do < "$f"
  record "$name"
done

echo "▸ (Re)loading stored procedures"
mysql_do < "${SP_FILE}"

echo "✓ Database up to date."
