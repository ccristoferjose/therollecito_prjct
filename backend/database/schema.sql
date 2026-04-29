-- =============================================================================
-- The Rollecito — Bakery Ordering Platform - Database Schema
-- MySQL 8.x | Normalized to 3NF
--
-- This is the initial, consolidated schema. All columns/indexes/FKs that
-- were previously staged through `migrations/` (priority + cancel/refund,
-- promo codes, per-day display number, dashboard reporting) are included
-- here so a fresh DB is created with the final shape in a single pass.
-- =============================================================================

-- Set database default collation to match all tables.
-- Without this, MySQL 8 defaults to utf8mb4_0900_ai_ci, which causes
-- "Illegal mix of collations" errors in stored procedure comparisons.
ALTER DATABASE restaurant_ordering CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 1. ROLE (lookup table for RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE role (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50)  NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_role_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. USER
-- -----------------------------------------------------------------------------
CREATE TABLE `user` (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  firebase_uid  VARCHAR(128)  NULL,
  email         VARCHAR(255)  NOT NULL,
  password_hash VARCHAR(255)  NULL COMMENT 'bcrypt hash — only for staff (admin/manager)',
  first_name    VARCHAR(100)  NOT NULL,
  last_name     VARCHAR(100)  NOT NULL,
  phone         VARCHAR(20)   NULL,
  role_id       INT UNSIGNED  NOT NULL,
  location_id   INT UNSIGNED  NULL COMMENT 'assigned location for managers',
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_user_firebase_uid (firebase_uid),
  UNIQUE KEY uq_user_email (email),
  INDEX idx_user_role (role_id),

  CONSTRAINT fk_user_role
    FOREIGN KEY (role_id) REFERENCES role (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. LOCATION (restaurant branches)
-- -----------------------------------------------------------------------------
CREATE TABLE location (
  id           INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name         VARCHAR(150)  NOT NULL,
  address      VARCHAR(255)  NOT NULL,
  city         VARCHAR(100)  NOT NULL,
  state        VARCHAR(100)  NOT NULL,
  zip_code     VARCHAR(20)   NOT NULL,
  phone        VARCHAR(20)   NULL,
  is_active    TINYINT(1)    NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. MENU (global — not tied to a single location)
-- -----------------------------------------------------------------------------
CREATE TABLE menu (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(150)  NOT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. CATEGORY
-- -----------------------------------------------------------------------------
CREATE TABLE category (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  menu_id     INT UNSIGNED  NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  description TEXT          NULL,
  sort_order  INT UNSIGNED  NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_category_menu (menu_id),

  CONSTRAINT fk_category_menu
    FOREIGN KEY (menu_id) REFERENCES menu (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. ITEM
-- -----------------------------------------------------------------------------
CREATE TABLE item (
  id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED    NOT NULL,
  name        VARCHAR(150)    NOT NULL,
  description TEXT            NULL,
  price       DECIMAL(10, 2)  NOT NULL,
  image_url   VARCHAR(500)    NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  INT UNSIGNED    NOT NULL DEFAULT 0,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_item_category (category_id),

  CONSTRAINT fk_item_category
    FOREIGN KEY (category_id) REFERENCES category (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6b. ITEM_LOCATION (junction: which items are available at which locations)
-- -----------------------------------------------------------------------------
CREATE TABLE item_location (
  item_id     INT UNSIGNED NOT NULL,
  location_id INT UNSIGNED NOT NULL,

  PRIMARY KEY (item_id, location_id),

  CONSTRAINT fk_item_location_item
    FOREIGN KEY (item_id) REFERENCES item (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_item_location_location
    FOREIGN KEY (location_id) REFERENCES location (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. ITEM_OPTION (e.g. "Size", "Extras", "Toppings")
-- -----------------------------------------------------------------------------
CREATE TABLE item_option (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  item_id     INT UNSIGNED  NOT NULL,
  name        VARCHAR(100)  NOT NULL,
  is_required TINYINT(1)    NOT NULL DEFAULT 0,
  max_choices INT UNSIGNED  NULL COMMENT 'NULL = unlimited selections',

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_item_option_item (item_id),

  CONSTRAINT fk_item_option_item
    FOREIGN KEY (item_id) REFERENCES item (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. ITEM_OPTION_VALUE (e.g. "Large", "Extra Cheese")
-- -----------------------------------------------------------------------------
CREATE TABLE item_option_value (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  item_option_id INT UNSIGNED    NOT NULL,
  name           VARCHAR(100)    NOT NULL,
  price_modifier DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_item_option_value_option (item_option_id),

  CONSTRAINT fk_item_option_value_option
    FOREIGN KEY (item_option_id) REFERENCES item_option (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 9. ORDER_STATUS (normalized lookup)
-- -----------------------------------------------------------------------------
CREATE TABLE order_status (
  id   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50)  NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_order_status_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 10. ORDER (master)
--
--   - user_id is NULL for guest orders
--   - guest_name / guest_phone capture guest checkout info
--   - total_amount is intentionally stored (denormalized) to lock the price
--     at the moment of order. Recalculating from current item prices would
--     produce incorrect historical totals after price changes.
-- -----------------------------------------------------------------------------
CREATE TABLE `order` (
  id              INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  location_id     INT UNSIGNED    NOT NULL,
  user_id         INT UNSIGNED    NULL,
  status_id       INT UNSIGNED    NOT NULL,
  tracking_code   CHAR(36)        NOT NULL,
  display_number  INT UNSIGNED    NOT NULL DEFAULT 0,
  guest_name      VARCHAR(150)    NULL,
  guest_phone     VARCHAR(20)     NULL,
  pickup_time     DATETIME        NULL,
  total_amount    DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  subtotal_amount DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  discount_amount DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
  promotion_id    INT UNSIGNED    NULL,
  promotion_code  VARCHAR(50)     NULL,
  notes           TEXT            NULL,
  is_priority     TINYINT(1)      NOT NULL DEFAULT 0,
  priority_set_at DATETIME        NULL,
  priority_reason TEXT            NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_order_tracking_code (tracking_code),
  INDEX idx_order_kitchen (location_id, status_id, created_at),
  INDEX idx_order_display (location_id, created_at, display_number),
  INDEX idx_order_user (user_id),
  INDEX idx_order_status (status_id),

  CONSTRAINT fk_order_location
    FOREIGN KEY (location_id) REFERENCES location (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,

  CONSTRAINT fk_order_user
    FOREIGN KEY (user_id) REFERENCES `user` (id)
    ON UPDATE CASCADE ON DELETE SET NULL,

  CONSTRAINT fk_order_status
    FOREIGN KEY (status_id) REFERENCES order_status (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
  -- FK to promotion is deferred (promotion table defined after order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 11. ORDER_ITEM (detail level 1)
--
--   unit_price is snapshotted at order time so historical orders remain
--   accurate after menu price changes.
-- -----------------------------------------------------------------------------
CREATE TABLE order_item (
  id         INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_id   INT UNSIGNED    NOT NULL,
  item_id    INT UNSIGNED    NOT NULL,
  quantity   INT UNSIGNED    NOT NULL DEFAULT 1,
  unit_price DECIMAL(10, 2)  NOT NULL,
  notes      TEXT            NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_order_item_order (order_id),
  INDEX idx_order_item_item (item_id),

  CONSTRAINT fk_order_item_order
    FOREIGN KEY (order_id) REFERENCES `order` (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_order_item_item
    FOREIGN KEY (item_id) REFERENCES item (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 12. ORDER_ITEM_OPTION (detail level 2)
--
--   Captures the specific option value chosen for each order item.
--   price_modifier is snapshotted at order time.
-- -----------------------------------------------------------------------------
CREATE TABLE order_item_option (
  id                  INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_item_id       INT UNSIGNED    NOT NULL,
  item_option_value_id INT UNSIGNED   NOT NULL,
  price_modifier      DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  INDEX idx_order_item_option_order_item (order_item_id),
  INDEX idx_order_item_option_value (item_option_value_id),

  CONSTRAINT fk_order_item_option_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_item (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_order_item_option_value
    FOREIGN KEY (item_option_value_id) REFERENCES item_option_value (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 13. PAYMENT
-- -----------------------------------------------------------------------------
CREATE TABLE payment (
  id                        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  order_id                  INT UNSIGNED    NOT NULL,
  stripe_payment_intent_id  VARCHAR(255)    NOT NULL,
  amount                    DECIMAL(10, 2)  NOT NULL,
  currency                  VARCHAR(3)      NOT NULL DEFAULT 'USD',
  status                    VARCHAR(50)     NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_stripe (stripe_payment_intent_id),
  INDEX idx_payment_order (order_id),

  CONSTRAINT fk_payment_order
    FOREIGN KEY (order_id) REFERENCES `order` (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 14. PROMOTION
-- -----------------------------------------------------------------------------
CREATE TABLE promotion (
  id             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  code           VARCHAR(50)     NOT NULL,
  description    TEXT            NULL,
  discount_type  VARCHAR(20)     NOT NULL COMMENT 'percentage or fixed',
  discount_value DECIMAL(10, 2)  NOT NULL,
  min_order      DECIMAL(10, 2)  NULL,
  max_uses       INT UNSIGNED    NULL,
  current_uses   INT UNSIGNED    NOT NULL DEFAULT 0,
  starts_at      DATETIME        NOT NULL,
  expires_at     DATETIME        NULL,
  is_active      TINYINT(1)      NOT NULL DEFAULT 1,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_promotion_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 15. NEWSLETTER_SUBSCRIBER
-- -----------------------------------------------------------------------------
CREATE TABLE newsletter_subscriber (
  id    INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email VARCHAR(255)  NOT NULL,

  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_subscriber_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- DEFERRED CONSTRAINTS (cross-references between early and late tables)
-- =============================================================================

ALTER TABLE `user`
  ADD CONSTRAINT fk_user_location
    FOREIGN KEY (location_id) REFERENCES location (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE `order`
  ADD CONSTRAINT fk_order_promotion
    FOREIGN KEY (promotion_id) REFERENCES promotion (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- =============================================================================
-- SEED DATA: Roles and Order Statuses
-- =============================================================================

INSERT INTO role (name) VALUES
  ('admin'),
  ('manager'),
  ('staff'),
  ('client');

INSERT INTO order_status (name) VALUES
  ('CREATED'),
  ('PAID'),
  ('PREPARING'),
  ('READY'),
  ('COMPLETED'),
  ('CANCELED');
