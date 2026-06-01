-- 003_order_item_snapshots.sql
-- Allow hard-deleting menu items by:
--   1. Denormalizing item_name into order_item, and option_name /
--      option_value_name into order_item_option (snapshots at order time).
--   2. Switching the relevant FKs from ON DELETE RESTRICT to SET NULL,
--      and making the FK columns nullable.
-- Past orders stay readable (snapshot), and a NULL item_id /
-- item_option_value_id flags the row as "no longer available" — the
-- reorder/track UI uses that to disable the reorder button.
--
-- Apply on an existing database with:
--   mysql -uroot -p restaurant_ordering < migrations/003_order_item_snapshots.sql
--   mysql -uroot -p restaurant_ordering < stored_procedures.sql

-- ---- order_item ----
ALTER TABLE order_item
  ADD COLUMN item_name VARCHAR(150) NULL AFTER item_id;

UPDATE order_item oi
   JOIN item i ON i.id = oi.item_id
   SET oi.item_name = i.name
 WHERE oi.item_name IS NULL;

ALTER TABLE order_item
  DROP FOREIGN KEY fk_order_item_item;

ALTER TABLE order_item
  MODIFY COLUMN item_id INT UNSIGNED NULL;

ALTER TABLE order_item
  ADD CONSTRAINT fk_order_item_item
    FOREIGN KEY (item_id) REFERENCES item (id)
    ON UPDATE CASCADE ON DELETE SET NULL;

-- ---- order_item_option ----
ALTER TABLE order_item_option
  ADD COLUMN option_name       VARCHAR(100) NULL AFTER item_option_value_id,
  ADD COLUMN option_value_name VARCHAR(100) NULL AFTER option_name;

UPDATE order_item_option oio
   JOIN item_option_value iov ON iov.id = oio.item_option_value_id
   JOIN item_option io ON io.id = iov.item_option_id
   SET oio.option_value_name = iov.name,
       oio.option_name       = io.name
 WHERE oio.option_value_name IS NULL;

ALTER TABLE order_item_option
  DROP FOREIGN KEY fk_order_item_option_value;

ALTER TABLE order_item_option
  MODIFY COLUMN item_option_value_id INT UNSIGNED NULL;

ALTER TABLE order_item_option
  ADD CONSTRAINT fk_order_item_option_value
    FOREIGN KEY (item_option_value_id) REFERENCES item_option_value (id)
    ON UPDATE CASCADE ON DELETE SET NULL;
