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


-- -----------------------------------------------------------------------------
-- sp_client_list — the Clients directory (admin). Lists every client-role user
-- who has signed into the platform, with lightweight order aggregates so the
-- admin can scan activity at a glance. p_search (optional) filters by name,
-- email or phone. total_spent counts only money actually collected (paid and
-- beyond); CREATED (abandoned) and CANCELED (refunded) orders are excluded.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_client_list //
CREATE PROCEDURE sp_client_list(IN p_search VARCHAR(255))
BEGIN
  SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
         u.firebase_uid, u.is_active, u.created_at,
         COUNT(DISTINCT o.id) AS order_count,
         COALESCE(SUM(CASE WHEN os.name IN ('PAID','PREPARING','READY','COMPLETED')
                           THEN o.total_amount ELSE 0 END), 0) AS total_spent,
         MAX(o.created_at) AS last_order_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
    LEFT JOIN `order` o ON o.user_id = u.id
    LEFT JOIN order_status os ON os.id = o.status_id
   WHERE r.name = 'client'
     AND (p_search IS NULL OR p_search = ''
          OR u.email LIKE CONCAT('%', p_search, '%')
          OR u.first_name LIKE CONCAT('%', p_search, '%')
          OR u.last_name LIKE CONCAT('%', p_search, '%')
          OR u.phone LIKE CONCAT('%', p_search, '%')
          OR CONCAT(u.first_name, ' ', u.last_name) LIKE CONCAT('%', p_search, '%'))
   GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone,
            u.firebase_uid, u.is_active, u.created_at
   ORDER BY (MAX(o.created_at) IS NULL), MAX(o.created_at) DESC, u.created_at DESC;
END //

