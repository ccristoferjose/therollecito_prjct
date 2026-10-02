-- 008_delivery.sql
--
-- Adds DELIVERY as a second fulfillment method alongside PICKUP, fulfilled by a
-- third-party courier provider (Uber Direct first; the schema is provider-neutral).
--
-- STRICTLY ADDITIVE AND NON-DESTRUCTIVE:
--   * `order.fulfillment_type` defaults to 'PICKUP', so every existing order and
--     every caller that knows nothing about delivery behaves exactly as before.
--   * `order.delivery_fee` defaults to 0.00, so sp_order_calculate_total yields
--     the same totals for pickup orders.
--   * Re-runnable: every ALTER is guarded, every CREATE is IF NOT EXISTS.
--
-- The courier lifecycle is deliberately NOT stored on `order`:
--   order.status_id      -> the kitchen's lifecycle (CREATED/PAID/PREPARING/...)
--   delivery.status      -> the courier's lifecycle (PENDING/PICKUP/DROPOFF/...)
-- A courier state change must never move the kitchen state, and vice versa.
--
-- Money: DECIMAL(10,2) dollars, matching every other money column. Providers
-- that speak cents (Uber) are converted at the provider boundary.
--
-- Apply with:
--   ./deploy/db-migrate.sh

-- ---------------------------------------------------------------------------
-- location.latitude / location.longitude
--
-- The courier pickup point. NULL until geocoded; the delivery service geocodes
-- the location's street address on first quote and stores the result, so no
-- admin data entry is required. Admins may overwrite them for precision.
-- ---------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'location' AND COLUMN_NAME = 'latitude'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE location
     ADD COLUMN latitude  DECIMAL(9, 6) NULL AFTER zip_code,
     ADD COLUMN longitude DECIMAL(9, 6) NULL AFTER latitude',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- order.fulfillment_type / order.delivery_fee
--
-- delivery_fee is the CUSTOMER-FACING fee, kept separate from subtotal,
-- discount and processing_fee so totals stay auditable. What the provider
-- actually charges us lives on `delivery.provider_fee`.
-- ---------------------------------------------------------------------------
SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order' AND COLUMN_NAME = 'fulfillment_type'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE `order`
     ADD COLUMN fulfillment_type VARCHAR(20) NOT NULL DEFAULT ''PICKUP'' AFTER service_period_id,
     ADD COLUMN delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER processing_fee,
     ADD CONSTRAINT chk_order_fulfillment_type CHECK (fulfillment_type IN (''PICKUP'', ''DELIVERY''))',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- delivery_quote
--
-- Every quote the backend obtained from a provider. The browser only ever holds
-- the provider's quote id; the fee charged is always read back from here, so a
-- client can never submit its own delivery price.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_quote (
  id                     INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  provider               VARCHAR(30)    NOT NULL,
  provider_quote_id      VARCHAR(100)   NOT NULL,
  location_id            INT UNSIGNED   NOT NULL,

  -- Normalized dropoff address the quote was priced for.
  street_address         VARCHAR(255)   NOT NULL,
  apartment              VARCHAR(100)   NULL,
  city                   VARCHAR(100)   NOT NULL,
  state                  VARCHAR(50)    NOT NULL,
  zip_code               VARCHAR(20)    NOT NULL,
  country                CHAR(2)        NOT NULL DEFAULT 'US',
  latitude               DECIMAL(9, 6)  NULL,
  longitude              DECIMAL(9, 6)  NULL,

  -- What the provider charges us vs. what the customer pays. Equal today;
  -- stored separately so subsidies / free-delivery thresholds need no migration.
  provider_fee           DECIMAL(10, 2) NOT NULL,
  customer_delivery_fee  DECIMAL(10, 2) NOT NULL,
  currency               CHAR(3)        NOT NULL DEFAULT 'USD',

  pickup_ready_at        DATETIME       NOT NULL,
  dropoff_eta            DATETIME       NULL,
  duration_minutes       SMALLINT UNSIGNED NULL,
  pickup_duration_minutes SMALLINT UNSIGNED NULL,
  expires_at             DATETIME       NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_quote_provider (provider, provider_quote_id),
  KEY idx_delivery_quote_location (location_id),

  CONSTRAINT fk_delivery_quote_location
    FOREIGN KEY (location_id) REFERENCES location (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- delivery
--
-- One row per DELIVERY order (UNIQUE order_id — that uniqueness is also what
-- makes courier dispatch idempotent per order). Address fields are a snapshot
-- of the accepted quote, like order_item snapshots menu prices.
--
-- status:
--   QUOTED            order placed with an accepted quote, not dispatched yet
--   DISPATCHING       a worker has claimed the row and is calling the provider
--   FAILED            dispatch failed; staff can retry from the kitchen board
--   PENDING           provider accepted the delivery, no courier yet
--   COURIER_ASSIGNED  courier assigned
--   PICKUP            courier heading to the restaurant
--   PICKUP_COMPLETE   courier has the food
--   DROPOFF           courier heading to the customer
--   DELIVERED         done
--   CANCELED          canceled (by us or the provider)
--   RETURNED          canceled after pickup; food returned to the restaurant
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery (
  id                     INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  order_id               INT UNSIGNED   NOT NULL,
  provider               VARCHAR(30)    NOT NULL,
  provider_delivery_id   VARCHAR(100)   NULL,
  delivery_quote_id      INT UNSIGNED   NULL,
  quote_id               VARCHAR(100)   NOT NULL COMMENT 'provider quote id of the ACCEPTED quote',
  quote_expires_at       DATETIME       NOT NULL,

  provider_fee           DECIMAL(10, 2) NOT NULL,
  customer_delivery_fee  DECIMAL(10, 2) NOT NULL,
  currency               CHAR(3)        NOT NULL DEFAULT 'USD',

  status                 VARCHAR(30)    NOT NULL DEFAULT 'QUOTED',
  pickup_ready_at        DATETIME       NOT NULL,
  pickup_eta             DATETIME       NULL,
  dropoff_eta            DATETIME       NULL,
  tracking_url           VARCHAR(500)   NULL,

  street_address         VARCHAR(255)   NOT NULL,
  apartment              VARCHAR(100)   NULL,
  city                   VARCHAR(100)   NOT NULL,
  state                  VARCHAR(50)    NOT NULL,
  zip_code               VARCHAR(20)    NOT NULL,
  country                CHAR(2)        NOT NULL DEFAULT 'US',
  latitude               DECIMAL(9, 6)  NULL,
  longitude              DECIMAL(9, 6)  NULL,

  dropoff_name           VARCHAR(150)   NOT NULL,
  dropoff_phone          VARCHAR(20)    NOT NULL,
  dropoff_notes          VARCHAR(280)   NULL,

  dispatch_attempts      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  last_error_code        VARCHAR(60)    NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_order (order_id),
  UNIQUE KEY uq_delivery_provider_delivery (provider, provider_delivery_id),
  KEY idx_delivery_status (status),

  CONSTRAINT fk_delivery_order
    FOREIGN KEY (order_id) REFERENCES `order` (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_delivery_quote
    FOREIGN KEY (delivery_quote_id) REFERENCES delivery_quote (id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT chk_delivery_status CHECK (status IN (
    'QUOTED', 'DISPATCHING', 'FAILED', 'PENDING', 'COURIER_ASSIGNED', 'PICKUP',
    'PICKUP_COMPLETE', 'DROPOFF', 'DELIVERED', 'CANCELED', 'RETURNED'
  ))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
