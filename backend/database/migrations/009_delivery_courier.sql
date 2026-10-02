-- 009_delivery_courier.sql
--
-- Courier details for delivery tracking, taken from the provider's delivery
-- webhooks (Uber Direct `event.delivery_status` and `event.courier_update`).
--
-- Stored: what the customer is shown anyway on the provider's own tracking page
-- (name, photo, vehicle, masked plate, rating) plus two flags that drive the UI
-- (courier_imminent, undeliverable_reason).
-- NOT stored: the courier's phone number and live GPS position. Contacting the
-- courier and the live map stay on the provider's tracking_url page; this app
-- deliberately has no live-map system.
--
-- provider_updated_at is the provider's own "updated" timestamp for the latest
-- event applied. Webhooks can arrive out of order; an event older than this is
-- not allowed to overwrite newer ETAs or courier details.
--
-- Additive and re-runnable.
--
-- Apply with:
--   ./deploy/db-migrate.sh

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery' AND COLUMN_NAME = 'courier_name'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE delivery
     ADD COLUMN courier_name          VARCHAR(100)  NULL AFTER tracking_url,
     ADD COLUMN courier_image_url     VARCHAR(500)  NULL AFTER courier_name,
     ADD COLUMN courier_vehicle       VARCHAR(150)  NULL AFTER courier_image_url,
     ADD COLUMN courier_vehicle_type  VARCHAR(30)   NULL AFTER courier_vehicle,
     ADD COLUMN courier_license_plate VARCHAR(20)   NULL AFTER courier_vehicle_type,
     ADD COLUMN courier_rating        DECIMAL(3, 2) NULL AFTER courier_license_plate,
     ADD COLUMN courier_imminent      TINYINT(1)    NOT NULL DEFAULT 0 AFTER courier_rating,
     ADD COLUMN undeliverable_reason  VARCHAR(100)  NULL AFTER courier_imminent,
     ADD COLUMN provider_updated_at   DATETIME(3)   NULL AFTER undeliverable_reason',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
