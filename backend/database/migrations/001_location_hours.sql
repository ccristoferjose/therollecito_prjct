-- 001_location_hours.sql
-- Adds daily service hours to the location table for scheduled pickup orders.
-- NULL hours means the location has no schedule (always-on, backward-compatible).
--
-- Apply manually against an existing database:
--   mysql -uroot -p restaurant_ordering < migrations/001_location_hours.sql
--   mysql -uroot -p restaurant_ordering < stored_procedures.sql
-- (The second command refreshes sp_location_create / sp_location_update /
--  sp_location_list_* / sp_order_create with the new signatures and
--  pickup_time validation.)

ALTER TABLE location
  ADD COLUMN open_time  TIME NULL AFTER phone,
  ADD COLUMN close_time TIME NULL AFTER open_time;
