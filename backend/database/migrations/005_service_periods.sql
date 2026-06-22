-- 005_service_periods.sql
--
-- Introduces multiple time-based service periods per physical location, so one
-- restaurant can serve a Morning menu and an Afternoon menu without duplicating
-- the location (its address, kitchen, inventory, reporting and order history all
-- stay attached to the same location row).
--
-- STRICTLY ADDITIVE AND NON-DESTRUCTIVE:
--   * No table is dropped, renamed, or recreated.
--   * No existing column is dropped or retyped.
--   * `location.open_time` / `close_time` are LEFT IN PLACE and keep working.
--     Callers that know nothing about service periods behave exactly as before.
--   * Existing locations are backfilled into one default service period that
--     reproduces their current hours and menu, so behaviour is unchanged on the
--     day this ships. Morning/Afternoon splits are a later configuration step.
--   * Re-runnable: every statement is guarded, so applying it twice is a no-op.
--
-- CONTEXT ON THE REAL SCHEMA (verified against production 2026-09-11):
--   There is no location -> menu relationship today. Menus are global:
--       menu -> category (category.menu_id) -> item (item.category_id)
--   and per-location availability is the item_location join table.
--   This migration therefore ADDS the location -> menu link that never existed,
--   by way of service_period.menu_id. item_location is left untouched and still
--   gates which items a location carries; the service period selects WHICH MENU
--   is shown for a given pickup time. The two filters compose.
--
-- Apply with:
--   ./deploy/db-migrate.sh
-- NOTE: production has no schema_migrations table yet and migrations 001/003/004
-- were applied by hand. Run `./deploy/db-migrate.sh --baseline` ONCE first, or
-- the runner will try to re-apply 001 and abort on a duplicate-column error.

-- ---------------------------------------------------------------------------
-- service_period
--
-- One row per named period at a location ("Morning", "Afternoon", "Late Night").
-- The schedule lives in service_period_schedule so a period can keep different
-- hours on different days, and simply not run on some days at all.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_period (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  location_id       INT UNSIGNED NOT NULL,
  menu_id           INT UNSIGNED NOT NULL,
  name              VARCHAR(100) NOT NULL,

  -- Minimum lead time. An order cannot be picked up sooner than
  -- NOW() + prep_time_minutes, which is also what stops a period being offered
  -- when there is no longer enough time to cook before it ends.
  -- Defaults to 0 so existing behaviour is bit-for-bit preserved on backfill.
  prep_time_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 0,

  sort_order        INT UNSIGNED NOT NULL DEFAULT 0,
  is_active         TINYINT(1)   NOT NULL DEFAULT 1,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                 ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_service_period_location_name (location_id, name),
  KEY idx_service_period_location_active (location_id, is_active),

  CONSTRAINT fk_service_period_location
    FOREIGN KEY (location_id) REFERENCES location (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  -- RESTRICT: deleting a menu that a period still serves must fail loudly
  -- rather than silently orphaning the period.
  CONSTRAINT fk_service_period_menu
    FOREIGN KEY (menu_id) REFERENCES menu (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- service_period_schedule
--
-- Per-weekday hours for a period. day_of_week uses MySQL DAYOFWEEK():
--   1=Sunday, 2=Monday, ... 7=Saturday
-- so resolution can compare directly against DAYOFWEEK(pickup_time) with no
-- offset arithmetic.
--
-- ABSENCE OF A ROW MEANS CLOSED. "Sunday: closed" is simply no Sunday row —
-- there is no is_closed flag to keep in sync. This is what allows
-- Mon-Fri 07:00-12:00 alongside Sat 08:00-13:00 without special-casing.
--
-- end_time > start_time is required; overnight periods that wrap past midnight
-- are NOT supported yet and must be modelled as two periods. This matches the
-- existing rule in sp_location_create (close_time <= open_time is rejected).
-- Enforced in the stored procedures, consistent with how this project does
-- validation, rather than as a CHECK constraint.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS service_period_schedule (
  id                INT UNSIGNED NOT NULL AUTO_INCREMENT,
  service_period_id INT UNSIGNED NOT NULL,
  day_of_week       TINYINT UNSIGNED NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,

  PRIMARY KEY (id),
  UNIQUE KEY uq_sps_period_day (service_period_id, day_of_week),
  KEY idx_sps_day (day_of_week),

  CONSTRAINT fk_sps_service_period
    FOREIGN KEY (service_period_id) REFERENCES service_period (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- order.service_period_id
--
-- Records which period an order was placed against, so historical orders stay
-- explainable after periods are edited. NULLable and ON DELETE SET NULL:
-- every one of the 108 existing orders keeps NULL and stays valid.
-- ---------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME   = 'order'
     AND COLUMN_NAME  = 'service_period_id'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `order`
     ADD COLUMN service_period_id INT UNSIGNED NULL AFTER location_id,
     ADD CONSTRAINT fk_order_service_period
       FOREIGN KEY (service_period_id) REFERENCES service_period (id)
       ON UPDATE CASCADE ON DELETE SET NULL',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- BACKFILL — preserve current behaviour exactly.
--
-- Every active location gets ONE period named 'All Day' pointing at the active
-- menu, open every day of the week using that location's existing hours. A
-- location with NULL hours (always-on) becomes 00:00:00-23:59:59, which is the
-- same "no restriction" semantics it has today.
--
-- Guarded by NOT EXISTS so re-running changes nothing, and skipped entirely if
-- there is no active menu to point at.
-- ---------------------------------------------------------------------------
INSERT INTO service_period (location_id, menu_id, name, prep_time_minutes, sort_order, is_active)
SELECT l.id,
       (SELECT MIN(m.id) FROM menu m WHERE m.is_active = 1),
       'All Day',
       0,
       0,
       1
  FROM location l
 WHERE EXISTS (SELECT 1 FROM menu m WHERE m.is_active = 1)
   AND NOT EXISTS (
         SELECT 1 FROM service_period sp WHERE sp.location_id = l.id
       );

-- One schedule row per weekday (1=Sun .. 7=Sat) for each backfilled period.
INSERT INTO service_period_schedule (service_period_id, day_of_week, start_time, end_time)
SELECT sp.id,
       d.dow,
       COALESCE(l.open_time,  '00:00:00'),
       COALESCE(l.close_time, '23:59:59')
  FROM service_period sp
  JOIN location l ON l.id = sp.location_id
  JOIN (SELECT 1 AS dow UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL
        SELECT 4        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL
        SELECT 7) d
 WHERE sp.name = 'All Day'
   AND NOT EXISTS (
         SELECT 1 FROM service_period_schedule s
          WHERE s.service_period_id = sp.id AND s.day_of_week = d.dow
       );
