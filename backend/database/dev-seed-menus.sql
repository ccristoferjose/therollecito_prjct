-- =============================================================================
-- DEV SEED — Breakfast + Lunch menus and service periods for LOCAL testing.
--
-- *** LOCAL DEVELOPMENT ONLY. NEVER RUN THIS AGAINST PRODUCTION. ***
-- It creates menus and rewrites location 1's service periods, which on a live
-- database would change what real customers can order.
--
-- Migration 005 backfills every location with one "All Day" period so behaviour
-- is unchanged on deploy. Correct for production, but it means the menu never
-- varies by pickup time and there is nothing to test. This seed sets up:
--
--   Breakfast  07:00-11:30  -> Breakfast Menu  (prep 15 min)
--   Lunch      11:30-17:00  -> Lunch Menu      (prep 20 min)
--
-- The original "Main Menu" is left untouched and simply unused by any period,
-- so nothing existing is destroyed.
--
-- Run:
--   docker exec -i therollecito_prjct-db-1 mysql -u root -padmin123 \
--     restaurant_ordering < backend/database/dev-seed-menus.sql
--
-- Re-runnable: every insert is guarded, so a second run changes nothing.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Clear location 1's periods.
--
-- sp_service_period_schedule_set rejects overlapping windows at a location, and
-- the backfilled "All Day" (plus anything from an earlier seed) would collide
-- with Breakfast/Lunch. Orders referencing these fall through ON DELETE SET NULL.
-- -----------------------------------------------------------------------------
DELETE FROM service_period WHERE location_id = 1;

-- -----------------------------------------------------------------------------
-- 1. Menus
-- -----------------------------------------------------------------------------
INSERT INTO menu (name, is_active)
SELECT 'Breakfast Menu', 1
 WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name = 'Breakfast Menu');

INSERT INTO menu (name, is_active)
SELECT 'Lunch Menu', 1
 WHERE NOT EXISTS (SELECT 1 FROM menu WHERE name = 'Lunch Menu');

SET @m_breakfast := (SELECT id FROM menu WHERE name = 'Breakfast Menu' LIMIT 1);
SET @m_lunch     := (SELECT id FROM menu WHERE name = 'Lunch Menu'     LIMIT 1);

-- -----------------------------------------------------------------------------
-- 2. Categories. A category belongs to exactly one menu, so "Drinks" exists
--    separately under each — that is the real shape of this schema, not a bug.
-- -----------------------------------------------------------------------------
INSERT INTO category (menu_id, name, description, sort_order)
SELECT * FROM (
  SELECT @m_breakfast AS menu_id, 'Cinnamon Rolls'   AS name, 'Baked fresh every morning' AS description, 1 AS sort_order UNION ALL
  SELECT @m_breakfast, 'Breakfast Plates', 'Served with beans and potatoes', 2 UNION ALL
  SELECT @m_breakfast, 'Coffee & Drinks',  'Hot and iced',                   3 UNION ALL
  SELECT @m_lunch,     'Tacos',            'Three per order',                1 UNION ALL
  SELECT @m_lunch,     'Bowls',            'Rice, beans and protein',        2 UNION ALL
  SELECT @m_lunch,     'Sides',            NULL,                             3 UNION ALL
  SELECT @m_lunch,     'Drinks',           'Aguas frescas and sodas',        4
) src
 WHERE NOT EXISTS (
   SELECT 1 FROM category c WHERE c.menu_id = src.menu_id AND c.name = src.name
 );

SET @c_rolls   := (SELECT id FROM category WHERE menu_id = @m_breakfast AND name = 'Cinnamon Rolls'   LIMIT 1);
SET @c_plates  := (SELECT id FROM category WHERE menu_id = @m_breakfast AND name = 'Breakfast Plates' LIMIT 1);
SET @c_coffee  := (SELECT id FROM category WHERE menu_id = @m_breakfast AND name = 'Coffee & Drinks'  LIMIT 1);
SET @c_tacos   := (SELECT id FROM category WHERE menu_id = @m_lunch     AND name = 'Tacos'            LIMIT 1);
SET @c_bowls   := (SELECT id FROM category WHERE menu_id = @m_lunch     AND name = 'Bowls'            LIMIT 1);
SET @c_sides   := (SELECT id FROM category WHERE menu_id = @m_lunch     AND name = 'Sides'            LIMIT 1);
SET @c_drinks  := (SELECT id FROM category WHERE menu_id = @m_lunch     AND name = 'Drinks'           LIMIT 1);

