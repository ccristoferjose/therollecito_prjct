-- =============================================================================
-- Restaurant Ordering Platform - Reset Script
-- Drops ALL tables (disables FK checks) for testing / fresh rebuilds
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- Drop all stored procedures
DROP PROCEDURE IF EXISTS sp_user_create_if_not_exists;
DROP PROCEDURE IF EXISTS sp_user_get_by_email;
DROP PROCEDURE IF EXISTS sp_staff_create;
DROP PROCEDURE IF EXISTS sp_user_get_by_firebase_uid;
DROP PROCEDURE IF EXISTS sp_user_update_role;
DROP PROCEDURE IF EXISTS sp_order_create;
DROP PROCEDURE IF EXISTS sp_order_add_item;
DROP PROCEDURE IF EXISTS sp_order_add_item_option;
DROP PROCEDURE IF EXISTS sp_order_remove_item;
DROP PROCEDURE IF EXISTS sp_order_calculate_total;
DROP PROCEDURE IF EXISTS sp_order_mark_paid;
DROP PROCEDURE IF EXISTS sp_order_update_status;
DROP PROCEDURE IF EXISTS sp_order_get;
DROP PROCEDURE IF EXISTS sp_order_get_items;
DROP PROCEDURE IF EXISTS sp_order_list_by_location;
DROP PROCEDURE IF EXISTS sp_order_list_by_user;
DROP PROCEDURE IF EXISTS sp_payment_record;
DROP PROCEDURE IF EXISTS sp_menu_assign_to_location;
DROP PROCEDURE IF EXISTS sp_category_create;
DROP PROCEDURE IF EXISTS sp_item_create;
DROP PROCEDURE IF EXISTS sp_item_update;
DROP PROCEDURE IF EXISTS sp_item_option_create;
DROP PROCEDURE IF EXISTS sp_item_option_value_create;
DROP PROCEDURE IF EXISTS sp_promotion_create;
DROP PROCEDURE IF EXISTS sp_promotion_apply;
DROP PROCEDURE IF EXISTS sp_newsletter_subscribe;
DROP PROCEDURE IF EXISTS sp_newsletter_unsubscribe;
DROP PROCEDURE IF EXISTS sp_location_create;
DROP PROCEDURE IF EXISTS sp_location_toggle_active;
DROP PROCEDURE IF EXISTS sp_menu_get_full;
DROP PROCEDURE IF EXISTS sp_location_list_active;

-- Drop all tables
DROP TABLE IF EXISTS newsletter_subscriber;
DROP TABLE IF EXISTS promotion;
DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS order_item_option;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS `order`;
DROP TABLE IF EXISTS order_status;
DROP TABLE IF EXISTS item_option_value;
DROP TABLE IF EXISTS item_option;
DROP TABLE IF EXISTS item;
DROP TABLE IF EXISTS category;
DROP TABLE IF EXISTS menu;
DROP TABLE IF EXISTS location;
DROP TABLE IF EXISTS `user`;
DROP TABLE IF EXISTS role;

SET FOREIGN_KEY_CHECKS = 1;