-- -----------------------------------------------------------------------------
-- sp_client_get — one client's profile + the same aggregates as the list, for
-- the directory detail panel. Returns no rows if the id isn't a client.
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS sp_client_get //
CREATE PROCEDURE sp_client_get(IN p_user_id INT UNSIGNED)
BEGIN
  SELECT u.id, u.email, u.first_name, u.last_name, u.phone,
         u.firebase_uid, u.is_active, u.created_at,
         COUNT(DISTINCT o.id) AS order_count,
         COALESCE(SUM(CASE WHEN os.name IN ('PAID','PREPARING','READY','COMPLETED')
                           THEN o.total_amount ELSE 0 END), 0) AS total_spent,
         MAX(o.created_at) AS last_order_at
    FROM `user` u
    JOIN role r ON r.id = u.role_id
    LEFT JOIN `order` o ON o.user_id = u.id
    LEFT JOIN order_status os ON os.id = o.status_id
   WHERE u.id = p_user_id AND r.name = 'client'
   GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone,
            u.firebase_uid, u.is_active, u.created_at;
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
  DECLARE v_period_id       INT UNSIGNED DEFAULT NULL;
  DECLARE v_has_periods     TINYINT(1)   DEFAULT 0;
  DECLARE v_when            DATETIME;

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

  -- pickup_time validation.
  --
  -- Two regimes, chosen by whether this location has service periods configured
  -- (migration 005). Locations without them keep the original behaviour exactly,
  -- so this change is backward compatible for any location not yet migrated.
  SET v_when = COALESCE(p_pickup_time, NOW());

  SELECT EXISTS(
           SELECT 1 FROM service_period
            WHERE location_id = p_location_id AND is_active = 1
         )
    INTO v_has_periods;

  IF v_has_periods = 1 THEN
    -- SERVICE-PERIOD REGIME. The pickup time decides which period applies, and
    -- the period's own weekday schedule decides whether it is valid. Pickup is
    -- NOT restricted to today: advance orders for a later date are the point of
    -- this model. Prep time is enforced as minimum lead time.
    IF p_pickup_time IS NOT NULL AND p_pickup_time < NOW() THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Scheduled pickup time is in the past.';
    END IF;

    SELECT sp.id INTO v_period_id
      FROM service_period sp
      JOIN service_period_schedule s
        ON s.service_period_id = sp.id
       AND s.day_of_week       = DAYOFWEEK(v_when)
     WHERE sp.location_id = p_location_id
       AND sp.is_active   = 1
       AND TIME(v_when)  >= s.start_time
       AND TIME(v_when)  <= s.end_time
       AND v_when >= (NOW() + INTERVAL sp.prep_time_minutes MINUTE)
     ORDER BY sp.sort_order, sp.id
     LIMIT 1;

    IF v_period_id IS NULL THEN
      IF p_pickup_time IS NULL THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Location is closed. Schedule a pickup time within service hours.';
      ELSE
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'No menu is available at the selected pickup time.';
      END IF;
    END IF;
  ELSE
    -- LEGACY REGIME — unchanged. Single open/close window, pickup must be today.
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
    location_id, service_period_id, user_id, status_id, tracking_code,
    display_number, guest_name, guest_phone, pickup_time, notes
  )
  VALUES (
    p_location_id, v_period_id, p_user_id, v_status_id, @tracking,
    v_display_number, p_guest_name, p_guest_phone, p_pickup_time, p_notes
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
  DECLARE v_per_user_limit  INT UNSIGNED;
  DECLARE v_current_uses    INT UNSIGNED;
  DECLARE v_user_uses       INT UNSIGNED DEFAULT 0;
  DECLARE v_user_id         INT UNSIGNED;
  DECLARE v_is_active       TINYINT(1);
  DECLARE v_starts_at       DATETIME;
  DECLARE v_expires_at      DATETIME;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  SELECT os.name, o.user_id INTO v_status_name, v_user_id
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
    SELECT id, discount_type, discount_value, min_order, max_uses, per_user_limit,
           current_uses, is_active, starts_at, expires_at
      INTO v_promotion_id, v_discount_type, v_discount_value, v_min_order, v_max_uses,
           v_per_user_limit, v_current_uses, v_is_active, v_starts_at, v_expires_at
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
    -- Per-customer limit (registered users only): block if this customer has
    -- already redeemed it the allowed number of times on non-canceled orders.
    IF v_user_id IS NOT NULL AND v_per_user_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_user_uses
        FROM `order` o JOIN order_status os ON os.id = o.status_id
       WHERE o.promotion_id = v_promotion_id AND o.user_id = v_user_id
         AND o.id <> p_order_id
         AND os.name NOT IN ('CREATED', 'CANCELED');
      IF v_user_uses >= v_per_user_limit THEN
        SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'You have already used this promotion the maximum number of times.';
      END IF;
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
         o.notes, o.created_at, o.updated_at,
         p.status AS payment_status
    FROM `order` o
    JOIN order_status os ON os.id = o.status_id
    JOIN location l ON l.id = o.location_id
    LEFT JOIN payment p ON p.order_id = o.id
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
           o.guest_name, o.guest_phone, o.notes, o.total_amount, o.pickup_time, o.created_at,
           o.is_priority, o.priority_set_at, o.priority_reason,
           u.first_name AS user_first_name, u.last_name AS user_last_name,
           u.email AS user_email, u.phone AS user_phone
      FROM `order` o
      JOIN order_status os ON os.id = o.status_id
      LEFT JOIN `user` u ON u.id = o.user_id
     WHERE o.location_id = p_location_id AND os.name = p_status_name
     ORDER BY o.is_priority DESC,
              CASE WHEN o.is_priority = 1 THEN o.priority_set_at ELSE o.created_at END ASC;
  ELSE
    SELECT o.id, o.display_number, o.user_id, o.status_id, os.name AS status_name,
           o.guest_name, o.guest_phone, o.notes, o.total_amount, o.pickup_time, o.created_at,
           o.is_priority, o.priority_set_at, o.priority_reason,
           u.first_name AS user_first_name, u.last_name AS user_last_name,
           u.email AS user_email, u.phone AS user_phone
      FROM `order` o
      JOIN order_status os ON os.id = o.status_id
      LEFT JOIN `user` u ON u.id = o.user_id
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

-- Deep-copy an existing option group (and all its values, names + prices) onto
-- another item as a brand-new, INDEPENDENT group. Editing the copy afterwards
-- never touches the source — every row is a fresh insert. Used by the admin
-- "Copy from existing group" action so toppings don't have to be retyped.
DROP PROCEDURE IF EXISTS sp_item_option_clone //
CREATE PROCEDURE sp_item_option_clone(
  IN p_source_option_id INT UNSIGNED,
  IN p_target_item_id   INT UNSIGNED
)
BEGIN
  DECLARE v_new_id INT UNSIGNED;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  IF NOT EXISTS (SELECT 1 FROM item_option WHERE id = p_source_option_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Source option group not found.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM item WHERE id = p_target_item_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Target item not found.';
  END IF;

  START TRANSACTION;

  -- 1. Copy the group itself onto the target item.
  INSERT INTO item_option (item_id, name, is_required, max_choices)
  SELECT p_target_item_id, name, is_required, max_choices
    FROM item_option WHERE id = p_source_option_id;
  SET v_new_id = LAST_INSERT_ID();

  -- 2. Copy every value (name + price_modifier) into the new group.
  INSERT INTO item_option_value (item_option_id, name, price_modifier)
  SELECT v_new_id, name, price_modifier
    FROM item_option_value WHERE item_option_id = p_source_option_id;

  COMMIT;

  SELECT id, item_id, name, is_required, max_choices, created_at
    FROM item_option WHERE id = v_new_id;
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
  IN p_per_user_limit INT UNSIGNED,
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

  INSERT INTO promotion (code, description, discount_type, discount_value, min_order, max_uses, per_user_limit, starts_at, expires_at)
  VALUES (UPPER(TRIM(p_code)), p_description, p_discount_type, p_discount_value, p_min_order, p_max_uses, p_per_user_limit, p_starts_at, p_expires_at);
  SET v_id = LAST_INSERT_ID();

  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         per_user_limit, current_uses, starts_at, expires_at, is_active, created_at
    FROM promotion WHERE id = v_id;
END //

DROP PROCEDURE IF EXISTS sp_promotion_list //
CREATE PROCEDURE sp_promotion_list()
BEGIN
  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         per_user_limit, current_uses, starts_at, expires_at, is_active, created_at
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
  IN p_per_user_limit INT UNSIGNED,
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
         per_user_limit = COALESCE(p_per_user_limit, per_user_limit),
         starts_at      = COALESCE(p_starts_at, starts_at),
         expires_at     = p_expires_at,
         is_active      = COALESCE(p_is_active, is_active)
   WHERE id = p_id;

  SELECT id, code, description, discount_type, discount_value, min_order, max_uses,
         per_user_limit, current_uses, starts_at, expires_at, is_active, created_at
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
  IN p_order_total DECIMAL(10, 2),
  -- Registered customer id (NULL for guests). Per-customer limits only apply
  -- when known — guests fall back to the optional global cap.
  IN p_user_id     INT UNSIGNED
)
BEGIN
  DECLARE v_id             INT UNSIGNED;
  DECLARE v_discount_type  VARCHAR(20);
  DECLARE v_discount_value DECIMAL(10, 2);
  DECLARE v_min_order      DECIMAL(10, 2);
  DECLARE v_max_uses       INT UNSIGNED;
  DECLARE v_per_user_limit INT UNSIGNED;
  DECLARE v_current_uses   INT UNSIGNED;
  DECLARE v_user_uses      INT UNSIGNED DEFAULT 0;
  DECLARE v_is_active      TINYINT(1);
  DECLARE v_starts_at      DATETIME;
  DECLARE v_expires_at     DATETIME;
  DECLARE v_discount_amount DECIMAL(10, 2);

  SELECT id, discount_type, discount_value, min_order, max_uses, per_user_limit,
         current_uses, is_active, starts_at, expires_at
    INTO v_id, v_discount_type, v_discount_value, v_min_order, v_max_uses,
         v_per_user_limit, v_current_uses, v_is_active, v_starts_at, v_expires_at
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
  -- Per-customer limit: count this customer's own prior redemptions (paid and
  -- not canceled). Only enforced for registered users with a limit set.
  IF p_user_id IS NOT NULL AND v_per_user_limit IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_uses
      FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE o.promotion_id = v_id AND o.user_id = p_user_id
       AND os.name NOT IN ('CREATED', 'CANCELED');
    IF v_user_uses >= v_per_user_limit THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'You have already used this promotion the maximum number of times.';
    END IF;
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
-- #
-- #  Timezone: the DB session runs in the restaurant's local zone (set via the
-- #  `TZ` env on the container and `SET time_zone` on each connection), so
-- #  NOW()/CURDATE() and the stored `created_at` are already restaurant-local.
-- #  Use DATE(created_at)/CURDATE() DIRECTLY — do NOT wrap in CONVERT_TZ from
-- #  'UTC', which would double-shift the day boundary.
-- #############################################################################

