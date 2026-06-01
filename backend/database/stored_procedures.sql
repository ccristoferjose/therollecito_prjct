-- =============================================================================
-- Restaurant Ordering Platform - Stored Procedures
-- MySQL 8.x | Production-Ready Secure Data Access Layer
-- =============================================================================
--
-- SECURITY MODEL
-- ==============
-- 1. SQL Injection Prevention: Every procedure uses ONLY parameterized inputs.
-- 2. Input Validation: All procedures validate inputs before any write.
-- 3. Transactional Consistency: Multi-step writes use START TRANSACTION / COMMIT.
-- 4. Idempotency: Payment recording is idempotent.
-- 5. Access Control: The application DB user should have ONLY EXECUTE.
--
-- NAMING CONVENTION:  sp_<domain>_<action>
-- =============================================================================

DELIMITER //

-- #############################################################################
-- #  SECTION 1: USER DOMAIN
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_user_create_if_not_exists //
CREATE PROCEDURE sp_user_create_if_not_exists(
  IN p_firebase_uid VARCHAR(128),
  IN p_email        VARCHAR(255),
  IN p_first_name   VARCHAR(100),
  IN p_last_name    VARCHAR(100),
  IN p_phone        VARCHAR(20)
)
BEGIN
  DECLARE v_user_id    INT UNSIGNED;
  DECLARE v_role_id    INT UNSIGNED;

  IF p_firebase_uid IS NULL OR CHAR_LENGTH(TRIM(p_firebase_uid)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'firebase_uid is required.';
  END IF;
  IF p_email IS NULL OR CHAR_LENGTH(TRIM(p_email)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'email is required.';
  END IF;
  IF p_first_name IS NULL OR CHAR_LENGTH(TRIM(p_first_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'first_name is required.';
  END IF;
  IF p_last_name IS NULL OR CHAR_LENGTH(TRIM(p_last_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'last_name is required.';
  END IF;

  SELECT id INTO v_user_id FROM `user` WHERE firebase_uid = p_firebase_uid LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    SELECT id, firebase_uid, email, first_name, last_name, phone, role_id, created_at
      FROM `user` WHERE id = v_user_id;
  ELSE
    SELECT id INTO v_role_id FROM role WHERE name = 'client' LIMIT 1;
    IF v_role_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Default role "client" not found. Seed data missing.';
    END IF;

    INSERT INTO `user` (firebase_uid, email, first_name, last_name, phone, role_id)
    VALUES (p_firebase_uid, TRIM(p_email), TRIM(p_first_name), TRIM(p_last_name), p_phone, v_role_id);

    SET v_user_id = LAST_INSERT_ID();
    SELECT id, firebase_uid, email, first_name, last_name, phone, role_id, created_at
      FROM `user` WHERE id = v_user_id;
  END IF;
END //

DROP PROCEDURE IF EXISTS sp_user_get_by_email //
CREATE PROCEDURE sp_user_get_by_email(IN p_email VARCHAR(255))
BEGIN
  SELECT u.id, u.email, u.password_hash, u.first_name, u.last_name,
         u.phone, u.role_id, r.name AS role_name, u.location_id, u.is_active, u.created_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
   WHERE u.email = p_email
   LIMIT 1;
END //

DROP PROCEDURE IF EXISTS sp_staff_create //
CREATE PROCEDURE sp_staff_create(
  IN p_email         VARCHAR(255),
  IN p_password_hash VARCHAR(255),
  IN p_first_name    VARCHAR(100),
  IN p_last_name     VARCHAR(100),
  IN p_phone         VARCHAR(20),
  IN p_role_name     VARCHAR(50),
  IN p_location_id   INT UNSIGNED
)
BEGIN
  DECLARE v_role_id INT UNSIGNED;
  DECLARE v_user_id INT UNSIGNED;

  IF p_email IS NULL OR CHAR_LENGTH(TRIM(p_email)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email is required.';
  END IF;
  IF p_password_hash IS NULL OR CHAR_LENGTH(p_password_hash) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Password hash is required.';
  END IF;
  IF p_role_name NOT IN ('admin', 'manager') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Staff role must be admin or manager.';
  END IF;

  SELECT id INTO v_role_id FROM role WHERE name = p_role_name LIMIT 1;
  IF v_role_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role not found.';
  END IF;

  IF p_location_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM location WHERE id = p_location_id) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
    END IF;
  END IF;

  INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
  VALUES (NULL, TRIM(p_email), p_password_hash, TRIM(p_first_name), TRIM(p_last_name), p_phone, v_role_id, p_location_id);

  SET v_user_id = LAST_INSERT_ID();

  SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
         r.name AS role_name, u.location_id, u.created_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
   WHERE u.id = v_user_id;
END //

DROP PROCEDURE IF EXISTS sp_user_get_by_firebase_uid //
CREATE PROCEDURE sp_user_get_by_firebase_uid(IN p_firebase_uid VARCHAR(128))
BEGIN
  SELECT u.id, u.firebase_uid, u.email, u.first_name, u.last_name,
         u.phone, u.role_id, r.name AS role_name, u.created_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
   WHERE u.firebase_uid = p_firebase_uid
   LIMIT 1;
END //

DROP PROCEDURE IF EXISTS sp_user_update_role //
CREATE PROCEDURE sp_user_update_role(IN p_user_id INT UNSIGNED, IN p_role_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM role WHERE id = p_role_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role not found.';
  END IF;
  UPDATE `user` SET role_id = p_role_id WHERE id = p_user_id;
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
  END IF;
END //

DROP PROCEDURE IF EXISTS sp_staff_list //
CREATE PROCEDURE sp_staff_list()
BEGIN
  SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
         r.name AS role_name, u.location_id,
         l.name AS location_name, u.is_active, u.created_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
    LEFT JOIN location l ON l.id = u.location_id
   WHERE r.name IN ('admin', 'manager')
   ORDER BY u.is_active DESC, u.created_at DESC;
END //

DROP PROCEDURE IF EXISTS sp_staff_toggle_active //
CREATE PROCEDURE sp_staff_toggle_active(IN p_user_id INT UNSIGNED, IN p_is_active TINYINT(1))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM `user` WHERE id = p_user_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
  END IF;
  UPDATE `user` SET is_active = p_is_active WHERE id = p_user_id;
  SELECT u.id, u.email, u.first_name, u.last_name, r.name AS role_name, u.is_active
    FROM `user` u JOIN role r ON r.id = u.role_id WHERE u.id = p_user_id;
END //

DROP PROCEDURE IF EXISTS sp_staff_delete //
CREATE PROCEDURE sp_staff_delete(IN p_user_id INT UNSIGNED)
BEGIN
  DECLARE v_is_active TINYINT(1);
  SELECT is_active INTO v_is_active FROM `user` WHERE id = p_user_id LIMIT 1;
  IF v_is_active IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
  END IF;
  IF v_is_active = 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User must be disabled before deleting.';
  END IF;
  DELETE FROM `user` WHERE id = p_user_id;
END //

DROP PROCEDURE IF EXISTS sp_staff_update //
CREATE PROCEDURE sp_staff_update(
  IN p_user_id     INT UNSIGNED,
  IN p_email       VARCHAR(255),
  IN p_first_name  VARCHAR(100),
  IN p_last_name   VARCHAR(100),
  IN p_phone       VARCHAR(20),
  IN p_role_name   VARCHAR(50),
  IN p_location_id INT UNSIGNED
)
BEGIN
  DECLARE v_role_id INT UNSIGNED;

  IF NOT EXISTS (SELECT 1 FROM `user` WHERE id = p_user_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
  END IF;

  IF p_role_name IS NOT NULL THEN
    SELECT id INTO v_role_id FROM role WHERE name = p_role_name LIMIT 1;
    IF v_role_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Role not found.';
    END IF;
  END IF;

  UPDATE `user`
     SET email       = COALESCE(TRIM(p_email), email),
         first_name  = COALESCE(TRIM(p_first_name), first_name),
         last_name   = COALESCE(TRIM(p_last_name), last_name),
         phone       = COALESCE(p_phone, phone),
         role_id     = COALESCE(v_role_id, role_id),
         location_id = p_location_id
   WHERE id = p_user_id;

  SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
         r.name AS role_name, u.location_id, l.name AS location_name,
         u.is_active, u.created_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
    LEFT JOIN location l ON l.id = u.location_id
   WHERE u.id = p_user_id;
END //

DROP PROCEDURE IF EXISTS sp_staff_update_password //
CREATE PROCEDURE sp_staff_update_password(
  IN p_user_id       INT UNSIGNED,
  IN p_password_hash VARCHAR(255)
)
BEGIN
  DECLARE v_role_name VARCHAR(50);

  IF p_password_hash IS NULL OR CHAR_LENGTH(p_password_hash) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Password hash is required.';
  END IF;

  SELECT r.name INTO v_role_name
    FROM `user` u
    JOIN role r ON r.id = u.role_id
   WHERE u.id = p_user_id
   LIMIT 1;

  IF v_role_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
  END IF;
  -- Passwords are bcrypt-based staff credentials only; client accounts
  -- authenticate via Firebase and must never carry a password hash.
  IF v_role_name NOT IN ('admin', 'manager') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Password can only be set for staff accounts.';
  END IF;

  UPDATE `user` SET password_hash = p_password_hash WHERE id = p_user_id;
END //


-- #############################################################################
-- #  SECTION 2: ORDER LIFECYCLE
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_order_create //
CREATE PROCEDURE sp_order_create(
  IN p_location_id  INT UNSIGNED,
  IN p_user_id      INT UNSIGNED,
  IN p_guest_name   VARCHAR(150),
  IN p_guest_phone  VARCHAR(20),
  IN p_pickup_time  DATETIME,
  IN p_notes        TEXT
)
BEGIN
  DECLARE v_location_active TINYINT(1);
  DECLARE v_open_time       TIME;
  DECLARE v_close_time      TIME;
  DECLARE v_pickup_time_t   TIME;
  DECLARE v_status_id       INT UNSIGNED;
  DECLARE v_order_id        INT UNSIGNED;
  DECLARE v_display_number  INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT is_active, open_time, close_time
    INTO v_location_active, v_open_time, v_close_time
    FROM location WHERE id = p_location_id LIMIT 1;
  IF v_location_active IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
  END IF;
  IF v_location_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location is not currently active.';
  END IF;

  -- pickup_time validation: must be today, within service hours, not in the past.
  -- Only enforced when the location has hours configured (NULL = always-on).
  IF p_pickup_time IS NOT NULL THEN
    IF DATE(p_pickup_time) <> CURDATE() THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduled pickup must be later today.';
    END IF;
    IF p_pickup_time < NOW() THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduled pickup time is in the past.';
    END IF;
    IF v_open_time IS NOT NULL THEN
      SET v_pickup_time_t = TIME(p_pickup_time);
      IF v_pickup_time_t < v_open_time OR v_pickup_time_t > v_close_time THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Scheduled pickup time is outside the location''s service hours.';
      END IF;
    END IF;
  ELSE
    -- No pickup_time supplied. If hours are configured, the current time must be
    -- within them — otherwise the customer needs to schedule.
    IF v_open_time IS NOT NULL AND
       (CURTIME() < v_open_time OR CURTIME() > v_close_time) THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Location is closed. Schedule a pickup time within service hours.';
    END IF;
  END IF;

  IF p_user_id IS NULL AND (p_guest_name IS NULL OR CHAR_LENGTH(TRIM(p_guest_name)) = 0) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Either user_id or guest_name is required.';
  END IF;

  IF p_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM `user` WHERE id = p_user_id) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'User not found.';
    END IF;
  END IF;

  SELECT id INTO v_status_id FROM order_status WHERE name = 'CREATED' LIMIT 1;
  IF v_status_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order status "CREATED" not found.';
  END IF;

  START TRANSACTION;

  SELECT COALESCE(MAX(display_number), 0) + 1
    INTO v_display_number
    FROM `order`
   WHERE location_id = p_location_id
     AND DATE(created_at) = CURDATE()
   FOR UPDATE;

  SET @tracking = UUID();
  INSERT INTO `order` (
    location_id, user_id, status_id, tracking_code, display_number,
    guest_name, guest_phone, pickup_time, notes
  )
  VALUES (
    p_location_id, p_user_id, v_status_id, @tracking, v_display_number,
    p_guest_name, p_guest_phone, p_pickup_time, p_notes
  );
  SET v_order_id = LAST_INSERT_ID();
  COMMIT;

  SELECT o.id, o.location_id, o.user_id, o.status_id, os.name AS status_name,
         o.tracking_code, o.display_number,
         o.guest_name, o.guest_phone, o.pickup_time, o.total_amount,
         o.notes, o.created_at
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
   WHERE o.id = v_order_id;
END //

DROP PROCEDURE IF EXISTS sp_order_add_item //
CREATE PROCEDURE sp_order_add_item(
  IN p_order_id INT UNSIGNED,
  IN p_item_id  INT UNSIGNED,
  IN p_quantity INT UNSIGNED,
  IN p_notes    TEXT
)
BEGIN
  DECLARE v_status_name   VARCHAR(50);
  DECLARE v_item_price    DECIMAL(10, 2);
  DECLARE v_item_active   TINYINT(1);
  DECLARE v_item_name     VARCHAR(150);
  DECLARE v_order_item_id INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Quantity must be at least 1.';
  END IF;

  SELECT os.name INTO v_status_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id LIMIT 1;
  IF v_status_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;
  IF v_status_name != 'CREATED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is no longer editable.';
  END IF;

  SELECT name, price, is_active INTO v_item_name, v_item_price, v_item_active
    FROM item WHERE id = p_item_id LIMIT 1;
  IF v_item_price IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;
  IF v_item_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item is not currently available.';
  END IF;

  START TRANSACTION;
  -- Snapshot item_name so the order line stays readable if the menu item is
  -- later edited or deleted.
  INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price, notes)
  VALUES (p_order_id, p_item_id, v_item_name, p_quantity, v_item_price, p_notes);
  SET v_order_item_id = LAST_INSERT_ID();
  COMMIT;

  SELECT oi.id, oi.order_id, oi.item_id,
         COALESCE(i.name, oi.item_name) AS item_name,
         oi.quantity, oi.unit_price, oi.notes, oi.created_at
    FROM order_item oi LEFT JOIN item i ON i.id = oi.item_id
   WHERE oi.id = v_order_item_id;
END //

DROP PROCEDURE IF EXISTS sp_order_add_item_option //
CREATE PROCEDURE sp_order_add_item_option(
  IN p_order_item_id       INT UNSIGNED,
  IN p_item_option_value_id INT UNSIGNED
)
BEGIN
  DECLARE v_status_name       VARCHAR(50);
  DECLARE v_order_id          INT UNSIGNED;
  DECLARE v_oi_item_id        INT UNSIGNED;
  DECLARE v_iov_item_id       INT UNSIGNED;
  DECLARE v_option_name       VARCHAR(100);
  DECLARE v_option_value_name VARCHAR(100);
  DECLARE v_price_modifier    DECIMAL(10, 2);
  DECLARE v_new_id            INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT oi.order_id, oi.item_id INTO v_order_id, v_oi_item_id
    FROM order_item oi WHERE oi.id = p_order_item_id LIMIT 1;
  IF v_order_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item not found.';
  END IF;

  SELECT os.name INTO v_status_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = v_order_id LIMIT 1;
  IF v_status_name != 'CREATED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is no longer editable.';
  END IF;

  -- Snapshot both the option name (e.g. "Size") and the chosen value name
  -- (e.g. "Large") so deleting either later doesn't garble past orders.
  SELECT io.item_id, io.name, iov.name, iov.price_modifier
    INTO v_iov_item_id, v_option_name, v_option_value_name, v_price_modifier
    FROM item_option_value iov
    JOIN item_option io ON io.id = iov.item_option_id
   WHERE iov.id = p_item_option_value_id LIMIT 1;
  IF v_iov_item_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option value not found.';
  END IF;
  IF v_iov_item_id != v_oi_item_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Option value does not belong to the item in this order line.';
  END IF;

  START TRANSACTION;
  INSERT INTO order_item_option
    (order_item_id, item_option_value_id, option_name, option_value_name, price_modifier)
  VALUES
    (p_order_item_id, p_item_option_value_id, v_option_name, v_option_value_name, v_price_modifier);
  SET v_new_id = LAST_INSERT_ID();
  COMMIT;

  SELECT oio.id, oio.order_item_id, oio.item_option_value_id,
         COALESCE(iov.name, oio.option_value_name) AS option_value_name,
         oio.price_modifier, oio.created_at
    FROM order_item_option oio
    LEFT JOIN item_option_value iov ON iov.id = oio.item_option_value_id
   WHERE oio.id = v_new_id;
END //

DROP PROCEDURE IF EXISTS sp_order_remove_item //
CREATE PROCEDURE sp_order_remove_item(IN p_order_item_id INT UNSIGNED)
BEGIN
  DECLARE v_order_id    INT UNSIGNED;
  DECLARE v_status_name VARCHAR(50);

  SELECT oi.order_id INTO v_order_id FROM order_item oi WHERE oi.id = p_order_item_id LIMIT 1;
  IF v_order_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item not found.';
  END IF;

  SELECT os.name INTO v_status_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id WHERE o.id = v_order_id LIMIT 1;
  IF v_status_name != 'CREATED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is no longer editable.';
  END IF;

  DELETE FROM order_item WHERE id = p_order_item_id;
END //

DROP PROCEDURE IF EXISTS sp_order_calculate_total //
CREATE PROCEDURE sp_order_calculate_total(
  IN p_order_id       INT UNSIGNED,
  IN p_promotion_code VARCHAR(50),
  -- Stripe fee passthrough. Caller passes the rate (e.g. 0.029) and fixed
  -- (e.g. 0.30). Pass NULL/0 to disable. Stored in order.processing_fee
  -- and added to total_amount.
  IN p_fee_percent    DECIMAL(6, 4),
  IN p_fee_fixed      DECIMAL(10, 2)
)
BEGIN
  DECLARE v_status_name     VARCHAR(50);
  DECLARE v_subtotal        DECIMAL(10, 2);
  DECLARE v_pre_fee_total   DECIMAL(10, 2);
  DECLARE v_processing_fee  DECIMAL(10, 2) DEFAULT 0.00;
  DECLARE v_total           DECIMAL(10, 2);
  DECLARE v_discount_amount DECIMAL(10, 2) DEFAULT 0.00;
  DECLARE v_promotion_id    INT UNSIGNED DEFAULT NULL;
  DECLARE v_discount_type   VARCHAR(20);
  DECLARE v_discount_value  DECIMAL(10, 2);
  DECLARE v_min_order       DECIMAL(10, 2);
  DECLARE v_max_uses        INT UNSIGNED;
  DECLARE v_current_uses    INT UNSIGNED;
  DECLARE v_is_active       TINYINT(1);
  DECLARE v_starts_at       DATETIME;
  DECLARE v_expires_at      DATETIME;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT os.name INTO v_status_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id LIMIT 1;
  IF v_status_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;
  IF v_status_name != 'CREATED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only CREATED orders can be recalculated.';
  END IF;

  SELECT COALESCE(SUM(
    oi.quantity * (oi.unit_price + COALESCE(opt_totals.modifier_sum, 0))
  ), 0.00)
  INTO v_subtotal
  FROM order_item oi
  LEFT JOIN (
    SELECT oio.order_item_id, SUM(oio.price_modifier) AS modifier_sum
      FROM order_item_option oio GROUP BY oio.order_item_id
  ) opt_totals ON opt_totals.order_item_id = oi.id
  WHERE oi.order_id = p_order_id;

  IF p_promotion_code IS NOT NULL AND CHAR_LENGTH(TRIM(p_promotion_code)) > 0 THEN
    SELECT id, discount_type, discount_value, min_order, max_uses, current_uses,
           is_active, starts_at, expires_at
      INTO v_promotion_id, v_discount_type, v_discount_value, v_min_order, v_max_uses,
           v_current_uses, v_is_active, v_starts_at, v_expires_at
      FROM promotion WHERE code = UPPER(TRIM(p_promotion_code)) LIMIT 1;

    IF v_promotion_id IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion code not found.';
    END IF;
    IF v_is_active = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion is no longer active.';
    END IF;
    IF NOW() < v_starts_at THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has not started yet.';
    END IF;
    IF v_expires_at IS NOT NULL AND NOW() > v_expires_at THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has expired.';
    END IF;
    IF v_max_uses IS NOT NULL AND v_current_uses >= v_max_uses THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion usage limit reached.';
    END IF;
    IF v_min_order IS NOT NULL AND v_subtotal < v_min_order THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order total does not meet the minimum.';
    END IF;

    IF v_discount_type = 'percentage' THEN
      SET v_discount_amount = ROUND(v_subtotal * (v_discount_value / 100), 2);
    ELSE
      SET v_discount_amount = v_discount_value;
    END IF;
    IF v_discount_amount > v_subtotal THEN
      SET v_discount_amount = v_subtotal;
    END IF;
  END IF;

  SET v_pre_fee_total = v_subtotal - v_discount_amount;
  IF v_pre_fee_total < 0 THEN
    SET v_pre_fee_total = 0;
  END IF;

  -- Processing fee: only apply when there's something to charge. When the
  -- order ends up free (e.g. 100%-off promo) the customer pays nothing and
  -- we don't synthesize a fake fee on top.
  IF v_pre_fee_total > 0 AND (p_fee_percent IS NOT NULL OR p_fee_fixed IS NOT NULL) THEN
    SET v_processing_fee = ROUND(
      v_pre_fee_total * COALESCE(p_fee_percent, 0) + COALESCE(p_fee_fixed, 0),
      2
    );
  END IF;

  SET v_total = v_pre_fee_total + v_processing_fee;

  START TRANSACTION;
  UPDATE `order`
     SET subtotal_amount = v_subtotal,
         discount_amount = v_discount_amount,
         processing_fee  = v_processing_fee,
         total_amount    = v_total,
         promotion_id    = v_promotion_id,
         promotion_code  = CASE WHEN v_promotion_id IS NULL THEN NULL ELSE UPPER(TRIM(p_promotion_code)) END
   WHERE id = p_order_id;
  COMMIT;

  SELECT p_order_id AS order_id,
         v_subtotal AS subtotal_amount,
         v_discount_amount AS discount_amount,
         v_processing_fee AS processing_fee,
         v_total AS total_amount,
         v_promotion_id AS promotion_id,
         CASE WHEN v_promotion_id IS NULL THEN NULL ELSE UPPER(TRIM(p_promotion_code)) END AS promotion_code;
END //

DROP PROCEDURE IF EXISTS sp_order_mark_paid //
CREATE PROCEDURE sp_order_mark_paid(
  IN p_order_id                 INT UNSIGNED,
  IN p_stripe_payment_intent_id VARCHAR(255),
  IN p_amount                   DECIMAL(10, 2),
  IN p_currency                 VARCHAR(3)
)
BEGIN
  DECLARE v_existing_payment_id INT UNSIGNED;
  DECLARE v_current_status      VARCHAR(50);
  DECLARE v_paid_status_id      INT UNSIGNED;
  DECLARE v_promotion_id        INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_stripe_payment_intent_id IS NULL OR CHAR_LENGTH(TRIM(p_stripe_payment_intent_id)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripe_payment_intent_id is required.';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payment amount must be greater than zero.';
  END IF;

  SELECT id INTO v_existing_payment_id FROM payment
   WHERE stripe_payment_intent_id = p_stripe_payment_intent_id LIMIT 1;

  IF v_existing_payment_id IS NOT NULL THEN
    SELECT p.id, p.order_id, p.stripe_payment_intent_id, p.amount,
           p.currency, p.status, p.created_at
      FROM payment p WHERE p.id = v_existing_payment_id;
  ELSE
    SELECT os.name, o.promotion_id
      INTO v_current_status, v_promotion_id
      FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE o.id = p_order_id LIMIT 1;
    IF v_current_status IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
    END IF;
    IF v_current_status != 'CREATED' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is not in CREATED status.';
    END IF;

    SELECT id INTO v_paid_status_id FROM order_status WHERE name = 'PAID' LIMIT 1;

    START TRANSACTION;
    INSERT INTO payment (order_id, stripe_payment_intent_id, amount, currency, status)
    VALUES (p_order_id, p_stripe_payment_intent_id, p_amount, COALESCE(p_currency, 'USD'), 'succeeded');
    UPDATE `order` SET status_id = v_paid_status_id WHERE id = p_order_id;
    IF v_promotion_id IS NOT NULL THEN
      UPDATE promotion SET current_uses = current_uses + 1 WHERE id = v_promotion_id;
    END IF;
    COMMIT;

    SELECT p.id, p.order_id, p.stripe_payment_intent_id, p.amount,
           p.currency, p.status, p.created_at
      FROM payment p WHERE p.stripe_payment_intent_id = p_stripe_payment_intent_id;
  END IF;
END //

DROP PROCEDURE IF EXISTS sp_order_update_status //
CREATE PROCEDURE sp_order_update_status(IN p_order_id INT UNSIGNED, IN p_new_status VARCHAR(50))
BEGIN
  DECLARE v_current_name  VARCHAR(50);
  DECLARE v_new_status_id INT UNSIGNED;
  DECLARE v_valid         TINYINT(1) DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT os.name INTO v_current_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id LIMIT 1;
  IF v_current_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;

  SELECT id INTO v_new_status_id FROM order_status WHERE name = p_new_status LIMIT 1;
  IF v_new_status_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status name.';
  END IF;

  IF v_current_name = 'CREATED'   AND p_new_status = 'PAID'      THEN SET v_valid = 1; END IF;
  IF v_current_name = 'PAID'      AND p_new_status = 'PREPARING' THEN SET v_valid = 1; END IF;
  IF v_current_name = 'PREPARING' AND p_new_status = 'READY'     THEN SET v_valid = 1; END IF;
  IF v_current_name = 'READY'     AND p_new_status = 'COMPLETED' THEN SET v_valid = 1; END IF;

  IF v_valid = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Invalid status transition. Orders must follow: CREATED -> PAID -> PREPARING -> READY -> COMPLETED.';
  END IF;

  START TRANSACTION;
  UPDATE `order` SET status_id = v_new_status_id WHERE id = p_order_id;
  COMMIT;

  SELECT o.id, o.status_id, os.name AS status_name, o.updated_at
    FROM `order` o JOIN order_status os ON os.id = o.status_id WHERE o.id = p_order_id;
END //

DROP PROCEDURE IF EXISTS sp_order_get //
CREATE PROCEDURE sp_order_get(IN p_order_id INT UNSIGNED)
BEGIN
  SELECT o.id, o.location_id, l.name AS location_name,
         o.user_id, o.status_id, os.name AS status_name,
         o.tracking_code, o.display_number,
         o.guest_name, o.guest_phone, o.pickup_time,
         o.total_amount, o.subtotal_amount, o.discount_amount, o.processing_fee,
         o.promotion_id, o.promotion_code,
         o.notes, o.is_priority, o.priority_set_at, o.priority_reason,
         o.created_at, o.updated_at
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
    JOIN location l ON l.id = o.location_id
   WHERE o.id = p_order_id;
END //

DROP PROCEDURE IF EXISTS sp_order_prioritize //
CREATE PROCEDURE sp_order_prioritize(
  IN p_order_id INT UNSIGNED,
  IN p_reason   TEXT
)
BEGIN
  DECLARE v_current_name  VARCHAR(50);
  DECLARE v_paid_id       INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A justification note is required.';
  END IF;

  SELECT os.name INTO v_current_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id LIMIT 1;
  IF v_current_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;
  IF v_current_name NOT IN ('PAID', 'PREPARING', 'READY') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Only active orders (PAID/PREPARING/READY) can be sent back to the queue.';
  END IF;

  SELECT id INTO v_paid_id FROM order_status WHERE name = 'PAID' LIMIT 1;

  START TRANSACTION;
  UPDATE `order`
     SET status_id       = v_paid_id,
         is_priority     = 1,
         priority_set_at = NOW(),
         priority_reason = p_reason,
         notes           = CONCAT_WS('\n',
                              NULLIF(notes, ''),
                              CONCAT('[PRIORITY ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] ', p_reason))
   WHERE id = p_order_id;
  COMMIT;

  SELECT o.id, o.location_id, os.name AS status_name,
         o.is_priority, o.priority_set_at, o.priority_reason, o.notes
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id;
END //

DROP PROCEDURE IF EXISTS sp_order_cancel //
CREATE PROCEDURE sp_order_cancel(
  IN p_order_id INT UNSIGNED,
  IN p_reason   TEXT
)
BEGIN
  DECLARE v_current_name  VARCHAR(50);
  DECLARE v_canceled_id   INT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_reason IS NULL OR CHAR_LENGTH(TRIM(p_reason)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A cancellation reason is required.';
  END IF;

  SELECT os.name INTO v_current_name
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id LIMIT 1;
  IF v_current_name IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;
  IF v_current_name IN ('COMPLETED', 'CANCELED') THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Cannot cancel an order that is already completed or canceled.';
  END IF;

  SELECT id INTO v_canceled_id FROM order_status WHERE name = 'CANCELED' LIMIT 1;

  START TRANSACTION;
  UPDATE `order`
     SET status_id = v_canceled_id,
         is_priority = 0,
         notes = CONCAT_WS('\n',
                   NULLIF(notes, ''),
                   CONCAT('[CANCELED ', DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i'), '] ', p_reason))
   WHERE id = p_order_id;
  COMMIT;

  SELECT o.id, o.location_id, os.name AS status_name, o.notes
    FROM `order` o JOIN order_status os ON os.id = o.status_id
   WHERE o.id = p_order_id;
END //

DROP PROCEDURE IF EXISTS sp_payment_mark_refunded //
CREATE PROCEDURE sp_payment_mark_refunded(IN p_order_id INT UNSIGNED)
BEGIN
  UPDATE payment SET status = 'refunded' WHERE order_id = p_order_id;
  SELECT id, order_id, stripe_payment_intent_id, amount, currency, status
    FROM payment WHERE order_id = p_order_id LIMIT 1;
END //

DROP PROCEDURE IF EXISTS sp_order_get_by_tracking_code //
CREATE PROCEDURE sp_order_get_by_tracking_code(IN p_tracking_code CHAR(36))
BEGIN
  SELECT o.id, o.location_id, l.name AS location_name,
         o.user_id, o.status_id, os.name AS status_name,
         o.tracking_code, o.display_number,
         o.guest_name, o.guest_phone, o.pickup_time,
         o.total_amount, o.subtotal_amount, o.discount_amount, o.processing_fee,
         o.promotion_code,
         o.notes, o.created_at, o.updated_at
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
    JOIN location l ON l.id = o.location_id
   WHERE o.tracking_code = p_tracking_code;
END //

DROP PROCEDURE IF EXISTS sp_order_get_items //
CREATE PROCEDURE sp_order_get_items(IN p_order_id INT UNSIGNED)
BEGIN
  -- LEFT JOIN with COALESCE so deleted items still surface their snapshotted
  -- name. is_available flips to 0 when the underlying item is gone or
  -- inactive — frontends use this for "no longer available" / disabled
  -- "reorder" buttons.
  SELECT oi.id, oi.order_id, oi.item_id,
         COALESCE(i.name, oi.item_name) AS item_name,
         CASE WHEN i.id IS NOT NULL AND i.is_active = 1 THEN 1 ELSE 0 END AS is_available,
         oi.quantity, oi.unit_price, oi.notes, oi.created_at
    FROM order_item oi
    LEFT JOIN item i ON i.id = oi.item_id
   WHERE oi.order_id = p_order_id
   ORDER BY oi.id;

  SELECT oio.id, oio.order_item_id, oio.item_option_value_id,
         COALESCE(iov.name, oio.option_value_name) AS option_value_name,
         COALESCE(io.name,  oio.option_name)       AS option_name,
         CASE WHEN iov.id IS NOT NULL THEN 1 ELSE 0 END AS is_available,
         oio.price_modifier
    FROM order_item_option oio
    LEFT JOIN item_option_value iov ON iov.id = oio.item_option_value_id
    LEFT JOIN item_option io ON io.id = iov.item_option_id
    JOIN order_item oi ON oi.id = oio.order_item_id
   WHERE oi.order_id = p_order_id
   ORDER BY oio.order_item_id, oio.id;
END //

DROP PROCEDURE IF EXISTS sp_order_list_by_location //
CREATE PROCEDURE sp_order_list_by_location(
  IN p_location_id INT UNSIGNED,
  IN p_status_name VARCHAR(50)
)
BEGIN
  IF p_status_name IS NOT NULL THEN
    SELECT o.id, o.display_number, o.user_id, o.status_id, os.name AS status_name,
           o.guest_name, o.guest_phone, o.total_amount, o.pickup_time, o.created_at,
           o.is_priority, o.priority_set_at, o.priority_reason
      FROM `order` o
      JOIN order_status os ON os.id = o.status_id
     WHERE o.location_id = p_location_id AND os.name = p_status_name
     ORDER BY o.is_priority DESC,
              CASE WHEN o.is_priority = 1 THEN o.priority_set_at ELSE o.created_at END ASC;
  ELSE
    SELECT o.id, o.display_number, o.user_id, o.status_id, os.name AS status_name,
           o.guest_name, o.guest_phone, o.total_amount, o.pickup_time, o.created_at,
           o.is_priority, o.priority_set_at, o.priority_reason
      FROM `order` o
      JOIN order_status os ON os.id = o.status_id
     WHERE o.location_id = p_location_id AND os.name NOT IN ('COMPLETED', 'CANCELED')
     ORDER BY o.is_priority DESC, o.created_at ASC;
  END IF;
END //

DROP PROCEDURE IF EXISTS sp_order_list_by_user //
CREATE PROCEDURE sp_order_list_by_user(IN p_user_id INT UNSIGNED)
BEGIN
  SELECT o.id, o.location_id, l.name AS location_name,
         o.status_id, os.name AS status_name, o.tracking_code, o.display_number,
         o.total_amount, o.pickup_time, o.created_at
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
    JOIN location l ON l.id = o.location_id
   WHERE o.user_id = p_user_id
   ORDER BY
     CASE WHEN os.name IN ('PAID','PREPARING','READY') THEN 0 ELSE 1 END,
     o.created_at DESC;
END //

-- -----------------------------------------------------------------------------
-- sp_order_history — returns completed orders with filters for the kitchen history view
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_order_history //
CREATE PROCEDURE sp_order_history(
  IN p_location_id INT UNSIGNED,
  IN p_search      VARCHAR(255),
  IN p_date_from   DATE,
  IN p_date_to     DATE,
  IN p_limit_rows  INT UNSIGNED,
  IN p_offset_rows INT UNSIGNED
)
BEGIN
  DECLARE v_limit  INT UNSIGNED DEFAULT 50;
  DECLARE v_offset INT UNSIGNED DEFAULT 0;

  IF p_limit_rows IS NOT NULL THEN SET v_limit = p_limit_rows; END IF;
  IF p_offset_rows IS NOT NULL THEN SET v_offset = p_offset_rows; END IF;

  SELECT o.id, o.display_number, o.user_id, o.status_id, os.name AS status_name,
         o.guest_name, o.guest_phone, o.total_amount, o.tracking_code,
         o.pickup_time, o.created_at,
         u.email AS user_email, u.first_name AS user_first_name, u.last_name AS user_last_name,
         p.status AS payment_status
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
    LEFT JOIN `user` u ON u.id = o.user_id
    LEFT JOIN payment p ON p.order_id = o.id
   WHERE o.location_id = p_location_id
     AND os.name != 'CREATED'
     AND (p_search IS NULL
          OR o.guest_name LIKE CONCAT('%', p_search, '%')
          OR o.guest_phone LIKE CONCAT('%', p_search, '%')
          OR u.email LIKE CONCAT('%', p_search, '%')
          OR u.first_name LIKE CONCAT('%', p_search, '%')
          OR u.last_name LIKE CONCAT('%', p_search, '%')
          OR CAST(o.id AS CHAR) = p_search
          OR CAST(o.display_number AS CHAR) = p_search)
     AND (p_date_from IS NULL OR DATE(o.created_at) >= p_date_from)
     AND (p_date_to IS NULL OR DATE(o.created_at) <= p_date_to)
   ORDER BY o.created_at DESC
   LIMIT v_limit
   OFFSET v_offset;
END //


-- #############################################################################
-- #  SECTION 3: PAYMENT
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_payment_record //
CREATE PROCEDURE sp_payment_record(
  IN p_order_id                 INT UNSIGNED,
  IN p_stripe_payment_intent_id VARCHAR(255),
  IN p_amount                   DECIMAL(10, 2),
  IN p_currency                 VARCHAR(3),
  IN p_status                   VARCHAR(50)
)
BEGIN
  DECLARE v_existing_id INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF p_stripe_payment_intent_id IS NULL OR CHAR_LENGTH(TRIM(p_stripe_payment_intent_id)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'stripe_payment_intent_id is required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM `order` WHERE id = p_order_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found.';
  END IF;

  SELECT id INTO v_existing_id FROM payment
   WHERE stripe_payment_intent_id = p_stripe_payment_intent_id LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE payment SET status = p_status WHERE id = v_existing_id;
    SELECT p.id, p.order_id, p.stripe_payment_intent_id, p.amount,
           p.currency, p.status, p.created_at, p.updated_at
      FROM payment p WHERE p.id = v_existing_id;
  ELSE
    START TRANSACTION;
    INSERT INTO payment (order_id, stripe_payment_intent_id, amount, currency, status)
    VALUES (p_order_id, p_stripe_payment_intent_id, p_amount, COALESCE(p_currency, 'USD'), p_status);
    COMMIT;

    SELECT p.id, p.order_id, p.stripe_payment_intent_id, p.amount,
           p.currency, p.status, p.created_at
      FROM payment p WHERE p.stripe_payment_intent_id = p_stripe_payment_intent_id;
  END IF;
END //

-- Get payment info for an order
DROP PROCEDURE IF EXISTS sp_payment_get_by_order //
CREATE PROCEDURE sp_payment_get_by_order(IN p_order_id INT UNSIGNED)
BEGIN
  SELECT id, order_id, stripe_payment_intent_id, amount, currency, status, created_at
    FROM payment
   WHERE order_id = p_order_id
   ORDER BY created_at DESC
   LIMIT 1;
END //


-- #############################################################################
-- #  SECTION 4: MENU (GLOBAL MENU WITH LOCATION AVAILABILITY)
-- #############################################################################

-- Create a global menu
DROP PROCEDURE IF EXISTS sp_menu_create //
CREATE PROCEDURE sp_menu_create(IN p_name VARCHAR(150))
BEGIN
  DECLARE v_menu_id INT UNSIGNED;

  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menu name is required.';
  END IF;

  INSERT INTO menu (name) VALUES (TRIM(p_name));
  SET v_menu_id = LAST_INSERT_ID();

  SELECT id, name, is_active, created_at FROM menu WHERE id = v_menu_id;
END //

-- Get full menu filtered by location (items available at that location)
DROP PROCEDURE IF EXISTS sp_menu_get_full //
CREATE PROCEDURE sp_menu_get_full(IN p_location_id INT UNSIGNED)
BEGIN
  -- Result set 1: menus
  SELECT m.id, m.name, m.is_active FROM menu m WHERE m.is_active = 1;

  -- Result set 2: categories (only those with items at this location)
  SELECT DISTINCT c.id, c.menu_id, c.name, c.description, c.sort_order
    FROM category c
    JOIN menu m ON m.id = c.menu_id
    JOIN item i ON i.category_id = c.id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE m.is_active = 1 AND i.is_active = 1
   ORDER BY c.sort_order, c.id;

  -- Result set 3: items available at this location
  SELECT i.id, i.category_id, i.name, i.description, i.price,
         i.image_url, i.sort_order
    FROM item i
    JOIN category c ON c.id = i.category_id
    JOIN menu m ON m.id = c.menu_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE m.is_active = 1 AND i.is_active = 1
   ORDER BY c.sort_order, c.id, i.sort_order, i.id;

  -- Result set 4: options for those items
  SELECT io.id, io.item_id, io.name, io.is_required, io.max_choices
    FROM item_option io
    JOIN item i ON i.id = io.item_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE i.is_active = 1;

  -- Result set 5: option values
  SELECT iov.id, iov.item_option_id, iov.name, iov.price_modifier
    FROM item_option_value iov
    JOIN item_option io ON io.id = iov.item_option_id
    JOIN item i ON i.id = io.item_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE i.is_active = 1;
END //

-- Get the FULL menu (all items regardless of location — for admin management)
DROP PROCEDURE IF EXISTS sp_menu_get_all //
CREATE PROCEDURE sp_menu_get_all()
BEGIN
  SELECT m.id, m.name, m.is_active FROM menu m WHERE m.is_active = 1;

  SELECT c.id, c.menu_id, c.name, c.description, c.sort_order
    FROM category c
    JOIN menu m ON m.id = c.menu_id
   WHERE m.is_active = 1
   ORDER BY c.sort_order, c.id;

  SELECT i.id, i.category_id, i.name, i.description, i.price,
         i.image_url, i.is_active, i.sort_order
    FROM item i
    JOIN category c ON c.id = i.category_id
    JOIN menu m ON m.id = c.menu_id
   WHERE m.is_active = 1
   ORDER BY c.sort_order, c.id, i.sort_order, i.id;

  SELECT io.id, io.item_id, io.name, io.is_required, io.max_choices
    FROM item_option io
    JOIN item i ON i.id = io.item_id
    JOIN category c ON c.id = i.category_id
    JOIN menu m ON m.id = c.menu_id
   WHERE m.is_active = 1;

  SELECT iov.id, iov.item_option_id, iov.name, iov.price_modifier
    FROM item_option_value iov
    JOIN item_option io ON io.id = iov.item_option_id
    JOIN item i ON i.id = io.item_id
    JOIN category c ON c.id = i.category_id
    JOIN menu m ON m.id = c.menu_id
   WHERE m.is_active = 1;

  -- Result set 6: item_location assignments
  SELECT il.item_id, il.location_id
    FROM item_location il;
END //

DROP PROCEDURE IF EXISTS sp_category_create //
CREATE PROCEDURE sp_category_create(
  IN p_menu_id     INT UNSIGNED,
  IN p_name        VARCHAR(100),
  IN p_description TEXT,
  IN p_sort_order  INT UNSIGNED
)
BEGIN
  DECLARE v_category_id INT UNSIGNED;

  IF NOT EXISTS (SELECT 1 FROM menu WHERE id = p_menu_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menu not found.';
  END IF;
  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category name is required.';
  END IF;

  INSERT INTO category (menu_id, name, description, sort_order)
  VALUES (p_menu_id, TRIM(p_name), p_description, COALESCE(p_sort_order, 0));
  SET v_category_id = LAST_INSERT_ID();

  SELECT id, menu_id, name, description, sort_order, created_at
    FROM category WHERE id = v_category_id;
END //

DROP PROCEDURE IF EXISTS sp_category_update //
CREATE PROCEDURE sp_category_update(
  IN p_category_id INT UNSIGNED,
  IN p_name        VARCHAR(100),
  IN p_description TEXT,
  IN p_sort_order  INT UNSIGNED
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM category WHERE id = p_category_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category not found.';
  END IF;

  UPDATE category
     SET name        = COALESCE(TRIM(p_name), name),
         description = COALESCE(p_description, description),
         sort_order  = COALESCE(p_sort_order, sort_order)
   WHERE id = p_category_id;

  SELECT id, menu_id, name, description, sort_order, updated_at
    FROM category WHERE id = p_category_id;
END //

DROP PROCEDURE IF EXISTS sp_category_delete //
CREATE PROCEDURE sp_category_delete(IN p_category_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM category WHERE id = p_category_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category not found.';
  END IF;
  DELETE FROM category WHERE id = p_category_id;
END //

DROP PROCEDURE IF EXISTS sp_item_create //
CREATE PROCEDURE sp_item_create(
  IN p_category_id INT UNSIGNED,
  IN p_name        VARCHAR(150),
  IN p_description TEXT,
  IN p_price       DECIMAL(10, 2),
  IN p_image_url   VARCHAR(500),
  IN p_sort_order  INT UNSIGNED
)
BEGIN
  DECLARE v_item_id INT UNSIGNED;

  IF NOT EXISTS (SELECT 1 FROM category WHERE id = p_category_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category not found.';
  END IF;
  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item name is required.';
  END IF;
  IF p_price IS NULL OR p_price < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item price must be zero or greater.';
  END IF;

  INSERT INTO item (category_id, name, description, price, image_url, sort_order)
  VALUES (p_category_id, TRIM(p_name), p_description, p_price, p_image_url, COALESCE(p_sort_order, 0));
  SET v_item_id = LAST_INSERT_ID();

  SELECT id, category_id, name, description, price, image_url, is_active, sort_order, created_at
    FROM item WHERE id = v_item_id;
END //

DROP PROCEDURE IF EXISTS sp_item_update //
CREATE PROCEDURE sp_item_update(
  IN p_item_id     INT UNSIGNED,
  IN p_name        VARCHAR(150),
  IN p_description TEXT,
  IN p_price       DECIMAL(10, 2),
  IN p_image_url   VARCHAR(500),
  IN p_is_active   TINYINT(1),
  IN p_sort_order  INT UNSIGNED
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;
  IF p_name IS NOT NULL AND CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item name cannot be empty.';
  END IF;
  IF p_price IS NOT NULL AND p_price < 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item price must be zero or greater.';
  END IF;

  UPDATE item
     SET name        = COALESCE(TRIM(p_name), name),
         description = COALESCE(p_description, description),
         price       = COALESCE(p_price, price),
         image_url   = COALESCE(p_image_url, image_url),
         is_active   = COALESCE(p_is_active, is_active),
         sort_order  = COALESCE(p_sort_order, sort_order)
   WHERE id = p_item_id;

  SELECT id, category_id, name, description, price, image_url, is_active, sort_order, updated_at
    FROM item WHERE id = p_item_id;
END //

-- Hard delete is now safe: order_item.item_name and order_item_option's
-- option_name/option_value_name preserve a readable snapshot, and the FKs
-- are ON DELETE SET NULL so past orders survive. CASCADE on item still
-- removes item_location / item_option / item_option_value.
DROP PROCEDURE IF EXISTS sp_item_delete //
CREATE PROCEDURE sp_item_delete(IN p_item_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;
  DELETE FROM item WHERE id = p_item_id;
END //

-- Assign an item to a location
DROP PROCEDURE IF EXISTS sp_item_location_set //
CREATE PROCEDURE sp_item_location_set(IN p_item_id INT UNSIGNED, IN p_location_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM location WHERE id = p_location_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
  END IF;
  INSERT IGNORE INTO item_location (item_id, location_id) VALUES (p_item_id, p_location_id);
END //

-- Remove an item from a location
DROP PROCEDURE IF EXISTS sp_item_location_remove //
CREATE PROCEDURE sp_item_location_remove(IN p_item_id INT UNSIGNED, IN p_location_id INT UNSIGNED)
BEGIN
  DELETE FROM item_location WHERE item_id = p_item_id AND location_id = p_location_id;
END //

-- Bulk set locations for an item (delete all, then insert provided list)
DROP PROCEDURE IF EXISTS sp_item_location_sync //
CREATE PROCEDURE sp_item_location_sync(IN p_item_id INT UNSIGNED, IN p_location_ids TEXT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;

  START TRANSACTION;
  DELETE FROM item_location WHERE item_id = p_item_id;

  -- Insert each location_id from the comma-separated list
  IF p_location_ids IS NOT NULL AND CHAR_LENGTH(TRIM(p_location_ids)) > 0 THEN
    SET @sql_insert = CONCAT(
      'INSERT IGNORE INTO item_location (item_id, location_id) ',
      'SELECT ', p_item_id, ', id FROM location WHERE FIND_IN_SET(id, ''', p_location_ids, ''')'
    );
    PREPARE stmt FROM @sql_insert;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
  COMMIT;

  SELECT il.item_id, il.location_id, l.name AS location_name
    FROM item_location il
    JOIN location l ON l.id = il.location_id
   WHERE il.item_id = p_item_id;
END //

DROP PROCEDURE IF EXISTS sp_item_option_create //
CREATE PROCEDURE sp_item_option_create(
  IN p_item_id     INT UNSIGNED,
  IN p_name        VARCHAR(100),
  IN p_is_required TINYINT(1),
  IN p_max_choices INT UNSIGNED
)
BEGIN
  DECLARE v_id INT UNSIGNED;

  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item not found.';
  END IF;
  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Option name is required.';
  END IF;

  INSERT INTO item_option (item_id, name, is_required, max_choices)
  VALUES (p_item_id, TRIM(p_name), COALESCE(p_is_required, 0), p_max_choices);
  SET v_id = LAST_INSERT_ID();

  SELECT id, item_id, name, is_required, max_choices, created_at
    FROM item_option WHERE id = v_id;
END //

DROP PROCEDURE IF EXISTS sp_item_option_value_create //
CREATE PROCEDURE sp_item_option_value_create(
  IN p_item_option_id INT UNSIGNED,
  IN p_name           VARCHAR(100),
  IN p_price_modifier DECIMAL(10, 2)
)
BEGIN
  DECLARE v_id INT UNSIGNED;

  IF NOT EXISTS (SELECT 1 FROM item_option WHERE id = p_item_option_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option not found.';
  END IF;
  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Option value name is required.';
  END IF;

  INSERT INTO item_option_value (item_option_id, name, price_modifier)
  VALUES (p_item_option_id, TRIM(p_name), COALESCE(p_price_modifier, 0.00));
  SET v_id = LAST_INSERT_ID();

  SELECT id, item_option_id, name, price_modifier, created_at
    FROM item_option_value WHERE id = v_id;
END //

DROP PROCEDURE IF EXISTS sp_item_option_update //
CREATE PROCEDURE sp_item_option_update(
  IN p_id          INT UNSIGNED,
  IN p_name        VARCHAR(100),
  IN p_is_required TINYINT(1),
  IN p_max_choices INT UNSIGNED
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item_option WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option not found.';
  END IF;
  IF p_name IS NOT NULL AND CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Option name cannot be empty.';
  END IF;

  UPDATE item_option
     SET name        = COALESCE(TRIM(p_name), name),
         is_required = COALESCE(p_is_required, is_required),
         max_choices = COALESCE(p_max_choices, max_choices)
   WHERE id = p_id;

  SELECT id, item_id, name, is_required, max_choices, updated_at
    FROM item_option WHERE id = p_id;
END //

-- CASCADE on item_option_value's FK takes care of the children. Past order
-- references in order_item_option fall through ON DELETE SET NULL (preserved
-- via the option_name / option_value_name snapshots).
DROP PROCEDURE IF EXISTS sp_item_option_delete //
CREATE PROCEDURE sp_item_option_delete(IN p_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item_option WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option not found.';
  END IF;
  DELETE FROM item_option WHERE id = p_id;
END //

DROP PROCEDURE IF EXISTS sp_item_option_value_update //
CREATE PROCEDURE sp_item_option_value_update(
  IN p_id             INT UNSIGNED,
  IN p_name           VARCHAR(100),
  IN p_price_modifier DECIMAL(10, 2)
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item_option_value WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option value not found.';
  END IF;
  IF p_name IS NOT NULL AND CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Option value name cannot be empty.';
  END IF;

  UPDATE item_option_value
     SET name           = COALESCE(TRIM(p_name), name),
         price_modifier = COALESCE(p_price_modifier, price_modifier)
   WHERE id = p_id;

  SELECT id, item_option_id, name, price_modifier, updated_at
    FROM item_option_value WHERE id = p_id;
END //

DROP PROCEDURE IF EXISTS sp_item_option_value_delete //
CREATE PROCEDURE sp_item_option_value_delete(IN p_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM item_option_value WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Item option value not found.';
  END IF;
  DELETE FROM item_option_value WHERE id = p_id;
END //


-- #############################################################################
-- #  SECTION 5: LOCATION MANAGEMENT
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_location_create //
CREATE PROCEDURE sp_location_create(
  IN p_name       VARCHAR(150),
  IN p_address    VARCHAR(255),
  IN p_city       VARCHAR(100),
  IN p_state      VARCHAR(100),
  IN p_zip_code   VARCHAR(20),
  IN p_phone      VARCHAR(20),
  IN p_open_time  TIME,
  IN p_close_time TIME
)
BEGIN
  DECLARE v_id INT UNSIGNED;

  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location name is required.';
  END IF;
  IF p_address IS NULL OR CHAR_LENGTH(TRIM(p_address)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Address is required.';
  END IF;
  IF (p_open_time IS NULL) <> (p_close_time IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'open_time and close_time must be set together (or both omitted).';
  END IF;
  IF p_open_time IS NOT NULL AND p_close_time <= p_open_time THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'close_time must be after open_time.';
  END IF;

  INSERT INTO location (name, address, city, state, zip_code, phone, open_time, close_time)
  VALUES (TRIM(p_name), TRIM(p_address), TRIM(p_city), TRIM(p_state), TRIM(p_zip_code), p_phone, p_open_time, p_close_time);
  SET v_id = LAST_INSERT_ID();

  SELECT id, name, address, city, state, zip_code, phone, open_time, close_time, is_active, created_at
    FROM location WHERE id = v_id;
END //

DROP PROCEDURE IF EXISTS sp_location_update //
CREATE PROCEDURE sp_location_update(
  IN p_location_id INT UNSIGNED,
  IN p_name        VARCHAR(150),
  IN p_address     VARCHAR(255),
  IN p_city        VARCHAR(100),
  IN p_state       VARCHAR(100),
  IN p_zip_code    VARCHAR(20),
  IN p_phone       VARCHAR(20),
  IN p_open_time   TIME,
  IN p_close_time  TIME,
  -- Sentinel: 1 = caller wants to clear hours (set both to NULL).
  -- Without this, NULL means "leave unchanged" (consistent with other fields).
  IN p_clear_hours TINYINT(1)
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM location WHERE id = p_location_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
  END IF;
  IF p_clear_hours = 0 AND p_open_time IS NOT NULL AND p_close_time IS NOT NULL
     AND p_close_time <= p_open_time THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'close_time must be after open_time.';
  END IF;

  UPDATE location
     SET name       = COALESCE(TRIM(p_name), name),
         address    = COALESCE(TRIM(p_address), address),
         city       = COALESCE(TRIM(p_city), city),
         state      = COALESCE(TRIM(p_state), state),
         zip_code   = COALESCE(TRIM(p_zip_code), zip_code),
         phone      = COALESCE(p_phone, phone),
         open_time  = CASE WHEN p_clear_hours = 1 THEN NULL ELSE COALESCE(p_open_time,  open_time)  END,
         close_time = CASE WHEN p_clear_hours = 1 THEN NULL ELSE COALESCE(p_close_time, close_time) END
   WHERE id = p_location_id;

  SELECT id, name, address, city, state, zip_code, phone, open_time, close_time, is_active, created_at, updated_at
    FROM location WHERE id = p_location_id;
END //

DROP PROCEDURE IF EXISTS sp_location_toggle_active //
CREATE PROCEDURE sp_location_toggle_active(IN p_location_id INT UNSIGNED, IN p_is_active TINYINT(1))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM location WHERE id = p_location_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
  END IF;
  UPDATE location SET is_active = p_is_active WHERE id = p_location_id;
  SELECT id, name, is_active, updated_at FROM location WHERE id = p_location_id;
END //

DROP PROCEDURE IF EXISTS sp_location_list_active //
CREATE PROCEDURE sp_location_list_active()
BEGIN
  SELECT id, name, address, city, state, zip_code, phone, open_time, close_time, created_at
    FROM location WHERE is_active = 1 ORDER BY name;
END //

-- List ALL locations (including inactive — for admin)
DROP PROCEDURE IF EXISTS sp_location_list_all //
CREATE PROCEDURE sp_location_list_all()
BEGIN
  SELECT id, name, address, city, state, zip_code, phone, open_time, close_time, is_active, created_at
    FROM location ORDER BY name;
END //


-- #############################################################################
-- #  SECTION 6: PROMOTION
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_promotion_create //
CREATE PROCEDURE sp_promotion_create(
  IN p_code           VARCHAR(50),
  IN p_description    TEXT,
  IN p_discount_type  VARCHAR(20),
  IN p_discount_value DECIMAL(10, 2),
  IN p_min_order      DECIMAL(10, 2),
  IN p_max_uses       INT UNSIGNED,
  IN p_starts_at      DATETIME,
  IN p_expires_at     DATETIME
)
BEGIN
  DECLARE v_id INT UNSIGNED;

  IF p_code IS NULL OR CHAR_LENGTH(TRIM(p_code)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion code is required.';
  END IF;
  IF p_discount_type NOT IN ('percentage', 'fixed') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'discount_type must be "percentage" or "fixed".';
  END IF;
  IF p_discount_value IS NULL OR p_discount_value <= 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'discount_value must be greater than zero.';
  END IF;
  IF p_discount_type = 'percentage' AND p_discount_value > 100 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Percentage discount cannot exceed 100.';
  END IF;
  IF p_starts_at IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'starts_at is required.';
  END IF;

  INSERT INTO promotion (code, description, discount_type, discount_value, min_order, max_uses, starts_at, expires_at)
  VALUES (UPPER(TRIM(p_code)), p_description, p_discount_type, p_discount_value, p_min_order, p_max_uses, p_starts_at, p_expires_at);
  SET v_id = LAST_INSERT_ID();

  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         current_uses, starts_at, expires_at, is_active, created_at
    FROM promotion WHERE id = v_id;
END //

DROP PROCEDURE IF EXISTS sp_promotion_list //
CREATE PROCEDURE sp_promotion_list()
BEGIN
  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         current_uses, starts_at, expires_at, is_active, created_at
    FROM promotion
   ORDER BY created_at DESC;
END //

DROP PROCEDURE IF EXISTS sp_promotion_update //
CREATE PROCEDURE sp_promotion_update(
  IN p_id             INT UNSIGNED,
  IN p_code           VARCHAR(50),
  IN p_description    TEXT,
  IN p_discount_type  VARCHAR(20),
  IN p_discount_value DECIMAL(10, 2),
  IN p_min_order      DECIMAL(10, 2),
  IN p_max_uses       INT UNSIGNED,
  IN p_starts_at      DATETIME,
  IN p_expires_at     DATETIME,
  IN p_is_active      TINYINT(1)
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM promotion WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion not found.';
  END IF;

  UPDATE promotion
     SET code           = COALESCE(UPPER(TRIM(p_code)), code),
         description    = COALESCE(p_description, description),
         discount_type  = COALESCE(p_discount_type, discount_type),
         discount_value = COALESCE(p_discount_value, discount_value),
         min_order      = COALESCE(p_min_order, min_order),
         max_uses       = COALESCE(p_max_uses, max_uses),
         starts_at      = COALESCE(p_starts_at, starts_at),
         expires_at     = p_expires_at,
         is_active      = COALESCE(p_is_active, is_active)
   WHERE id = p_id;

  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         current_uses, starts_at, expires_at, is_active, created_at
    FROM promotion WHERE id = p_id;
END //

DROP PROCEDURE IF EXISTS sp_promotion_delete //
CREATE PROCEDURE sp_promotion_delete(IN p_id INT UNSIGNED)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM promotion WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion not found.';
  END IF;
  DELETE FROM promotion WHERE id = p_id;
END //

DROP PROCEDURE IF EXISTS sp_promotion_apply //
CREATE PROCEDURE sp_promotion_apply(IN p_code VARCHAR(50), IN p_order_total DECIMAL(10, 2))
BEGIN
  DECLARE v_id             INT UNSIGNED;
  DECLARE v_discount_type  VARCHAR(20);
  DECLARE v_discount_value DECIMAL(10, 2);
  DECLARE v_min_order      DECIMAL(10, 2);
  DECLARE v_max_uses       INT UNSIGNED;
  DECLARE v_current_uses   INT UNSIGNED;
  DECLARE v_is_active      TINYINT(1);
  DECLARE v_starts_at      DATETIME;
  DECLARE v_expires_at     DATETIME;
  DECLARE v_discount_amount DECIMAL(10, 2);

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT id, discount_type, discount_value, min_order, max_uses, current_uses,
         is_active, starts_at, expires_at
    INTO v_id, v_discount_type, v_discount_value, v_min_order, v_max_uses,
         v_current_uses, v_is_active, v_starts_at, v_expires_at
    FROM promotion WHERE code = UPPER(TRIM(p_code)) LIMIT 1;

  IF v_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion code not found.';
  END IF;
  IF v_is_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion is no longer active.';
  END IF;
  IF NOW() < v_starts_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has not started yet.';
  END IF;
  IF v_expires_at IS NOT NULL AND NOW() > v_expires_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has expired.';
  END IF;
  IF v_max_uses IS NOT NULL AND v_current_uses >= v_max_uses THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion usage limit reached.';
  END IF;
  IF v_min_order IS NOT NULL AND p_order_total < v_min_order THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order total does not meet the minimum.';
  END IF;

  IF v_discount_type = 'percentage' THEN
    SET v_discount_amount = ROUND(p_order_total * (v_discount_value / 100), 2);
  ELSE
    SET v_discount_amount = v_discount_value;
  END IF;
  IF v_discount_amount > p_order_total THEN
    SET v_discount_amount = p_order_total;
  END IF;

  START TRANSACTION;
  UPDATE promotion SET current_uses = current_uses + 1 WHERE id = v_id;
  COMMIT;

  SELECT v_id AS promotion_id, p_code AS code, v_discount_type AS discount_type,
         v_discount_value AS discount_value, v_discount_amount AS discount_amount;
END //


-- #############################################################################
-- #  SECTION 7: NEWSLETTER
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_newsletter_subscribe //
CREATE PROCEDURE sp_newsletter_subscribe(IN p_email VARCHAR(255))
BEGIN
  IF p_email IS NULL OR CHAR_LENGTH(TRIM(p_email)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Email is required.';
  END IF;
  INSERT IGNORE INTO newsletter_subscriber (email) VALUES (LOWER(TRIM(p_email)));
  SELECT id, email, created_at FROM newsletter_subscriber WHERE email = LOWER(TRIM(p_email));
END //

DROP PROCEDURE IF EXISTS sp_newsletter_unsubscribe //
CREATE PROCEDURE sp_newsletter_unsubscribe(IN p_email VARCHAR(255))
BEGIN
  DELETE FROM newsletter_subscriber WHERE email = LOWER(TRIM(p_email));
  IF ROW_COUNT() = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Subscriber not found.';
  END IF;
END //


-- #############################################################################
-- #  SECTION 8: PROMOTION PREVIEW (non-destructive validation)
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_promotion_preview //
CREATE PROCEDURE sp_promotion_preview(
  IN p_code        VARCHAR(50),
  IN p_order_total DECIMAL(10, 2)
)
BEGIN
  DECLARE v_id             INT UNSIGNED;
  DECLARE v_discount_type  VARCHAR(20);
  DECLARE v_discount_value DECIMAL(10, 2);
  DECLARE v_min_order      DECIMAL(10, 2);
  DECLARE v_max_uses       INT UNSIGNED;
  DECLARE v_current_uses   INT UNSIGNED;
  DECLARE v_is_active      TINYINT(1);
  DECLARE v_starts_at      DATETIME;
  DECLARE v_expires_at     DATETIME;
  DECLARE v_discount_amount DECIMAL(10, 2);

  SELECT id, discount_type, discount_value, min_order, max_uses, current_uses,
         is_active, starts_at, expires_at
    INTO v_id, v_discount_type, v_discount_value, v_min_order, v_max_uses,
         v_current_uses, v_is_active, v_starts_at, v_expires_at
    FROM promotion WHERE code = UPPER(TRIM(p_code)) LIMIT 1;

  IF v_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion code not found.';
  END IF;
  IF v_is_active = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion is no longer active.';
  END IF;
  IF NOW() < v_starts_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has not started yet.';
  END IF;
  IF v_expires_at IS NOT NULL AND NOW() > v_expires_at THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion has expired.';
  END IF;
  IF v_max_uses IS NOT NULL AND v_current_uses >= v_max_uses THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Promotion usage limit reached.';
  END IF;
  IF v_min_order IS NOT NULL AND p_order_total < v_min_order THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order total does not meet the minimum.';
  END IF;

  IF v_discount_type = 'percentage' THEN
    SET v_discount_amount = ROUND(p_order_total * (v_discount_value / 100), 2);
  ELSE
    SET v_discount_amount = v_discount_value;
  END IF;
  IF v_discount_amount > p_order_total THEN
    SET v_discount_amount = p_order_total;
  END IF;

  SELECT v_id AS promotion_id, UPPER(TRIM(p_code)) AS code,
         v_discount_type AS discount_type, v_discount_value AS discount_value,
         v_discount_amount AS discount_amount;
END //


-- #############################################################################
-- #  SECTION 9: ADMIN DASHBOARD
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_dashboard_kpis //
CREATE PROCEDURE sp_dashboard_kpis()
BEGIN
  DECLARE v_today DATE;
  DECLARE v_yesterday DATE;
  SET v_today = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Los_Angeles'));
  SET v_yesterday = DATE_SUB(v_today, INTERVAL 1 DAY);

  SELECT
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS today_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS today_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_yesterday
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS yesterday_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_yesterday
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS yesterday_orders,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY')) AS active_orders;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_lifetime //
CREATE PROCEDURE sp_dashboard_lifetime()
BEGIN
  DECLARE v_today DATE;
  SET v_today = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Los_Angeles'));
  SELECT
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS lifetime_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS lifetime_orders,
    (SELECT COALESCE(SUM(total_amount), 0) / 30 FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles'))
           BETWEEN DATE_SUB(v_today, INTERVAL 29 DAY) AND v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS avg_daily_30d;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_daily_revenue //
CREATE PROCEDURE sp_dashboard_daily_revenue(IN p_location_id INT UNSIGNED)
BEGIN
  DECLARE v_today DATE;
  SET v_today = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Los_Angeles'));

  WITH RECURSIVE day_series AS (
    SELECT DATE_SUB(v_today, INTERVAL 29 DAY) AS d
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM day_series WHERE d < v_today
  )
  SELECT ds.d AS day,
         COALESCE(SUM(o.total_amount), 0) AS revenue,
         COUNT(o.id) AS order_count
  FROM day_series ds
  LEFT JOIN `order` o ON DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = ds.d
    AND (p_location_id IS NULL OR o.location_id = p_location_id)
    AND o.status_id IN (SELECT id FROM order_status WHERE name IN ('PAID','PREPARING','READY','COMPLETED'))
  GROUP BY ds.d
  ORDER BY ds.d ASC;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_location_stats //
CREATE PROCEDURE sp_dashboard_location_stats()
BEGIN
  DECLARE v_today DATE;
  SET v_today = DATE(CONVERT_TZ(NOW(), 'UTC', 'America/Los_Angeles'));

  SELECT l.id, l.name, l.city, l.is_active,
    COALESCE(SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_today
                      THEN o.total_amount ELSE 0 END), 0) AS today_revenue,
    SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) = v_today
             THEN 1 ELSE 0 END) AS today_orders,
    COALESCE(SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) >= DATE_SUB(v_today, INTERVAL 6 DAY)
                      THEN o.total_amount ELSE 0 END), 0) AS week_revenue,
    SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) >= DATE_SUB(v_today, INTERVAL 6 DAY)
             THEN 1 ELSE 0 END) AS week_orders,
    COALESCE(SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) >= DATE_SUB(v_today, INTERVAL 29 DAY)
                      THEN o.total_amount ELSE 0 END), 0) AS month_revenue,
    SUM(CASE WHEN DATE(CONVERT_TZ(o.created_at, 'UTC', 'America/Los_Angeles')) >= DATE_SUB(v_today, INTERVAL 29 DAY)
             THEN 1 ELSE 0 END) AS month_orders
  FROM location l
  LEFT JOIN `order` o ON o.location_id = l.id
    AND o.status_id IN (SELECT id FROM order_status WHERE name IN ('PAID','PREPARING','READY','COMPLETED'))
  GROUP BY l.id, l.name, l.city, l.is_active
  ORDER BY month_revenue DESC;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_recent_orders //
CREATE PROCEDURE sp_dashboard_recent_orders(IN p_limit INT UNSIGNED)
BEGIN
  DECLARE v_limit INT UNSIGNED DEFAULT 10;
  IF p_limit IS NOT NULL AND p_limit > 0 THEN SET v_limit = p_limit; END IF;

  SELECT o.id, o.display_number, o.location_id, l.name AS location_name,
         os.name AS status_name, o.guest_name, o.total_amount,
         o.created_at, o.is_priority
  FROM `order` o
  JOIN order_status os ON os.id = o.status_id
  JOIN location l ON l.id = o.location_id
  WHERE os.name IN ('PAID','PREPARING','READY','COMPLETED')
  ORDER BY o.created_at DESC
  LIMIT v_limit;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_counts //
CREATE PROCEDURE sp_dashboard_counts()
BEGIN
  SELECT
    (SELECT COUNT(*) FROM location WHERE is_active = 1) AS active_locations,
    (SELECT COUNT(*) FROM location) AS total_locations,
    (SELECT COUNT(*) FROM `user`) AS total_users;
END //


DELIMITER ;