-- -----------------------------------------------------------------------------
-- 3. Items
-- -----------------------------------------------------------------------------
INSERT INTO item (category_id, name, description, price, is_active, sort_order)
SELECT * FROM (
  -- Breakfast
  SELECT @c_rolls  AS category_id, 'Classic Cinnamon Roll'        AS name, 'Warm, with cream cheese glaze'        AS description,  4.75 AS price, 1 AS is_active, 1 AS sort_order UNION ALL
  SELECT @c_rolls,  'Strawberries & Nutella Roll', 'Fresh strawberries, hazelnut spread',  6.50, 1, 2 UNION ALL
  SELECT @c_rolls,  'Tres Leches Roll',            'Soaked in three milks',                6.25, 1, 3 UNION ALL
  SELECT @c_rolls,  'Oreo Roll',                   'Cookies and cream',                    6.25, 1, 4 UNION ALL
  SELECT @c_plates, 'Chilaquiles Verdes',          'Eggs, queso fresco, crema',            11.50, 1, 1 UNION ALL
  SELECT @c_plates, 'Breakfast Burrito',           'Egg, potato, cheese, salsa roja',       9.75, 1, 2 UNION ALL
  SELECT @c_plates, 'Huevos Rancheros',            'Two eggs, ranchero sauce, tortillas',  10.50, 1, 3 UNION ALL
  SELECT @c_coffee, 'Hot Latte',                   'Double shot, steamed milk',             4.50, 1, 1 UNION ALL
  SELECT @c_coffee, 'Iced Coffee',                 'Cold brew over ice',                    4.25, 1, 2 UNION ALL
  SELECT @c_coffee, 'Fresas con Crema',            'Strawberries and cream, 12 oz',         5.75, 1, 3 UNION ALL
  -- Lunch
  SELECT @c_tacos,  'Tacos al Pastor',             'Marinated pork, pineapple, onion',     12.50, 1, 1 UNION ALL
  SELECT @c_tacos,  'Tacos de Carne Asada',        'Grilled steak, cilantro, onion',       13.50, 1, 2 UNION ALL
  SELECT @c_tacos,  'Tacos de Pollo',              'Grilled chicken, salsa verde',         11.50, 1, 3 UNION ALL
  SELECT @c_tacos,  'Tacos de Nopal',              'Grilled cactus, vegetarian',           10.50, 1, 4 UNION ALL
  SELECT @c_bowls,  'Burrito Bowl',                'Rice, beans, protein, salsa',          13.95, 1, 1 UNION ALL
  SELECT @c_bowls,  'Veggie Bowl',                 'Rice, beans, grilled vegetables',      11.95, 1, 2 UNION ALL
  SELECT @c_sides,  'Chips & Guacamole',           'Made to order',                         6.50, 1, 1 UNION ALL
  SELECT @c_sides,  'Elote',                       'Grilled corn, cotija, chili',           4.95, 1, 2 UNION ALL
  SELECT @c_sides,  'Black Beans',                 NULL,                                    3.50, 1, 3 UNION ALL
  SELECT @c_drinks, 'Horchata',                    'Rice, cinnamon, vanilla',               4.50, 1, 1 UNION ALL
  SELECT @c_drinks, 'Agua de Jamaica',             'Hibiscus',                              4.50, 1, 2 UNION ALL
  SELECT @c_drinks, 'Mexican Coke',                'Glass bottle',                          3.75, 1, 3
) src
 WHERE NOT EXISTS (
   SELECT 1 FROM item i WHERE i.category_id = src.category_id AND i.name = src.name
 );

-- -----------------------------------------------------------------------------
-- 4. Availability at location 1.
--
-- item_location still gates availability per location INDEPENDENTLY of the
-- service period: the period selects which MENU shows, this decides which of
-- its items this location actually carries. Both filters must pass.
-- -----------------------------------------------------------------------------
INSERT INTO item_location (item_id, location_id)
SELECT i.id, 1
  FROM item i
  JOIN category c ON c.id = i.category_id
 WHERE c.menu_id IN (@m_breakfast, @m_lunch)
   AND NOT EXISTS (
     SELECT 1 FROM item_location il WHERE il.item_id = i.id AND il.location_id = 1
   );

-- -----------------------------------------------------------------------------
-- 5. Options — exercises required/optional and single/multi-select paths.
-- -----------------------------------------------------------------------------
SET @i_latte  := (SELECT id FROM item WHERE category_id = @c_coffee AND name = 'Hot Latte' LIMIT 1);
SET @i_roll   := (SELECT id FROM item WHERE category_id = @c_rolls  AND name = 'Classic Cinnamon Roll' LIMIT 1);
SET @i_bowl   := (SELECT id FROM item WHERE category_id = @c_bowls  AND name = 'Burrito Bowl' LIMIT 1);
SET @i_pastor := (SELECT id FROM item WHERE category_id = @c_tacos  AND name = 'Tacos al Pastor' LIMIT 1);

INSERT INTO item_option (item_id, name, is_required, max_choices)
SELECT * FROM (
  SELECT @i_latte  AS item_id, 'Size'      AS name, 1 AS is_required, 1 AS max_choices UNION ALL
  SELECT @i_latte,  'Milk',       0, 1 UNION ALL
  SELECT @i_roll,   'Add-ons',    0, 3 UNION ALL
  SELECT @i_bowl,   'Protein',    1, 1 UNION ALL
  SELECT @i_bowl,   'Extras',     0, 3 UNION ALL
  SELECT @i_pastor, 'Salsa',      0, 2
) src
 WHERE src.item_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM item_option io WHERE io.item_id = src.item_id AND io.name = src.name
   );

