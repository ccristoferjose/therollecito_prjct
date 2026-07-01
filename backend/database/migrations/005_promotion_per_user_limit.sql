-- 005_promotion_per_user_limit.sql
-- Adds per-customer redemption limits to promotions.
--
-- Before: `max_uses` was a single GLOBAL counter — "1" meant one redemption
-- ever (the first customer wins). Now `per_user_limit` caps redemptions PER
-- registered customer (NULL = unlimited per customer), while `max_uses` stays
-- as an OPTIONAL overall cap across everyone. Per-customer usage is derived
-- from the `order` table (promotion_id + user_id + non-canceled status), so no
-- new table is needed.
--
-- Apply on an existing DB:
--   mysql -uroot -p restaurant_ordering < migrations/005_promotion_per_user_limit.sql
--   mysql -uroot -p restaurant_ordering < stored_procedures.sql
-- (The second command reloads the SPs with the new per_user_limit parameters.)

ALTER TABLE promotion
  ADD COLUMN per_user_limit INT UNSIGNED NULL
    COMMENT 'max redemptions per registered customer (NULL = unlimited)'
    AFTER max_uses;
