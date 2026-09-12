-- 006_menu_category.sql
--
-- Lets one category belong to several menus, so a product sold in more than one
-- service period no longer has to be duplicated.
--
-- THE PROBLEM THIS SOLVES
-- Before this, the chain was strictly 1:N the whole way down:
--     service_period.menu_id -> menu <- category.menu_id <- item.category_id
-- An item therefore lived in exactly one menu. Selling the same coffee at
-- breakfast AND lunch meant creating a SECOND item row: its own id, its own
-- price, its own option groups, its own item_location rows. Reporting then
-- splits one real product across several ids, and every price change has to be
-- repeated.
--
-- After this, a single "Drinks" category can be attached to both the Breakfast
-- and Lunch menus, and the items inside it stay as one row each.
--
-- STRICTLY ADDITIVE AND NON-DESTRUCTIVE:
--   * No table is dropped, renamed, or recreated.
--   * category.menu_id is LEFT IN PLACE and still NOT NULL. It keeps working as
--     the category's owning/home menu, so every existing query and stored
--     procedure that reads it behaves exactly as before.
--   * The new table is backfilled from category.menu_id, so on the day this
--     ships every category is attached to exactly the menu it already had —
--     behaviour is unchanged until an admin attaches a second menu.
--   * Re-runnable: guarded, so applying it twice is a no-op.
--
-- Apply with:
--   ./deploy/db-migrate.sh
-- (Production has no schema_migrations table yet and 001/003/004 were applied by
--  hand — run `./deploy/db-migrate.sh --baseline` ONCE first.)

-- ---------------------------------------------------------------------------
-- menu_category
--
-- sort_order is per (menu, category) rather than per category, because the same
-- shared category can reasonably sit in a different position on each menu —
-- Drinks near the top of a breakfast menu, at the bottom of a lunch menu.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_category (
  menu_id     INT UNSIGNED NOT NULL,
  category_id INT UNSIGNED NOT NULL,
  sort_order  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (menu_id, category_id),
  KEY idx_menu_category_category (category_id),

  CONSTRAINT fk_menu_category_menu
    FOREIGN KEY (menu_id) REFERENCES menu (id)
    ON UPDATE CASCADE ON DELETE CASCADE,

  CONSTRAINT fk_menu_category_category
    FOREIGN KEY (category_id) REFERENCES category (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- BACKFILL — reproduce the existing 1:N links exactly.
--
-- Every category gets a row for the menu it already belongs to, carrying its
-- current sort_order, so menus render identically the moment this lands.
-- ---------------------------------------------------------------------------
INSERT INTO menu_category (menu_id, category_id, sort_order)
SELECT c.menu_id, c.id, c.sort_order
  FROM category c
 WHERE NOT EXISTS (
         SELECT 1 FROM menu_category mc
          WHERE mc.menu_id = c.menu_id AND mc.category_id = c.id
       );
