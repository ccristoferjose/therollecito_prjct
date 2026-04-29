-- =============================================================================
-- Docker MySQL init: runs schema + stored procedures + seed in one shot.
-- This file is mounted into /docker-entrypoint-initdb.d/ and executes
-- automatically on first container start (empty data volume).
-- =============================================================================

SOURCE /docker-entrypoint-initdb.d/01-schema.sql;
SOURCE /docker-entrypoint-initdb.d/02-stored_procedures.sql;
SOURCE /docker-entrypoint-initdb.d/03-seed.sql;
