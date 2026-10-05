-- 011_delivery_flat_subsidy.sql
--
-- Second way to split the courier fee (migration 010 added the percentage):
--
--   fee_split_mode = 'PERCENT'  customer pays customer_fee_percent of the fee
--                               (unchanged behaviour — the default)
--   fee_split_mode = 'FLAT'     the restaurant covers up to restaurant_flat_amount
--                               dollars of the fee; the customer pays the rest,
--                               never less than $0.
--                               e.g. fee $10.99, flat $3.00 -> customer $7.99
--                                    fee  $2.50, flat $3.00 -> customer $0.00
--
-- Both values are kept, so switching modes back and forth does not lose the
-- other setting. Additive and re-runnable; the defaults change nothing.
--
-- Apply with:
--   ./deploy/db-migrate.sh

SET @col_exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'delivery_settings' AND COLUMN_NAME = 'fee_split_mode'
);
SET @ddl := IF(@col_exists = 0,
  'ALTER TABLE delivery_settings
     ADD COLUMN fee_split_mode VARCHAR(10) NOT NULL DEFAULT ''PERCENT'' AFTER customer_fee_percent,
     ADD COLUMN restaurant_flat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER fee_split_mode,
     ADD CONSTRAINT chk_delivery_settings_mode CHECK (fee_split_mode IN (''PERCENT'', ''FLAT'')),
     ADD CONSTRAINT chk_delivery_settings_flat CHECK (restaurant_flat_amount >= 0)',
  'DO 0');
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
