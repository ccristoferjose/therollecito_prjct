-- =============================================================================
-- LOCAL DEV DEMO DATA — clients + orders across statuses for the staff UI.
-- NOT for production. Load with utf8mb4 so accents/em-dashes store correctly:
--
--   docker compose exec -T db \
--     mysql --default-character-set=utf8mb4 -uroot -padmin123 restaurant_ordering \
--     < backend/database/demo_seed.sql
--
-- Re-runnable & stable: it removes its own prior demo rows (clients tagged with
-- firebase_uid LIKE 'demo\_%') and reuses a FIXED location id across re-runs, so
-- bookmarked ?location_id=… URLs keep working.
-- =============================================================================

START TRANSACTION;

-- --- Clean up any previous run (orders first — FK order.location_id) -------
DELETE oi FROM order_item oi
  JOIN `order` o ON o.id = oi.order_id
  JOIN `user` u ON u.id = o.user_id
 WHERE u.firebase_uid LIKE 'demo\_%';
DELETE o FROM `order` o
  JOIN `user` u ON u.id = o.user_id
 WHERE u.firebase_uid LIKE 'demo\_%';
DELETE FROM `user` WHERE firebase_uid LIKE 'demo\_%';

-- --- Location (stable id across re-runs) -----------------------------------
-- Keep the lowest existing demo location; drop any duplicates (safe now that
-- demo orders are gone); create it once if missing. @loc never changes on re-run.
SET @loc := (SELECT MIN(id) FROM location WHERE name = 'The Rollecito — Downtown LA');
DELETE FROM location
 WHERE name = 'The Rollecito — Downtown LA' AND (@loc IS NULL OR id <> @loc);
INSERT INTO location (name, address, city, state, zip_code, phone, open_time, close_time, is_active)
SELECT 'The Rollecito — Downtown LA', '620 El Segundo Blvd', 'Los Angeles', 'CA', '90059',
       '(323) 612-9202', '10:00:00', '20:00:00', 1
  FROM DUAL WHERE @loc IS NULL;
SET @loc := COALESCE(@loc, LAST_INSERT_ID());
-- Keep the reused location's fields fresh.
UPDATE location
   SET address = '620 El Segundo Blvd', city = 'Los Angeles', state = 'CA',
       zip_code = '90059', phone = '(323) 612-9202',
       open_time = '10:00:00', close_time = '20:00:00', is_active = 1
 WHERE id = @loc;

SET @client_role := (SELECT id FROM role WHERE name = 'client' LIMIT 1);

-- --- Clients --------------------------------------------------------------
INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
VALUES ('demo_maria', 'maria.gonzalez@example.com', NULL, 'Maria', 'Gonzalez', '(213) 555-0142', @client_role, NULL);
SET @maria := LAST_INSERT_ID();
INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
VALUES ('demo_james', 'james.carter@example.com', NULL, 'James', 'Carter', '(310) 555-0198', @client_role, NULL);
SET @james := LAST_INSERT_ID();
INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
VALUES ('demo_aiko', 'aiko.tanaka@example.com', NULL, 'Aiko', 'Tanaka', '(424) 555-0177', @client_role, NULL);
SET @aiko := LAST_INSERT_ID();
INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
VALUES ('demo_diego', 'diego.ramirez@example.com', NULL, 'Diego', 'Ramirez', '(818) 555-0110', @client_role, NULL);
SET @diego := LAST_INSERT_ID();

-- --- Orders (status ids: 2=PAID 3=PREPARING 4=READY 5=COMPLETED 6=CANCELED) --

-- Maria: 2 completed + 1 in progress
INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, created_at)
VALUES (@loc, @maria, 5, UUID(), 1, 18.50, 18.50, NOW() - INTERVAL 5 DAY);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Clásico', 1, 14.50), (@o, NULL, 'Agua Fresca', 1, 4.00);

INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, created_at)
VALUES (@loc, @maria, 5, UUID(), 2, 32.00, 32.00, NOW() - INTERVAL 2 DAY);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Mixto', 2, 16.00);

INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, pickup_time, created_at)
VALUES (@loc, @maria, 3, UUID(), 3, 14.50, 14.50, NOW() + INTERVAL 20 MINUTE, NOW() - INTERVAL 8 MINUTE);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Clásico', 1, 14.50);

-- James: 1 paid (new), 1 canceled
INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, pickup_time, created_at)
VALUES (@loc, @james, 2, UUID(), 4, 22.50, 22.50, NOW() + INTERVAL 30 MINUTE, NOW() - INTERVAL 3 MINUTE);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Mixto', 1, 16.00), (@o, NULL, 'Tostada de Camarón', 1, 6.50);

INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, created_at)
VALUES (@loc, @james, 6, UUID(), 5, 14.50, 14.50, NOW() - INTERVAL 3 DAY);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Clásico', 1, 14.50);

-- Aiko: repeat customer — 3 completed + 1 ready
INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, created_at)
VALUES (@loc, @aiko, 5, UUID(), 6, 48.00, 48.00, NOW() - INTERVAL 10 DAY);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Mixto', 3, 16.00);

INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, created_at)
VALUES (@loc, @aiko, 5, UUID(), 7, 22.50, 22.50, NOW() - INTERVAL 4 DAY);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Clásico', 1, 14.50), (@o, NULL, 'Agua Fresca', 2, 4.00);

INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, pickup_time, created_at)
VALUES (@loc, @aiko, 4, UUID(), 8, 16.00, 16.00, NOW() + INTERVAL 5 MINUTE, NOW() - INTERVAL 18 MINUTE);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price) VALUES
  (@o, NULL, 'Ceviche Mixto', 1, 16.00);

-- Maria again: a live PAID order with an order-level comment, a per-item note,
-- and extra toppings — exercises the full expanded kitchen-card detail.
INSERT INTO `order` (location_id, user_id, status_id, tracking_code, display_number, total_amount, subtotal_amount, pickup_time, notes, created_at)
VALUES (@loc, @maria, 2, UUID(), 9, 27.00, 27.00, NOW() + INTERVAL 25 MINUTE,
        'No cilantro please — severe allergy. Extra napkins.', NOW() - INTERVAL 2 MINUTE);
SET @o := LAST_INSERT_ID();
INSERT INTO order_item (order_id, item_id, item_name, quantity, unit_price, notes) VALUES
  (@o, NULL, 'Ceviche Mixto', 1, 16.00, 'Make it spicy'),
  (@o, NULL, 'Tostada de Camarón', 1, 6.50, NULL);
SET @oi1 := (SELECT MIN(id) FROM order_item WHERE order_id = @o);
INSERT INTO order_item_option (order_item_id, item_option_value_id, option_name, option_value_name, price_modifier) VALUES
  (@oi1, NULL, 'Extra Toppings', 'Avocado', 2.50),
  (@oi1, NULL, 'Extra Toppings', 'Extra Shrimp', 4.00),
  (@oi1, NULL, 'Spice Level', 'Diablo Hot', 0.00);

-- Diego: signed in, no orders yet (shows the empty-history state)

COMMIT;

SELECT @loc AS demo_location_id,
  (SELECT COUNT(*) FROM `user` WHERE firebase_uid LIKE 'demo\_%') AS demo_clients,
  (SELECT COUNT(*) FROM `order` o JOIN `user` u ON u.id=o.user_id WHERE u.firebase_uid LIKE 'demo\_%') AS demo_orders;
