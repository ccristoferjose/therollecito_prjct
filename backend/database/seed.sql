-- =============================================================================
-- The Rollecito — Seed Data (minimal)
--
-- Only seeds the admin account so a fresh DB can be logged into. Locations,
-- menus, categories, items, item options, and promotions are intentionally
-- left empty — they should be created through the admin UI.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ADMIN USER (email: admin@therollecito.com / password: Admin2026!)
-- -----------------------------------------------------------------------------
INSERT INTO `user` (firebase_uid, email, password_hash, first_name, last_name, phone, role_id, location_id)
VALUES (NULL, 'admin@therollecito.com', '$2b$12$X7VWTPA71t3Io/tSUnC4m.t9hY.y0gNDVBUnC1Z/VpFNV5t1BfGAC', 'Admin', 'Rollecito', NULL, 1, NULL);

-- -----------------------------------------------------------------------------
-- DEFAULT MENU CONTAINER
--
-- The admin UI (MenuManagement) expects exactly one `menu` row to act as the
-- container for all categories/items. It's structural, not business data —
-- the admin never "picks" a menu, categories just belong to the default one.
-- Without it, creating a category fails validation (menuId required).
-- -----------------------------------------------------------------------------
CALL sp_menu_create('Main Menu');