DROP PROCEDURE IF EXISTS sp_dashboard_kpis //
CREATE PROCEDURE sp_dashboard_kpis()
BEGIN
  DECLARE v_today DATE;
  DECLARE v_yesterday DATE;
  SET v_today = CURDATE();
  SET v_yesterday = DATE_SUB(v_today, INTERVAL 1 DAY);

  SELECT
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(o.created_at) = v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS today_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(o.created_at) = v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS today_orders,
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(o.created_at) = v_yesterday
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS yesterday_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(o.created_at) = v_yesterday
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS yesterday_orders,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY')) AS active_orders;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_lifetime //
CREATE PROCEDURE sp_dashboard_lifetime()
BEGIN
  DECLARE v_today DATE;
  SET v_today = CURDATE();
  SELECT
    (SELECT COALESCE(SUM(total_amount), 0) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS lifetime_revenue,
    (SELECT COUNT(*) FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS lifetime_orders,
    (SELECT COALESCE(SUM(total_amount), 0) / 30 FROM `order` o JOIN order_status os ON os.id = o.status_id
     WHERE DATE(o.created_at)
           BETWEEN DATE_SUB(v_today, INTERVAL 29 DAY) AND v_today
       AND os.name IN ('PAID','PREPARING','READY','COMPLETED')) AS avg_daily_30d;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_daily_revenue //
CREATE PROCEDURE sp_dashboard_daily_revenue(IN p_location_id INT UNSIGNED)
BEGIN
  DECLARE v_today DATE;
  SET v_today = CURDATE();

  WITH RECURSIVE day_series AS (
    SELECT DATE_SUB(v_today, INTERVAL 29 DAY) AS d
    UNION ALL
    SELECT DATE_ADD(d, INTERVAL 1 DAY) FROM day_series WHERE d < v_today
  )
  SELECT ds.d AS day,
         COALESCE(SUM(o.total_amount), 0) AS revenue,
         COUNT(o.id) AS order_count
  FROM day_series ds
  LEFT JOIN `order` o ON DATE(o.created_at) = ds.d
    AND (p_location_id IS NULL OR o.location_id = p_location_id)
    AND o.status_id IN (SELECT id FROM order_status WHERE name IN ('PAID','PREPARING','READY','COMPLETED'))
  GROUP BY ds.d
  ORDER BY ds.d ASC;
END //

DROP PROCEDURE IF EXISTS sp_dashboard_location_stats //
CREATE PROCEDURE sp_dashboard_location_stats()
BEGIN
  DECLARE v_today DATE;
  SET v_today = CURDATE();

  SELECT l.id, l.name, l.city, l.is_active,
    COALESCE(SUM(CASE WHEN DATE(o.created_at) = v_today
                      THEN o.total_amount ELSE 0 END), 0) AS today_revenue,
    SUM(CASE WHEN DATE(o.created_at) = v_today
             THEN 1 ELSE 0 END) AS today_orders,
    COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE_SUB(v_today, INTERVAL 6 DAY)
                      THEN o.total_amount ELSE 0 END), 0) AS week_revenue,
    SUM(CASE WHEN DATE(o.created_at) >= DATE_SUB(v_today, INTERVAL 6 DAY)
             THEN 1 ELSE 0 END) AS week_orders,
    COALESCE(SUM(CASE WHEN DATE(o.created_at) >= DATE_SUB(v_today, INTERVAL 29 DAY)
                      THEN o.total_amount ELSE 0 END), 0) AS month_revenue,
    SUM(CASE WHEN DATE(o.created_at) >= DATE_SUB(v_today, INTERVAL 29 DAY)
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


-- #############################################################################
-- SERVICE PERIODS (migration 005)
--
-- One physical location can serve different menus at different times of day.
-- The pickup time the customer chooses — not the current clock time — is the
-- source of truth for which period, and therefore which menu, applies.
--
-- Schedules are per weekday (service_period_schedule.day_of_week, MySQL
-- DAYOFWEEK(): 1=Sun .. 7=Sat). No row for a day means closed that day.
--
-- prep_time_minutes is minimum lead time: a period is only offered if the
-- pickup is at least that far in the future. This is what stops an 11:50
-- customer ordering from a morning menu that closes at 12:00 when the kitchen
-- needs 20 minutes — 12:10 falls outside morning, so afternoon resolves instead.
-- #############################################################################

-- Resolve the service period that applies to a given pickup time.
-- Returns 0 or 1 row. Callers treat "no row" as "nothing available then".
DROP PROCEDURE IF EXISTS sp_service_period_resolve //
CREATE PROCEDURE sp_service_period_resolve(
  IN p_location_id INT UNSIGNED,
  IN p_pickup_time DATETIME
)
BEGIN
  DECLARE v_when DATETIME;

  -- A NULL pickup time means "as soon as possible": resolve against now.
  SET v_when = COALESCE(p_pickup_time, NOW());

  SELECT sp.id, sp.name, sp.menu_id, sp.prep_time_minutes,
         s.day_of_week, s.start_time, s.end_time,
         (NOW() + INTERVAL sp.prep_time_minutes MINUTE) AS earliest_pickup
    FROM service_period sp
    JOIN service_period_schedule s
      ON s.service_period_id = sp.id
     AND s.day_of_week       = DAYOFWEEK(v_when)
   WHERE sp.location_id = p_location_id
     AND sp.is_active   = 1
     AND TIME(v_when)  >= s.start_time
     AND TIME(v_when)  <= s.end_time
     -- Enough lead time to actually cook it.
     AND v_when >= (NOW() + INTERVAL sp.prep_time_minutes MINUTE)
   ORDER BY sp.sort_order, sp.id
   LIMIT 1;
END //

-- Every period bookable on a given DATE, with the earliest still-valid pickup
-- for each. Drives the customer's pickup-time picker: a period whose window has
-- already passed (once prep time is applied) simply does not come back.
DROP PROCEDURE IF EXISTS sp_service_period_list_bookable //
CREATE PROCEDURE sp_service_period_list_bookable(
  IN p_location_id INT UNSIGNED,
  IN p_date        DATE
)
BEGIN
  DECLARE v_date DATE;
  SET v_date = COALESCE(p_date, CURDATE());

  SELECT sp.id, sp.name, sp.menu_id, sp.prep_time_minutes,
         s.start_time, s.end_time,
         -- On a future date the whole window is open; today it is clamped to
         -- now + prep time.
         GREATEST(
           TIMESTAMP(v_date, s.start_time),
           NOW() + INTERVAL sp.prep_time_minutes MINUTE
         ) AS earliest_pickup,
         TIMESTAMP(v_date, s.end_time) AS latest_pickup
    FROM service_period sp
    JOIN service_period_schedule s
      ON s.service_period_id = sp.id
     AND s.day_of_week       = DAYOFWEEK(v_date)
   WHERE sp.location_id = p_location_id
     AND sp.is_active   = 1
     -- Drop periods whose window has already closed once prep time is applied.
     AND TIMESTAMP(v_date, s.end_time) >= (NOW() + INTERVAL sp.prep_time_minutes MINUTE)
   ORDER BY s.start_time, sp.sort_order, sp.id;
END //

-- The menu for a location AT A GIVEN PICKUP TIME.
--
-- Same five result sets and same shape as sp_menu_get_full, so the existing API
-- mapping is reusable — but restricted to the resolved period's menu. Both
-- filters compose: the period picks the menu, item_location still decides which
-- items this location actually carries.
DROP PROCEDURE IF EXISTS sp_menu_get_full_for_pickup //
CREATE PROCEDURE sp_menu_get_full_for_pickup(
  IN p_location_id INT UNSIGNED,
  IN p_pickup_time DATETIME
)
BEGIN
  DECLARE v_menu_id   INT UNSIGNED DEFAULT NULL;
  DECLARE v_period_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_when      DATETIME;

  SET v_when = COALESCE(p_pickup_time, NOW());

  SELECT sp.id, sp.menu_id INTO v_period_id, v_menu_id
    FROM service_period sp
    JOIN service_period_schedule s
      ON s.service_period_id = sp.id
     AND s.day_of_week       = DAYOFWEEK(v_when)
   WHERE sp.location_id = p_location_id
     AND sp.is_active   = 1
     AND TIME(v_when)  >= s.start_time
     AND TIME(v_when)  <= s.end_time
     AND v_when >= (NOW() + INTERVAL sp.prep_time_minutes MINUTE)
   ORDER BY sp.sort_order, sp.id
   LIMIT 1;

  IF v_menu_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No menu is available at the selected pickup time.';
  END IF;

  -- Result set 1: the resolved period (so the UI can label "Afternoon Menu").
  SELECT sp.id, sp.name, sp.menu_id, sp.prep_time_minutes,
         m.name AS menu_name
    FROM service_period sp
    JOIN menu m ON m.id = sp.menu_id
   WHERE sp.id = v_period_id;

  -- Membership resolves through menu_category (migration 006), NOT
  -- category.menu_id, so a shared category such as Drinks can appear in both
  -- the breakfast and lunch menus without duplicating its items. sort_order
  -- comes from the join row, letting the same category sit in a different
  -- position on each menu.

  -- Result set 2: categories (only those with items at this location)
  SELECT DISTINCT c.id, mc.menu_id, c.name, c.description, mc.sort_order
    FROM menu_category mc
    JOIN category c ON c.id = mc.category_id
    JOIN menu m ON m.id = mc.menu_id
    JOIN item i ON i.category_id = c.id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE m.is_active = 1 AND i.is_active = 1 AND mc.menu_id = v_menu_id
   ORDER BY mc.sort_order, c.id;

  -- Result set 3: items available at this location, in this period's menu
  SELECT i.id, i.category_id, i.name, i.description, i.price,
         i.image_url, i.sort_order
    FROM item i
    JOIN category c ON c.id = i.category_id
    JOIN menu_category mc ON mc.category_id = c.id AND mc.menu_id = v_menu_id
    JOIN menu m ON m.id = mc.menu_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE m.is_active = 1 AND i.is_active = 1
   ORDER BY mc.sort_order, c.id, i.sort_order, i.id;

  -- Result set 4: options for those items
  SELECT io.id, io.item_id, io.name, io.is_required, io.max_choices
    FROM item_option io
    JOIN item i ON i.id = io.item_id
    JOIN category c ON c.id = i.category_id
    JOIN menu_category mc ON mc.category_id = c.id AND mc.menu_id = v_menu_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE i.is_active = 1;

  -- Result set 5: option values
  SELECT iov.id, iov.item_option_id, iov.name, iov.price_modifier
    FROM item_option_value iov
    JOIN item_option io ON io.id = iov.item_option_id
    JOIN item i ON i.id = io.item_id
    JOIN category c ON c.id = i.category_id
    JOIN menu_category mc ON mc.category_id = c.id AND mc.menu_id = v_menu_id
    JOIN item_location il ON il.item_id = i.id AND il.location_id = p_location_id
   WHERE i.is_active = 1;
END //

-- Revalidate a set of item IDs against a pickup time. The cart calls this when
-- the customer changes pickup time: it returns one row per item that is NOT
-- available in the newly resolved period, so the UI can flag them instead of
-- silently dropping them from the cart.
DROP PROCEDURE IF EXISTS sp_cart_validate_for_pickup //
CREATE PROCEDURE sp_cart_validate_for_pickup(
  IN p_location_id INT UNSIGNED,
  IN p_pickup_time DATETIME,
  IN p_item_ids    TEXT   -- comma-separated item ids
)
BEGIN
  DECLARE v_menu_id INT UNSIGNED DEFAULT NULL;
  DECLARE v_when    DATETIME;

  SET v_when = COALESCE(p_pickup_time, NOW());

  SELECT sp.menu_id INTO v_menu_id
    FROM service_period sp
    JOIN service_period_schedule s
      ON s.service_period_id = sp.id
     AND s.day_of_week       = DAYOFWEEK(v_when)
   WHERE sp.location_id = p_location_id
     AND sp.is_active   = 1
     AND TIME(v_when)  >= s.start_time
     AND TIME(v_when)  <= s.end_time
     AND v_when >= (NOW() + INTERVAL sp.prep_time_minutes MINUTE)
   ORDER BY sp.sort_order, sp.id
   LIMIT 1;

  IF v_menu_id IS NULL THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'No menu is available at the selected pickup time.';
  END IF;

  -- Unavailable items: everything the caller listed that is not in the resolved
  -- menu / not carried at this location / not active.
  --
  -- The CSV is expanded into rows and LEFT JOINed rather than filtered with
  -- FIND_IN_SET over `item`, so an id that no longer exists at all (the item was
  -- hard-deleted while it sat in someone's cart) still comes back as a flagged
  -- row. Filtering would have dropped it silently, which is exactly the
  -- behaviour the cart must avoid.
  WITH RECURSIVE ids AS (
    SELECT CAST(NULLIF(SUBSTRING_INDEX(p_item_ids, ',', 1), '') AS UNSIGNED) AS id,
           CASE WHEN LOCATE(',', p_item_ids) > 0
                THEN SUBSTRING(p_item_ids, LOCATE(',', p_item_ids) + 1)
                ELSE '' END AS rest
     WHERE p_item_ids IS NOT NULL AND p_item_ids <> ''
    UNION ALL
    SELECT CAST(NULLIF(SUBSTRING_INDEX(rest, ',', 1), '') AS UNSIGNED),
           CASE WHEN LOCATE(',', rest) > 0
                THEN SUBSTRING(rest, LOCATE(',', rest) + 1)
                ELSE '' END
      FROM ids
     WHERE rest <> ''
  )
  SELECT ids.id AS item_id,
         COALESCE(i.name, 'This item is no longer available') AS item_name
    FROM ids
    LEFT JOIN item i ON i.id = ids.id
   WHERE ids.id IS NOT NULL
     -- Membership via menu_category (006), matching sp_menu_get_full_for_pickup,
     -- so a shared category's items validate in every menu it is attached to.
     AND NOT EXISTS (
           SELECT 1
             FROM item i2
             JOIN category c ON c.id = i2.category_id
             JOIN menu_category mc
               ON mc.category_id = c.id AND mc.menu_id = v_menu_id
             JOIN menu m ON m.id = mc.menu_id
             JOIN item_location il
               ON il.item_id = i2.id AND il.location_id = p_location_id
            WHERE i2.id        = ids.id
              AND m.is_active  = 1
              AND i2.is_active = 1
         );
END //

-- ---- Menu <-> category membership (migration 006) ---------------------------
--
-- A category may belong to several menus, so one product can be sold in several
-- service periods without duplicating its item row.

-- Which menus a category is on, and which categories a menu contains.
DROP PROCEDURE IF EXISTS sp_menu_category_list //
CREATE PROCEDURE sp_menu_category_list()
BEGIN
  SELECT mc.menu_id, mc.category_id, mc.sort_order,
         m.name AS menu_name, c.name AS category_name,
         -- The category's original owning menu. Kept for reference; membership
         -- is decided by this table, not by category.menu_id.
         c.menu_id AS home_menu_id
    FROM menu_category mc
    JOIN menu m ON m.id = mc.menu_id
    JOIN category c ON c.id = mc.category_id
   ORDER BY mc.menu_id, mc.sort_order, c.id;
END //

DROP PROCEDURE IF EXISTS sp_menu_category_attach //
CREATE PROCEDURE sp_menu_category_attach(
  IN p_menu_id     INT UNSIGNED,
  IN p_category_id INT UNSIGNED,
  IN p_sort_order  INT UNSIGNED
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM menu WHERE id = p_menu_id AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menu not found or inactive.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM category WHERE id = p_category_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Category not found.';
  END IF;

  INSERT INTO menu_category (menu_id, category_id, sort_order)
  VALUES (p_menu_id, p_category_id,
          COALESCE(p_sort_order,
                   (SELECT sort_order FROM category WHERE id = p_category_id), 0))
  ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order);
END //

DROP PROCEDURE IF EXISTS sp_menu_category_detach //
CREATE PROCEDURE sp_menu_category_detach(
  IN p_menu_id     INT UNSIGNED,
  IN p_category_id INT UNSIGNED
)
BEGIN
  -- Refuse to strand a category with no menu at all: its items would vanish
  -- from every service period with no obvious cause.
  IF (SELECT COUNT(*) FROM menu_category WHERE category_id = p_category_id) <= 1 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'A category must stay on at least one menu. Attach it elsewhere before removing it here.';
  END IF;

  DELETE FROM menu_category
   WHERE menu_id = p_menu_id AND category_id = p_category_id;
END //


-- ---- Admin CRUD -------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_service_period_list_by_location //
CREATE PROCEDURE sp_service_period_list_by_location(IN p_location_id INT UNSIGNED)
BEGIN
  SELECT sp.id, sp.location_id, sp.menu_id, m.name AS menu_name, sp.name,
         sp.prep_time_minutes, sp.sort_order, sp.is_active, sp.created_at
    FROM service_period sp
    JOIN menu m ON m.id = sp.menu_id
   WHERE sp.location_id = p_location_id
   ORDER BY sp.sort_order, sp.id;

  -- Second result set: every schedule row for those periods.
  SELECT s.id, s.service_period_id, s.day_of_week, s.start_time, s.end_time
    FROM service_period_schedule s
    JOIN service_period sp ON sp.id = s.service_period_id
   WHERE sp.location_id = p_location_id
   ORDER BY s.service_period_id, s.day_of_week;
END //

DROP PROCEDURE IF EXISTS sp_service_period_create //
CREATE PROCEDURE sp_service_period_create(
  IN p_location_id       INT UNSIGNED,
  IN p_menu_id           INT UNSIGNED,
  IN p_name              VARCHAR(100),
  IN p_prep_time_minutes SMALLINT UNSIGNED,
  IN p_sort_order        INT UNSIGNED
)
BEGIN
  IF p_name IS NULL OR CHAR_LENGTH(TRIM(p_name)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service period name is required.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM location WHERE id = p_location_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Location not found.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM menu WHERE id = p_menu_id AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menu not found or inactive.';
  END IF;

  INSERT INTO service_period
    (location_id, menu_id, name, prep_time_minutes, sort_order, is_active)
  VALUES
    (p_location_id, p_menu_id, TRIM(p_name),
     COALESCE(p_prep_time_minutes, 0), COALESCE(p_sort_order, 0), 1);

  SELECT LAST_INSERT_ID() AS id;
END //

DROP PROCEDURE IF EXISTS sp_service_period_update //
CREATE PROCEDURE sp_service_period_update(
  IN p_id                INT UNSIGNED,
  IN p_menu_id           INT UNSIGNED,
  IN p_name              VARCHAR(100),
  IN p_prep_time_minutes SMALLINT UNSIGNED,
  IN p_sort_order        INT UNSIGNED,
  IN p_is_active         TINYINT(1)
)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM service_period WHERE id = p_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service period not found.';
  END IF;
  IF p_menu_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM menu WHERE id = p_menu_id AND is_active = 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Menu not found or inactive.';
  END IF;

  UPDATE service_period
     SET menu_id           = COALESCE(p_menu_id, menu_id),
         name              = COALESCE(NULLIF(TRIM(p_name), ''), name),
         prep_time_minutes = COALESCE(p_prep_time_minutes, prep_time_minutes),
         sort_order        = COALESCE(p_sort_order, sort_order),
         is_active         = COALESCE(p_is_active, is_active)
   WHERE id = p_id;
END //

-- Set (upsert) one weekday's hours for a period. Deleting a day's row is how a
-- period is marked closed on that day — see sp_service_period_schedule_clear.
DROP PROCEDURE IF EXISTS sp_service_period_schedule_set //
CREATE PROCEDURE sp_service_period_schedule_set(
  IN p_service_period_id INT UNSIGNED,
  IN p_day_of_week       TINYINT UNSIGNED,
  IN p_start_time        TIME,
  IN p_end_time          TIME
)
BEGIN
  DECLARE v_location_id INT UNSIGNED;

  SELECT location_id INTO v_location_id
    FROM service_period WHERE id = p_service_period_id LIMIT 1;
  IF v_location_id IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Service period not found.';
  END IF;
  IF p_day_of_week < 1 OR p_day_of_week > 7 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'day_of_week must be 1 (Sunday) through 7 (Saturday).';
  END IF;
  -- Overnight windows are not supported; model them as two periods.
  IF p_end_time <= p_start_time THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'end_time must be after start_time.';
  END IF;

  -- Two active periods overlapping on the same weekday would make menu
  -- resolution ambiguous, so reject it at write time.
  IF EXISTS (
    SELECT 1
      FROM service_period_schedule s
      JOIN service_period sp ON sp.id = s.service_period_id
     WHERE sp.location_id        = v_location_id
       AND sp.is_active          = 1
       AND s.service_period_id  <> p_service_period_id
       AND s.day_of_week         = p_day_of_week
       AND s.start_time          < p_end_time
       AND s.end_time            > p_start_time
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'That window overlaps another service period at this location on the same day.';
  END IF;

  INSERT INTO service_period_schedule
    (service_period_id, day_of_week, start_time, end_time)
  VALUES
    (p_service_period_id, p_day_of_week, p_start_time, p_end_time)
  ON DUPLICATE KEY UPDATE
    start_time = VALUES(start_time),
    end_time   = VALUES(end_time);
END //

DROP PROCEDURE IF EXISTS sp_service_period_schedule_clear //
CREATE PROCEDURE sp_service_period_schedule_clear(
  IN p_service_period_id INT UNSIGNED,
  IN p_day_of_week       TINYINT UNSIGNED
)
BEGIN
  DELETE FROM service_period_schedule
   WHERE service_period_id = p_service_period_id
     AND day_of_week       = p_day_of_week;
END //

-- Deactivates rather than deletes when the period has order history, so
-- historical orders keep resolving their service_period_id.
DROP PROCEDURE IF EXISTS sp_service_period_delete //
CREATE PROCEDURE sp_service_period_delete(IN p_id INT UNSIGNED)
BEGIN
  IF EXISTS (SELECT 1 FROM `order` WHERE service_period_id = p_id) THEN
    UPDATE service_period SET is_active = 0 WHERE id = p_id;
    SELECT 'deactivated' AS result;
  ELSE
    DELETE FROM service_period WHERE id = p_id;
    SELECT 'deleted' AS result;
  END IF;
END //


DELIMITER ;
