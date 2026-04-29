#!/bin/bash
# =============================================================================
# Docker MySQL init: runs schema + stored procedures + seed in order.
# SQL files are mounted at /sql/ (not in initdb.d) to avoid double execution.
# This shell script is the ONLY file in initdb.d.
# =============================================================================

echo "[init.sh] Loading IANA time zone tables (needed for CONVERT_TZ)..."
mysql_tzinfo_to_sql /usr/share/zoneinfo 2>/dev/null | mysql -u root -p"$MYSQL_ROOT_PASSWORD" mysql

echo "[init.sh] Setting database collation..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e \
  "ALTER DATABASE $MYSQL_DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[init.sh] Running schema..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /sql/01-schema.sql

echo "[init.sh] Running stored procedures..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /sql/02-stored_procedures.sql

echo "[init.sh] Running seed data..."
mysql -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" < /sql/03-seed.sql

echo "[init.sh] Database initialization complete."