INSERT INTO item_option_value (item_option_id, name, price_modifier)
SELECT * FROM (
  SELECT (SELECT id FROM item_option WHERE item_id=@i_latte  AND name='Size')    AS item_option_id, '12 oz'           AS name, 0.00 AS price_modifier UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_latte  AND name='Size'),    '16 oz',            0.75 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_latte  AND name='Size'),    '20 oz',            1.25 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_latte  AND name='Milk'),    'Oat milk',         0.75 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_latte  AND name='Milk'),    'Almond milk',      0.75 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_roll   AND name='Add-ons'), 'Extra glaze',      1.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_roll   AND name='Add-ons'), 'Fresh strawberries', 1.50 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_roll   AND name='Add-ons'), 'Chopped pecans',   1.25 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Protein'), 'Carne asada',      2.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Protein'), 'Al pastor',        1.50 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Protein'), 'Grilled veggies',  0.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Extras'),  'Guacamole',        2.25 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Extras'),  'Sour cream',       0.75 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_bowl   AND name='Extras'),  'Extra cheese',     1.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_pastor AND name='Salsa'),   'Salsa verde',      0.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_pastor AND name='Salsa'),   'Salsa roja',       0.00 UNION ALL
  SELECT (SELECT id FROM item_option WHERE item_id=@i_pastor AND name='Salsa'),   'Habanero',         0.50
) src
 WHERE src.item_option_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM item_option_value v
      WHERE v.item_option_id = src.item_option_id AND v.name = src.name
   );

-- -----------------------------------------------------------------------------
-- 6. Service periods.
--
-- Breakfast carries a 15-minute prep time and Lunch 20, so the boundary is
-- observable: near 11:20 the earliest valid breakfast pickup is 11:35, which is
-- outside the breakfast window, and Lunch resolves instead.
-- -----------------------------------------------------------------------------
INSERT INTO service_period (location_id, menu_id, name, prep_time_minutes, sort_order, is_active)
SELECT 1, @m_breakfast, 'Breakfast', 15, 1, 1
 WHERE NOT EXISTS (SELECT 1 FROM service_period WHERE location_id=1 AND name='Breakfast');

INSERT INTO service_period (location_id, menu_id, name, prep_time_minutes, sort_order, is_active)
SELECT 1, @m_lunch, 'Lunch', 20, 2, 1
 WHERE NOT EXISTS (SELECT 1 FROM service_period WHERE location_id=1 AND name='Lunch');

SET @sp_breakfast := (SELECT id FROM service_period WHERE location_id=1 AND name='Breakfast' LIMIT 1);
SET @sp_lunch     := (SELECT id FROM service_period WHERE location_id=1 AND name='Lunch'     LIMIT 1);

-- Mon-Sat (2..7) for both. Sunday (1) is deliberately left out so the
-- "closed on a given weekday is just an absent row" design is testable.
INSERT INTO service_period_schedule (service_period_id, day_of_week, start_time, end_time)
SELECT @sp_breakfast, d.dow, '07:00:00', '11:30:00'
  FROM (SELECT 2 AS dow UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) d
 WHERE NOT EXISTS (
   SELECT 1 FROM service_period_schedule
    WHERE service_period_id = @sp_breakfast AND day_of_week = d.dow
 );

INSERT INTO service_period_schedule (service_period_id, day_of_week, start_time, end_time)
SELECT @sp_lunch, d.dow, '11:30:00', '17:00:00'
  FROM (SELECT 2 AS dow UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL
        SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7) d
 WHERE NOT EXISTS (
   SELECT 1 FROM service_period_schedule
    WHERE service_period_id = @sp_lunch AND day_of_week = d.dow
 );

-- -----------------------------------------------------------------------------
-- Summary
-- -----------------------------------------------------------------------------
SELECT sp.name AS period, m.name AS menu, sp.prep_time_minutes AS prep_min,
       MIN(s.start_time) AS opens, MIN(s.end_time) AS closes,
       COUNT(DISTINCT s.day_of_week) AS days_open,
       (SELECT COUNT(*) FROM item i
          JOIN category c ON c.id = i.category_id
          JOIN item_location il ON il.item_id = i.id AND il.location_id = 1
         WHERE c.menu_id = sp.menu_id AND i.is_active = 1) AS items
  FROM service_period sp
  JOIN menu m ON m.id = sp.menu_id
  LEFT JOIN service_period_schedule s ON s.service_period_id = sp.id
 WHERE sp.location_id = 1
 GROUP BY sp.id, sp.name, m.name, sp.prep_time_minutes, sp.menu_id
 ORDER BY sp.sort_order;
