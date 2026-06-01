-- 004_processing_fee.sql
-- Adds the processing_fee column on `order` to record the Stripe fee
-- passed through to the customer at calculate-total time. Existing rows
-- get 0.00 (already paid orders are unaffected; the surcharge only
-- applies to new orders calculated after this is deployed).
--
-- Apply on existing DB:
--   mysql -uroot -p restaurant_ordering < migrations/004_processing_fee.sql
--   mysql -uroot -p restaurant_ordering < stored_procedures.sql
-- (The second command is required to pick up the new sp_order_calculate_total
--  signature with the fee parameters.)

ALTER TABLE `order`
  ADD COLUMN processing_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00 AFTER discount_amount;
