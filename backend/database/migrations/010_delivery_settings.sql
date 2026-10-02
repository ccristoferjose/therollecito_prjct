-- 010_delivery_settings.sql
--
-- Admin-managed delivery pricing, one global setting for every location:
--
--   min_order_amount       Delivery is only offered when the cart subtotal
--                          (before discounts) is at least this much. 0 = no minimum.
--   customer_fee_percent   Share of the provider's (Uber's) fee the customer
--                          pays. The restaurant covers the rest:
--                            100 -> customer pays it all (the behaviour so far)
--                             50 -> 50 / 50
--                             40 -> customer 40 %, restaurant 60 %
--                              0 -> free delivery for the customer
--
-- Single-row table (id is pinned to 1 by a CHECK), so there is never any
-- ambiguity about which settings apply. The defaults reproduce today's
-- behaviour exactly, so applying this migration changes nothing on its own.
--
-- Changing the split never re-prices a quote the customer already accepted:
-- quotes store customer_delivery_fee at quote time (delivery_quote /
-- delivery). The new split applies to the next quote.
--
-- Additive and re-runnable.
--
-- Apply with:
--   ./deploy/db-migrate.sh

CREATE TABLE IF NOT EXISTS delivery_settings (
  id                    TINYINT UNSIGNED NOT NULL DEFAULT 1,
  min_order_amount      DECIMAL(10, 2)   NOT NULL DEFAULT 0.00,
  customer_fee_percent  DECIMAL(5, 2)    NOT NULL DEFAULT 100.00,
  updated_by            INT UNSIGNED     NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),

  CONSTRAINT fk_delivery_settings_user
    FOREIGN KEY (updated_by) REFERENCES `user` (id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT chk_delivery_settings_single_row CHECK (id = 1),
  CONSTRAINT chk_delivery_settings_min CHECK (min_order_amount >= 0),
  CONSTRAINT chk_delivery_settings_percent CHECK (customer_fee_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO delivery_settings (id) VALUES (1);
